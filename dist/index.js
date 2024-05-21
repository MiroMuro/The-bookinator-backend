"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
const { ApolloServer } = require("@apollo/server");
//const { startStandaloneServer } = require("@apollo/server/standalone");
//const { v4: uuidv4 } = require("uuid");
const { expressMiddleware } = require("@apollo/server/express4");
const { ApolloServerPluginDrainHttpServer, } = require("@apollo/server/plugin/drainHttpServer");
const { makeExecutableSchema } = require("@graphql-tools/schema");
const { WebSocketServer } = require("ws");
const { useServer } = require("graphql-ws/lib/use/ws");
const express = require("express");
const cors = require("cors");
const http = require("http");
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();
//const uuid = uuidv4();
const jwt = require("jsonwebtoken");
const User = require("./models/user");
const MONGODB_URI = process.env.MONGODB_URI;
const resolvers = require("./resolver");
const typeDefs = require("./schema");
console.log("Connecting to MongoDB, URI: ", MONGODB_URI);
mongoose
    .connect(MONGODB_URI)
    .then(() => {
    console.log("Connection established to MongoDB");
})
    .catch((error) => {
    console.log("Error connecring to MongoDB: ", error.message);
});
const start = () => __awaiter(void 0, void 0, void 0, function* () {
    const app = express();
    const httpServer = http.createServer(app);
    const wsServer = new WebSocketServer({
        server: httpServer,
        path: "/",
    });
    const schema = makeExecutableSchema({ typeDefs, resolvers });
    const serverCleanup = useServer({ schema }, wsServer);
    const server = new ApolloServer({
        schema,
        plugins: [
            ApolloServerPluginDrainHttpServer({ httpServer }),
            {
                serverWillStart() {
                    return __awaiter(this, void 0, void 0, function* () {
                        return {
                            drainServer() {
                                return __awaiter(this, void 0, void 0, function* () {
                                    yield serverCleanup.dispose();
                                });
                            },
                        };
                    });
                },
            },
        ],
    });
    yield server.start();
    app.use("/", cors(), express.json(), expressMiddleware(server, {
        context: (_a) => __awaiter(void 0, [_a], void 0, function* ({ req, _res }) {
            _res;
            const auth = req ? req.headers.authorization : null;
            if (auth && auth.startsWith("bearer ")) {
                const decodedToken = jwt.verify(auth.substring(7), process.env.JWT_SECRET);
                const currentUser = yield User.findById(decodedToken.id);
                return { currentUser };
            }
        }),
    }));
    const PORT = 4000;
    httpServer.listen(PORT, () => console.log(`Server is now running on http://localhost:${PORT}`));
});
start();
