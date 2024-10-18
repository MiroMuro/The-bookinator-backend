const { GraphQLError } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const { GraphQLUpload } = require("graphql-upload-ts");
const mongoose = require("mongoose");
const BookMongo = require("./models/Book");
const AuthorMongo = require("./models/Author");
const Account = require("./models/User");
const bcrypt = require("bcrypt");
const pubsub = new PubSub();
import { GridFSBucket } from "mongodb";
const jsonwebtoken = require("jsonwebtoken");
//import { Upload } from "graphql-upload-ts";
import {
  Context,
  ArgsAllBooks,
  MongoAuthorBookUnion,
  AuthorSetBornArgs,
  UserMongoDB,
  AddBookArgs,
  LoginArgs,
  CreateUserArgs,
  JwtValidationError,
  AddAuthorArgs,
  MongoError,
  FilePromise,
} from "./types/interfaces";
import { ObjectId } from "mongoose";
//Helper functions for the login mutation.
declare global {
  // eslint-disable-next-line no-var
  var gfs: GridFSBucket | undefined;
}
const generateToken = (user: UserMongoDB, secret: string) => {
  const userForToken = {
    username: user.username,
    id: user._id,
  };
  return jsonwebtoken.sign(userForToken, secret, { expiresIn: "1h" });
};

const validateEnvVariables = (): void => {
  if (!process.env.JWT_SECRET) {
    throw new JwtValidationError("JWT_SECRET not defined");
  }
};

const validateBookArgs = (args: AddBookArgs): void => {
  if (args.author.length < 4) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Author name too short!",
        code: "BAD_AUTHOR_NAME",
      },
    });
  }
  if (args.title.length < 2) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Book title too short!",
        code: "BAD_BOOK_TITLE",
      },
    });
  }
  if (args.title.length > 150) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Book title too long!",
        code: "BAD_BOOK_TITLE",
      },
    });
  }
  if (!args.genres.length) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Book must have at least one genre!",
        code: "BAD_BOOK_GENRES",
      },
    });
  }
  if (args.genres.length > 3) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Book cant have more then three genres!",
        code: "BAD_BOOK_GENRES",
      },
    });
  }
  if (args.published < 0) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Publication date cant be negative!",
        code: "BAD_BOOK_PUBLICATION_DATE",
      },
    });
  }
  if (args.description && args.description.length > 1600) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Description too long!",
        code: "BAD_BOOK_DESCRIPTION",
      },
    });
  }
};
const validateAddAuthorArgs = (args: AddAuthorArgs): void => {
  if (args.name.length < 4) {
    throw new GraphQLError("Creating an author failed!", {
      extensions: {
        message: "Author name too short!",
        code: "BAD_AUTHOR_NAME",
      },
    });
  }
  if (args.name.length > 170) {
    throw new GraphQLError("Creating an author failed!", {
      extensions: {
        message: "Author name too long!",
        code: "BAD_AUTHOR_NAME",
      },
    });
  }
  if (args.born && args.born < 0) {
    throw new GraphQLError("Creating an author failed!", {
      extensions: {
        message: "Author birth year cant be negative!",
        code: "BAD_AUTHOR_BIRTH_YEAR",
      },
    });
  }
};
const findOrCreateAuthor = async (authorName: string) => {
  //The bookcount must be populated to be able to increment it.
  let author = await AuthorMongo.findOne({ name: authorName }).populate(
    "bookCount"
  );

  if (!author) {
    author = new AuthorMongo({ name: authorName, bookCount: 0 });
  }

  //The manual increment is needed HERE because otherwise bookCount would
  //only refreshes when All authors are re-fetched. e.g. after the book is saved.
  author.bookCount += 1;
  await author.save();

  return author;
};
const validateMimeTypeToBeImage = (mimetype: string) => {
  if (!mimetype.startsWith("image")) {
    throw new GraphQLError("File must be an image!", {
      extensions: {
        code: "BAD_FILE_TYPE",
      },
    });
  }
};
const findBooksByAuthor = async (authorName: string) => {
  const author = await AuthorMongo.findOne({ name: authorName });
  if (!author) return [];
  return await BookMongo.find({ author: author._id });
};

const findBooksByGenre = async (genre: string) => {
  return await BookMongo.find({ genres: genre });
};

const findBooksByAuthorAndGenre = async (args: ArgsAllBooks) => {
  const author = await AuthorMongo.findOne({ name: args.author });
  if (!author) return [];
  const books = await BookMongo.find({
    author: author._id,
    genres: args.genre,
  });
  return books;
};

/*const findBookById = async (bookId: string) => {
  return await BookMongo.findById(bookId);
};*/

