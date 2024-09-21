import express from "express";
import { ServerType } from "./types/interfaces";
import * as http from "http";
import { DocumentNode } from "graphql";
import { ResolversTypes } from "./utils/codegen/graphql";
const { graphqlUploadExpress } = require("graphql-upload-ts");
const { ApolloServer } = require("@apollo/server");
const { expressMiddleware } = require("@apollo/server/express4");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const Express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const Book = require("./models/Book");
const Author = require("./models/Author");
const MONGODB_URI = process.env.MONGODB_URI;
const { MongoMemoryServer } = require("mongodb-memory-server");
let mongoTestServer: typeof MongoMemoryServer;
import { MongooseError } from "mongoose";
mongoose.set("strictQuery", false);
require("dotenv").config();

const initializeTestMongoServer = async () => {
  mongoTestServer = await MongoMemoryServer.create();
  const uri: string = await mongoTestServer.getUri();
  console.log("Test MongoDB URI: ", uri);
  mongoose.connect(uri, {});
  mongoose.connection.once("open", () => {
    globalThis.gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "images",
    });
  });
  await User.deleteMany({});
  await Book.deleteMany({});
  await Author.deleteMany({});
  console.log("Does this exist? " + globalThis.gfs ? "Yes" : "No");
};

const InitializeMongoDB = async () => {
  console.log("Connecting to MongoDB...");
  mongoose
    .connect(MONGODB_URI)
    .then(() => {
      console.log("Connection established to MongoDB");
    })
    .catch((error: MongooseError) => {
      console.log("Error connecring to MongoDB: ", error.message);
    });
  mongoose.connection.once("open", () => {
    globalThis.gfs = new mongoose.mongo.GridFSBucket(mongoose.connection.db, {
      bucketName: "images",
    });
  });
  console.log("Does this exist? " + globalThis.gfs ? "Yes" : "No");
};

const createServer = async (
  typeDefs: DocumentNode,
  resolvers: ResolversTypes
): Promise<ServerType> => {
  // Initialize an Express application
  // Express is a minimal and flexible Node.js web application framework that provides a robust set of features for web and mobile applications.
  // It is used here to create an HTTP server and to configure middleware for handling requests.
  const app: express.Application = Express();
  // Create an HTTP server using the Express application
  const httpServer: http.Server = http.createServer(app);

  // Create a WebSocket server to handle real-time communication (subscriptions)

  // It's attached to the same HTTP server and listens on the root path
  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });

  // Create a GraphQL schema using the provided type definitions and resolvers
  const schema = makeExecutableSchema({ typeDefs, resolvers });
  // Initialize the WebSocket server with the GraphQL schema

  // This function returns a cleanup function that we can call when the server is shutting down
  const serverCleanup = useServer({ schema }, wsServer);

  // Create an Apollo Server with the GraphQL schema
  // The server is configured with two plugins:
  // - ApolloServerPluginDrainHttpServer: This plugin ensures that all in-flight requests are finished before the server shuts down
  // - A custom plugin that calls the cleanup function for the WebSocket server when the Apollo Server is shutting down

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer: httpServer }),
      {
        async serverWillStart() {
          return {
            async drainServer() {
              await serverCleanup.dispose();
            },
          };
        },
      },
    ],
  });
  //Start the servers.
  await server.start();

  //health check for deployment
  app.get("/health", (req, res) => {
    res.send("Server is running");
  });
  if (process.env.NODE_ENV === "test") {
    app.get("/testing", (req, res) => {
      res.send("Server running in test mode");
    });
  }
  // Configure the Express application
  // The application is configured to use the following middleware:
  // - CORS: This middleware allows cross-origin requests
  // - express.json(): This middleware parses incoming requests with JSON payloads
  // - expressMiddleware: This middleware connects the Express application with the Apollo Server
  // The context function is used to provide context for each GraphQL operation
  app.use(
    "/",
    cors({
      origin: "*",
    }),
    graphqlUploadExpress({ maxFileSize: 10000000, maxFiles: 10 }),
    express.json(),
    expressMiddleware(server, {
      // The context function is used to provide context for each GraphQL operation
      // It checks if there's an Authorization header in the request
      // If there is, it verifies the JWT and finds the user associated with the JWT
      // The user is then added to the context, so it can be accessed in the resolvers
      context: async ({
        req,
        res,
      }: {
        req: express.Request;
        res: express.Response;
      }) => {
        const auth = req ? req.headers.authorization : null;
        if (auth && auth.startsWith("bearer ")) {
          try {
            const decodedToken = jwt.verify(
              auth.substring(7),
              process.env.JWT_SECRET
            );
            const currentUser = await User.findById(decodedToken.id);
            return { currentUser };
          } catch (error) {
            // If the JWT is invalid, the user is set to null.
            // Edit the error object to send an error response to the client with a message
            // that the user was timed out
            const errorObject =
              typeof error === "object" && error !== null
                ? error
                : { message: String(error) };
            res.status(401).send({
              ...errorObject,
              messageForUser:
                "You were timed out. Please login again or continue as a guest.",
            });
            return { currentUser: null };
          }
        }
      },
    })
  );

  return { server, app, httpServer, wsServer, schema };
};

module.exports = { createServer, InitializeMongoDB, initializeTestMongoServer };
