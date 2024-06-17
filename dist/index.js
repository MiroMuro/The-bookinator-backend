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
Object.defineProperty(exports, "__esModule", { value: true });
//const typeDefs = require("./schema");
const resolvers = require("./resolver");
const fs_1 = require("fs");
const path_1 = require("path");
const graphql_tag_1 = require("graphql-tag");
require("dotenv").config();
const { createServer, InitializeMongoDB } = require("./server");
const mongoose_1 = require("mongoose");
const startApplication = () => __awaiter(void 0, void 0, void 0, function* () {
    try {
        //Read the schema
        const typeDefs = (0, graphql_tag_1.gql)((0, fs_1.readFileSync)((0, path_1.join)(__dirname, "schema.graphql"), "utf8"));
        //Initialize the MongoDB connection.
        yield InitializeMongoDB();
        //Create the http and websocket servers.
        const serverSetup = yield createServer(typeDefs, resolvers);
        const httpServer = serverSetup.httpServer;
        //Start the server.
        const PORT = process.env.PORT || 4000;
        httpServer.listen(PORT, () => {
            console.log(`Server is running on http://localhost:${PORT}`);
        });
    }
    catch (error) {
        if (error instanceof mongoose_1.MongooseError) {
            console.log("Error connecting to MongoDB: ", error.message);
        }
        else if (error instanceof Error) {
            console.log("Error starting the application: ", error.message);
        }
    }
});
startApplication();
