import express from "express";
import { ServerType } from "./types/interfaces";
import * as http from "http";
import { DocumentNode } from "graphql";
import { ResolversTypes } from "./utils/codegen/graphql";
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
mongoose.set("strictQuery", false);
require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("./models/User");

const MONGODB_URI = process.env.MONGODB_URI;
import { MongooseError } from "mongoose";

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

  // Configure the Express application
  // The application is configured to use the following middleware:
  // - CORS: This middleware allows cross-origin requests
  // - express.json(): This middleware parses incoming requests with JSON payloads
  // - expressMiddleware: This middleware connects the Express application with the Apollo Server
  // The context function is used to provide context for each GraphQL operation
  app.get("/health", (_req, res) => {
    res.send("OK");
  });
  app.get("/ready", (req, res) => {
    res.send("REEEADDYYYY");
  });
  app.use(
    "/",
    cors({
      origin: "*",
    }),
    express.json(),
    expressMiddleware(server, {
      // The context function is used to provide context for each GraphQL operation
      // It checks if there's an Authorization header in the request
      // If there is, it verifies the JWT and finds the user associated with the JWT
      // The user is then added to the context, so it can be accessed in the resolvers
      context: async ({ req }: { req: express.Request }) => {
        const auth = req ? req.headers.authorization : null;
        if (auth && auth.startsWith("bearer ")) {
          const decodedToken = jwt.verify(
            auth.substring(7),
            process.env.JWT_SECRET
          );
          const currentUser = await User.findById(decodedToken.id);
          return { currentUser };
        }
      },
    })
  );

  return { server, app, httpServer, wsServer, schema };
};

module.exports = { createServer, InitializeMongoDB };
