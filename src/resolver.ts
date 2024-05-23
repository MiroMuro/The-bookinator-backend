const { GraphQLError } = require("graphql");
const { PubSub } = require("graphql-subscriptions");
const BookMongo = require("./models/Book");
const AuthorMongo = require("./models/Author");
const Account = require("./models/User");
const bcrypt = require("bcrypt");
const pubsub = new PubSub();
const jsonwebtoken = require("jsonwebtoken");
const resolver = {
  Query: {
    me: async (_root: any, _args: any, context: any) => {
      return context.currentUser;
    },
    bookCount: async () => BookMongo.collection.countDocuments(),
    authorCount: () => AuthorMongo.collection.countDocuments(),
    allBooks: async (_root: any, args: { author: string; genre: string }) => {
      console.log("The genre: ", args.genre);
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
        console.log("ARGS", args);
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
          return bookslol;
        } catch (error) {
          console.log(error);
          return null;
        }
      }

      return await BookMongo.find({});
    },
    allAuthors: async () => {
      const allAuthors = await AuthorMongo.find().populate("bookCount");

      return allAuthors;
    },
    allGenres: async () => await BookMongo.distinct("genres"),
  },

  Book: {
    author: async (_root: any, _args: any) => {
      //The root may be an Book or an author.
      console.log("The root: ", _root);
      if (!_root.author.name) {
        try {
          const bookToFind = await AuthorMongo.findOne({ _id: _root.author });
          return bookToFind;
        } catch (error) {
          console.log("Something went wrong mate");
        }
      } else {
        return _root.author;
      }
    },
  },
  Author: {
    id: async (root: any) => root._id,
  },
  Mutation: {
    addBook: async (
      _root: any,
      args: any,
      { currentUser }: { currentUser: any }
    ) => {
      if (!currentUser) {
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
        let author = await AuthorMongo.findOne({ name: args.author });
        if (!author) {
          author = new AuthorMongo({ name: args.author });
          //Existing author not found, Creating and saving new author,
          await author.save();
        }
        const book = new BookMongo({ ...args, author: author });

        await book.save();
        //Publishing the event and object to the subscribers.
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
      args: { name: string; setBornTo: number },
      { currentUser }: { currentUser: any }
    ) => {
      console.log("Current user: ", currentUser);
      console.log("Args: ", args);
      if (!currentUser) {
        throw new GraphQLError("User not authenticated.", {
          extensions: {
            code: "Authenticate yourself first.",
          },
        });
      }
      try {
        const updatedAuthor = await AuthorMongo.collection.findOneAndUpdate(
          { name: args.name },
          { $set: { born: args.setBornTo } },
          { returnDocument: "after" }
        );
        console.log("Updated author: ", updatedAuthor);
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

    createUser: async (_root: any, args: any) => {
      const saltrounds = 10;
      const passwordHash = await bcrypt.hash(args.password, saltrounds);

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
            invalidArgs: args.name,
            error,
          },
        });
      }
    },
    login: async (_root: any, args: any) => {
      const user = await Account.findOne({ username: args.username });

      const passwordIsCorrect = await bcrypt.compare(
        args.password,
        user.passwordHash
      );
      if (user && passwordIsCorrect) {
        const userForToken = {
          username: user.username,
          id: user._id,
        };

        return {
          value: jsonwebtoken.sign(userForToken, process.env.JWT_SECRET),
        };
      } else {
        throw new GraphQLError("Login failed!", {
          extensions: {
            code: "WRONG_CREDENTIALS",
            invalidArgs: args.name,
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
