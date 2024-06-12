const { GraphQLError } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const BookMongo = require("./models/Book");
const AuthorMongo = require("./models/Author");
const Account = require("./models/User");
const bcrypt = require("bcrypt");
const pubsub = new PubSub();
const jsonwebtoken = require("jsonwebtoken");
import {
  Context,
  ArgsAllBooks,
  MongoAuthorBookUnion,
  AuthorSetBornArgs,
  UserMongoDB,
  AddBookArgs,
  /*UserInfo,*/
  LoginArgs,
  CreateUserArgs,
} from "./types/interfaces";
//Helper functions for the login mutation.
const generateToken = (user: UserMongoDB, secret: string) => {
  const userForToken = {
    username: user.username,
    id: user._id,
  };
  return jsonwebtoken.sign(userForToken, secret, { expiresIn: "1h" });
};

const validateEnvVariables = (): void => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET not defined");
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
  if (!args.genres.length) {
    throw new GraphQLError("Creating a book failed!", {
      extensions: {
        message: "Book must have at least one genre!",
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
const resolver = {
  Query: {
    me: async (_root: unknown, _args: unknown, context: Context) => {
      return context.currentUser;
    },
    bookCount: async () => BookMongo.collection.countDocuments(),
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
        console.log(error);
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
      } catch (error) {
        //If a GraphQLError is thrown within the try block, it is rethrown in the catch block.
        //This catches authentication error. e.g. User not logged in.
        if (error instanceof GraphQLError) {
          throw error;
        }
        throw new GraphQLError("Creating book failed! ", {
          extensions: {
            code: "Bad user input.",
            error,
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
        const updatedAuthor = await AuthorMongo.findOneAndUpdate(
          { name: args.name },
          { $set: { born: args.setBornTo } },
          { returnDocument: "after" }
        ).populate("bookCount");

        if (!updatedAuthor) {
          throw new GraphQLError("Author not found!. ", {
            extensions: {
              code: "AUTHOR_NOT_FOUND",
            },
          });
        }
        // publish the event to the subscribers.
        pubsub.publish("AUTHOR_UPDATED", { authorUpdated: updatedAuthor });
        return updatedAuthor;
      } catch (error) {
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
        throw new GraphQLError("Creating an user failed. ", {
          extensions: {
            code: "INVALID ARGUMENTS",
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
          throw new GraphQLError("Login failed!", {
            extensions: {
              code: "WRONG_CREDENTIALS",
              invalidArgs: args.username,
            },
          });
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
        console.log("Error during login: ", error);
        if (error instanceof GraphQLError) {
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
    /*logout: (parent, args, context) => {
      // If you're using sessions, you can destroy the session here.
      if (context.req && context.req.session) {
        context.req.session.destroy((err) => {
          if (err) {
            throw new Error("Failed to log out");
          }
        });
      }

      // Invalidate JWT token by simply returning true since it's stateless.
      // Actual invalidation should be handled on the client-side by removing the token.
      return true;
    },*/
  },
  Subscription: {
    bookAdded: {
      subscribe: () => pubsub.asyncIterator("BOOK_ADDED"),
    },
    authorUpdated: {
      subscribe: () => pubsub.asyncIterator("AUTHOR_UPDATED"),
    },
  },
};
module.exports = resolver;
