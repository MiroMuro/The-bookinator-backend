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
const https = require("https");
const http = require("http");

const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();
const jwt = require("jsonwebtoken");
const fs = require("fs");
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
  /* Load SSL certificates
  const privateKey = fs.readFileSync("certificates/private.key", "utf8");
  const certificate = fs.readFileSync("certificates/certificate.crt", "utf8");

  const credentials = { key: privateKey, cert: certificate };
*/
  const app = express();
  const httpServer = http.createServer(app);

  const wsServer = new WebSocketServer({
    server: httpServer,
    path: "/",
  });

  console.log("Starting webscoket server ", wsServer);
  const options = {
    setHeaders: (
      res: { set: (arg0: string, arg1: string) => void },
      path: any,
      stat: any
    ) => {
      res.set("Access-Control-Allow-Origin", "*");
    },
  };

  const schema = makeExecutableSchema({ typeDefs, resolvers });
  const serverCleanup = useServer({ schema }, wsServer);

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

  await server.start();
  app.use(
    "/",
    cors({
      origin: "*",
    }),
    express.json(),
    //express.static("build", options),

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
  const PORT = 4000 || process.env.PORT;
  httpServer.listen(PORT, () =>
    console.log(`Server is now running on https://localhost:${PORT}`)
  );
};
start();
