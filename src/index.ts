const { ApolloServer } = require("@apollo/server");

const { expressMiddleware } = require("@apollo/server/express4");
const {
  ApolloServerPluginDrainHttpServer,
} = require("@apollo/server/plugin/drainHttpServer");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();
const jwt = require("jsonwebtoken");
const User = require("./models/User");
const MONGODB_URI = process.env.MONGODB_URI;
const resolvers = require("./resolver");
const typeDefs = require("./schema");
console.log("Connecting to MongoDB, URI: ", MONGODB_URI);
mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("Connection established to MongoDB");
  })
  .catch((error: any) => {
    console.log("Error connecring to MongoDB: ", error.message);
  });

const start = async () => {
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });
  const options = {
    setHeaders: (
      res: { set: (arg0: string, arg1: string) => void },
      path: any,
      stat: any
    ) => {
      res.set("Access-Control-Allow-Origin", "ws://localhost:4000/");
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const serverCleanup = useServer({ schema }, wsServer);

  const server = new ApolloServer({
    schema,
    plugins: [
      ApolloServerPluginDrainHttpServer({ httpServer }),
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

  await server.start();
  app.use(
    "/",
    cors(),
    express.static("build", options),
    express.json(),
    expressMiddleware(server, {
      //Currentuser is the context that is passed to the resolvers as third parameter.
      context: async ({ req, _res }: { req: any; _res: unknown }) => {
        _res;
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
  const PORT = 4000;
  httpServer.listen(PORT, () =>
    console.log(`Server is now running on http://localhost:${PORT}`)
  );
};
start();
