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
  UserInfo,
  LoginArgs,
} from "./types/interfaces";
const resolver = {
  Query: {
    me: async (_root: unknown, _args: {}, context: Context) => {
      console.log("Context: ", context);
      return context.currentUser;
    },
    bookCount: async () => BookMongo.collection.countDocuments(),
    authorCount: () => AuthorMongo.collection.countDocuments(),
    allBooks: async (_root: unknown, args: ArgsAllBooks) => {
      console.log("Args: ", args);
      //If both args are present
      if (args.author && args.genre) {
        try {
          const authorFind = await AuthorMongo.findOne({
            name: args.author,
          });
          if (!authorFind) {
            return [];
          }
          const booksFound = await BookMongo.find({
            genres: args.genre,
            author: authorFind._id,
          });
          return booksFound;
        } catch (error) {
          console.log(error);
          return null;
        }
        //only if author args is present.
      } else if (args.author) {
        try {
          const authorFind = await AuthorMongo.findOne({
            name: args.author,
          });
          return await BookMongo.find({ author: authorFind._id });
        } catch (error) {
          console.log(error);
          return null;
        }
      } else if (args.genre) {
        try {
          const bookslol = await BookMongo.find({ genres: args.genre });
          console.log();
          return bookslol;
        } catch (error) {
          console.log(error);
          return null;
        }
      }
      console.log("No args");
      return await BookMongo.find({});
    },
    allAuthors: async () => {
      const allAuthors = await AuthorMongo.find().populate("bookCount");

      return allAuthors;
    },
    allGenres: async () => await BookMongo.distinct("genres"),
  },

  Book: {
    author: async (_root: MongoAuthorBookUnion, _args: any) => {
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
  Author: {
    id: async (root: any) => root._id,
  },
  Mutation: {
    addBook: async (_root: unknown, args: AddBookArgs, context: Context) => {
      if (!context.currentUser) {
        throw new GraphQLError("User not authenticated.", {
          extensions: {
            code: "Authenticate yourself first.",
          },
        });
      }
      if (args.author.length < 4) {
        throw new GraphQLError("Bad user input!", {
          extensions: {
            code: "Author name too short!",
          },
        });
      }
      if (args.title.length < 5) {
        throw new GraphQLError("Bad user input!", {
          extensions: {
            code: "Book title too short!",
          },
        });
      }
      try {
        //The bookcount must be populated to be able to increment it.
        //The manual increment is needed HERE because bookCount only refreshes when
        //All authors are re-fetched. e.g. after the book is saved.
        let author = await AuthorMongo.findOne({ name: args.author }).populate(
          "bookCount"
        );
        console.log("Author first: ", author);
        if (!author) {
          author = new AuthorMongo({ name: args.author, bookCount: 0 });
          console.log("Author second: ", author);
          //Existing author not found, Creating and saving new author,
          await author.save();
        }
        author.bookCount += 1;
        await author.save();
        console.log("Author: ", author.bookCount);
        const book = new BookMongo({ ...args, author: author });
        await book.save();
        // publish the event to the subscribers.
        pubsub.publish("AUTHOR_UPDATED", { authorUpdated: author });
        pubsub.publish("BOOK_ADDED", { bookAdded: book });

        return book;
      } catch (error) {
        throw new GraphQLError("Creating book failed! ", {
          extensions: {
            code: "Bad user input.",
            error,
          },
        });
      }
    },
    editAuthor: async (
      _root: any,
      args: AuthorSetBornArgs,
      context: Context
    ) => {
      if (!context.currentUser) {
        throw new GraphQLError("User not authenticated.", {
          extensions: {
            code: "Authenticate yourself first.",
          },
        });
      }
      try {
        //Remember to populate the bookCount field. Will return null if not populated.
        const updatedAuthor = await AuthorMongo.findOneAndUpdate(
          { name: args.name },
          { $set: { born: args.setBornTo } },
          { returnDocument: "after" }
        ).populate("bookCount");
        // publish the event to the subscribers.
        pubsub.publish("AUTHOR_UPDATED", { authorUpdated: updatedAuthor });
        if (!updatedAuthor) {
          throw new GraphQLError("Editing user failed. ", {
            extensions: {
              code: "BAD_USER_INPUT || AUTHOR_NOT_FOUND",
            },
          });
        }
        return updatedAuthor;
      } catch (error) {
        throw new GraphQLError("Editing user failed. ", {
          extensions: {
            code: "BAD_USER_INPUT || AUTHOR_NOT_FOUND",
          },
        });
      }
    },

    createUser: async (_root: unknown, args: UserInfo) => {
      const saltrounds: number = 10;
      const passwordHash: string = await bcrypt.hash(
        args.credentials.password,
        saltrounds
      );

      const user = new Account({
        username: args.credentials.username,
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
            invalidArgs: args.credentials.username,
            error,
          },
        });
      }
    },
    login: async (_root: any, args: LoginArgs) => {
      const generateToken = (user: UserMongoDB, secret: string | undefined) => {
        if (secret === undefined) throw new Error("JWT_SECRET not defined");
        const userForToken = {
          username: user.username,
          id: user._id,
        };
        return jsonwebtoken.sign(userForToken, secret, { expiresIn: "1h" });
      };

      const validateEnvVariables = () => {
        if (!process.env.JWT_SECRET) {
          throw new Error("JWT_SECRET not defined");
        }
      };

      try {
        validateEnvVariables();

        const user = await Account.findOne({ username: args.username });

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

        if (!passwordIsCorrect) {
          throw new GraphQLError("Login failed!", {
            extensions: {
              code: "WRONG_CREDENTIALS",
              invalidArgs: args.username,
            },
          });
        }
        return {
          //Returns the token user for auhtorization headers.
          value: generateToken(user, process.env.JWT_SECRET),
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