const authenticateUser = (context: Context) => {
  if (!context.currentUser) {
    throw new GraphQLError("User not authenticated.", {
      extensions: {
        message: "Authenticate yourself first.",
        code: "UNAUTHENTICATED_USER",
      },
    });
  }
};
//The resolver object is the actual implementation of the GraphQL schema.
const resolver = {
  Upload: GraphQLUpload,
  Query: {
    me: async (_root: unknown, _args: unknown, context: Context) => {
      return context.currentUser;
    },
    bookCount: async () => BookMongo.collection.countDocuments(),
    getBookById: async (_root: unknown, { bookId }: { bookId: string }) => {
      const book = await BookMongo.findById(bookId);
      return book;
    },
    getAuthorById: async (
      _root: unknown,
      { authorId }: { authorId: string }
    ) => {
      const author = await AuthorMongo.findById(authorId).populate("bookCount");
      return author;
    },
    authorCount: () => AuthorMongo.collection.countDocuments(),
    allBooks: async (_root: unknown, args: ArgsAllBooks) => {
      try {
        if (args.author && args.genre) {
          return await findBooksByAuthorAndGenre(args);
        } else if (args.author) {
          return await findBooksByAuthor(args.author);
        } else if (args.genre) {
          return await findBooksByGenre(args.genre);
        } else {
          return await BookMongo.find({});
        }
      } catch (error) {
        if (error instanceof GraphQLError)
          throw new GraphQLError("Error fetching books.", {
            extensions: { code: "INTERNAL_SERVER_ERROR", error },
          });
      }
    },

    allAuthors: async () => {
      const allAuthors = await AuthorMongo.find().populate("bookCount");

      return allAuthors;
    },
    allGenres: async () => await BookMongo.distinct("genres"),
    allUsers: async () => await Account.find({}),
    getBookImage: async (_: string, { bookId }: { bookId: ObjectId }) => {
      const book = await BookMongo.findById(bookId);
      if (!book || !book.imageId) {
        throw new GraphQLError("Book not found or image not uploaded!", {
          extensions: {
            code: "BOOK_NOT_FOUND",
          },
        });
      }
      //Get the metadata from images.files
      const file = await (globalThis.gfs as GridFSBucket)
        .find({ _id: book.imageId })
        .toArray();
      if (!file || file.length === 0) {
        throw new GraphQLError("Image file not found!", {
          extensions: {
            code: "IMAGE_FILE_NOT_FOUND",
          },
        });
      }
      const contentType = file[0].contentType;

      //Stream the image here from images.chunks (the actual image data)
      const downloadStream = (
        globalThis.gfs as GridFSBucket
      ).openDownloadStream(book.imageId);
      return new Promise((resolve, reject) => {
        const fileChunks: Buffer[] = [];
        downloadStream.on("data", (chunk) => {
          fileChunks.push(chunk);
        });
        //When the stream ends, concatenate the chunks and convert to base64.
        downloadStream.on("end", () => {
          const fileBuffer = Buffer.concat(fileChunks);
          const base64Image = fileBuffer.toString("base64");
          const dataUrl = `data:${contentType};base64,${base64Image}`;
          resolve(dataUrl);
        });
        downloadStream.on("error", (error) => {
          reject(new Error("Image retrieval failed: " + error.message));
        });
      });
    },
    getAuthorImage: async (
      _: unknown,
      { authorId }: { authorId: ObjectId }
    ) => {
      const author = await AuthorMongo.findById(authorId);
      if (!author || !author.imageId) {
        throw new GraphQLError("Author not found or image not uploaded!", {
          extensions: {
            code: "AUTHOR_NOT_FOUND",
          },
        });
      }
      //Get the metadata from images.files from Mongo
      const file = await (globalThis.gfs as GridFSBucket)
        .find({ _id: author.imageId })
        .toArray();
      //If the file is not found, throw an error.
      if (!file || file.length === 0) {
        throw new GraphQLError("Image file not found!", {
          extensions: {
            code: "IMAGE_FILE_NOT_FOUND",
          },
        });
      }
      //No other alternative but to use contentType from the first element,
      // as it returns the single file as an array.
      const contentType = file[0].contentType;

      //Stream the image here from images.chunks (the actual image data)
      const downloadStream = (
        globalThis.gfs as GridFSBucket
      ).openDownloadStream(author.imageId);

      //Return a promise that resolves to a base64 encoded image.
      return new Promise((resolve, reject) => {
        const fileChunks: Buffer[] = [];
        downloadStream.on("data", (chunk) => {
          fileChunks.push(chunk);
        });

        //When the stream ends, concatenate the chunks and convert to base64.
        downloadStream.on("end", () => {
          const fileBuffer = Buffer.concat(fileChunks);
          const base64Image = fileBuffer.toString("base64");
          const dataUrl = `data:${contentType};base64,${base64Image}`;
          resolve(dataUrl);
        });
        downloadStream.on("error", (error) => {
          reject(new Error("Image retrieval failed: " + error.message));
        });
      });
    },
  },

  Book: {
    author: async (_root: MongoAuthorBookUnion) => {
      //The root may be an Book or an author.
      //If the root is an author, return the author.
      if ("name" in _root) {
        return _root;
      } else {
        //If the root is a book, return the author.
        const author = await AuthorMongo.findById(_root.author).populate(
          "bookCount"
        );
        return author;
      }
    },
  },

  Mutation: {
    addBook: async (_root: unknown, args: AddBookArgs, context: Context) => {
      try {
        authenticateUser(context);
        //Use a helper function to validate the args.
        validateBookArgs(args);
        //Find or create the author.
        const author = await findOrCreateAuthor(args.author);
        const book = new BookMongo({ ...args, author: author });
        await book.save();
        // publish the event to the subscribers.
        pubsub.publish("AUTHOR_UPDATED", { authorUpdated: author });
        pubsub.publish("BOOK_ADDED", { bookAdded: book });

        return book;
        // Unkown doens't work here due to a bug in TypeScript.
        // Doesnt allow type narrowing.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (error: any) {
        //If a GraphQLError is thrown within the try block, it is rethrown in the catch block.
        //This catches authentication error. e.g. User not logged in.
        if (error instanceof GraphQLError) {
          throw error;
        } else if (
          error.errors.title.properties.type == "unique" &&
          error.errors.title.properties.path == "title"
        ) {
          throw new GraphQLError("Creating a book failed!", {
            extensions: {
              code: "DUPLICATE_BOOK_TITLE",
              message: "Book title " + args.title + " already exists.",
              error,
            },
          });
        } else
          throw new GraphQLError("Creating a book failed!", {
            extensions: {
              code: "INTERNAL_SERVER_ERROR",
              error,
            },
          });
      }
    },
    addAuthor: async (
      _root: unknown,
      args: AddAuthorArgs,
      context: Context
    ) => {
      try {
        authenticateUser(context);
        validateAddAuthorArgs(args);
        const newAuthor = new AuthorMongo({ ...args });
        await newAuthor.save();

        pubsub.publish("AUTHOR_ADDED", { authorAdded: newAuthor });

        return newAuthor;
      } catch (error) {
        if (
          (error as MongoError).errors?.name?.kind === "unique" &&
          (error as MongoError).errors?.name?.path === "name"
        ) {
          throw new GraphQLError("Creating an author failed!", {
            extensions: {
              code: "DUPLICATE_AUTHOR_NAME",
              message: "Author " + args.name + " already exists.",
            },
          });
        }
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError("Creating an author failed!", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            message: "Author " + args.name + " already exists.",
          },
        });
      }
    },
    editAuthor: async (
      root: unknown,
      args: AuthorSetBornArgs,
      context: Context
    ) => {
      try {
        authenticateUser(context);
        //Remember to populate the bookCount field. Will return null if not populated.

        if (!args.setBornTo) {
          throw new GraphQLError("Birth year must be provided.", {
            extensions: {
              code: "BAD_USER_INPUT",
            },
          });
        }
        if (args.setBornTo < 0)
          throw new GraphQLError("Author birth year cant be negative!", {
            extensions: {
              code: "BAD_AUTHOR_BIRTH_YEAR",
            },
          });

        const updatedAuthor = await AuthorMongo.findOneAndUpdate(
          { name: args.name },
          { $set: { born: args.setBornTo } },
          { returnDocument: "after" }
        ).populate("bookCount");

        if (!updatedAuthor) {
          throw new GraphQLError("Author not found!", {
            extensions: {
              code: "AUTHOR_NOT_FOUND",
            },
          });
        }
        // publish the event to the subscribers.
        pubsub.publish("AUTHOR_UPDATED", { authorUpdated: updatedAuthor });
        return updatedAuthor;
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        throw new GraphQLError("Editing user failed. ", {
          extensions: {
            code: "BAD_USER_INPUT || AUTHOR_NOT_FOUND",
          },
        });
      }
    },

    createUser: async (_root: unknown, args: CreateUserArgs) => {
      const saltrounds: number = 10;
      const passwordHash: string = await bcrypt.hash(args.password, saltrounds);

      const user = new Account({
        username: args.username,
        favoriteGenre: args.favoriteGenre,
        passwordHash: passwordHash,
      });

      try {
        await user.save();
        return user;
      } catch (error) {
        throw new GraphQLError("Creating an user failed!", {
          extensions: {
            code: "DUPLICATE_USERNAME",
            message:
              "Username " +
              args.username +
              " already taken. Please try another one.",
            invalidArgs: args.username,
            error,
          },
        });
      }
    },
    login: async (root: unknown, args: LoginArgs) => {
      try {
        //Validates the environment variables used for generating the token.
        validateEnvVariables();

        //Finds the user in the database.
        const user: UserMongoDB = await Account.findOne({
          username: args.username,
        });
        //If the user is not found, throw an error.
        if (!user) {
          throw new GraphQLError(
            "Login failed! Invalid credentials. Please try again.",
            {
              extensions: {
                code: "WRONG_CREDENTIALS",
                invalidArgs: args.username,
              },
            }
          );
        }
        //returns true if the password is correct.
        const passwordIsCorrect = await bcrypt.compare(
          args.password,
          user.passwordHash
        );
        //If the password is incorrect, throw an error.
        if (!passwordIsCorrect) {
          throw new GraphQLError("Login failed!", {
            extensions: {
              code: "WRONG_CREDENTIALS",
              invalidArgs: args.password,
            },
          });
        }
        return {
          //Returns the token user for auhtorization headers.
          value: generateToken(user, process.env.JWT_SECRET!),
        };
      } catch (error) {
        //If a GraphQLError is thrown within the try block, it is rethrown in the catch block.
        if (error instanceof GraphQLError) {
          throw error;
        } else if (error instanceof JwtValidationError) {
          throw error;
        }
        //If the error is not related to credentials, it is an internal server error.
        throw new GraphQLError("There was an exception trying to log you in!", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
            invalidArgs: args.username,
          },
        });
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    uploadBookImage: async (
      _: never,
      { file, bookId }: { file: FilePromise; bookId: ObjectId }
    ) => {
      try {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { createReadStream, filename, mimetype, encoding } = await file;
        const stream = createReadStream();
        //Validate the mimetype of the file.
        validateMimeTypeToBeImage(mimetype);
        const uploadStream = (globalThis.gfs as GridFSBucket).openUploadStream(
          filename,
          {
            contentType: mimetype,
          }
        );
        stream.pipe(uploadStream);

        return new Promise((resolve, reject) => {
          uploadStream.on("finish", async () => {
            const book = await BookMongo.findByIdAndUpdate(
              bookId,
              { imageId: uploadStream.id },
              { new: true }
            );
            resolve(book);
          });

          uploadStream.on("error", (error: unknown) => {
            if (error instanceof Error) {
              reject(new Error("Error uploading image!" + error.message));
            } else {
              reject(new Error("Error uploading image!" + error));
            }
          });
        });
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        else if (error instanceof JwtValidationError) {
          throw error;
        }
        throw new GraphQLError("Error in uploading image!", {
          extensions: {
            code: "INTERNAL_SERVER_ERROR",
          },
        });
      }
    },
    uploadAuthorImage: async (
      _root: unknown,
      { file, authorId }: { file: FilePromise; authorId: ObjectId }
    ) => {
      try {
        const { filename, mimetype, createReadStream } = await file;
        const stream = createReadStream();
        //Validate the mimetype of the file.
        validateMimeTypeToBeImage(mimetype);
        //Create a new upload stream for the image.
        const uploadStream = (globalThis.gfs as GridFSBucket).openUploadStream(
          filename,
          {
            contentType: mimetype,
          }
        );
        stream.pipe(uploadStream);

        return new Promise((resolve, reject) => {
          uploadStream.on("finish", async () => {
            const author = await AuthorMongo.findByIdAndUpdate(
              authorId,
              { imageId: uploadStream.id },
              { new: true }
            );
            resolve(author);
          });
          uploadStream.on("error", (error: unknown) => {
            if (error instanceof Error) {
              reject(new Error("Error uploading image!" + error.message));
            } else {
              reject(new Error("Error uploading image!" + error));
            }
          });
        });
      } catch (error) {
        if (error instanceof GraphQLError) throw error;
        /*else if (error instanceof JwtValidationError) {
          throw error;
        }*/ else {
          throw error;
        }
      }
    },
    //********USE ONLY TO CLEAR THE TEST DATABASE !!!***************/
    clearDatabase: async () => {
      if (process.env.NODE_ENV === "test") {
        const collections = await mongoose.connection.db.collections();
        for (const collection of collections) {
          await collection.deleteMany({});
        }
        return;
      }
      return;
    },
  },

  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator("BOOK_ADDED"),
    },
    authorUpdated: {
      subscribe: () => pubsub.asyncIterator("AUTHOR_UPDATED"),
    },
    authorAdded: {
      subscribe: () => pubsub.asyncIterator("AUTHOR_ADDED"),
    },
  },
};
module.exports = resolver;
