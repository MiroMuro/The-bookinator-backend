const typeDefs = require("./schema");
const resolvers = require("./resolver");
import * as http from "http";
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();

const MONGODB_URI = process.env.MONGODB_URI;
const { createServer, InitializeMongoDB } = require("./server");
import { ServerType } from "./types/interfaces";
import { MongooseError } from "mongoose";

const startApplication = async () => {
  try {
    await InitializeMongoDB();
    const serverSetup: ServerType = await createServer(typeDefs, resolvers);
    const httpServer: http.Server = serverSetup.httpServer;

    const PORT = process.env.PORT || 4000;
    httpServer.listen(PORT, () => {
      console.log(`Server is running on http://localhost:${PORT}`);
    });
  } catch (error: any) {
    if (error instanceof MongooseError) {
      console.log("Error connecting to MongoDB: ", error.message);
    } else {
      console.log("Error starting the application: ", error.message);
    }
  }
};

startApplication();
