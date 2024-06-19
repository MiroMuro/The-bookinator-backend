// server.test.js
const request = require("supertest");
const { createServer } = require("../server");
const resolvers = require("../resolver");
const User = require("../models/User");
const Book = require("../models/Book");
const Author = require("../models/Author");
//const { createClient, Client } = require("graphql-ws");
const { MongoMemoryServer } = require("mongodb-memory-server");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
//const WebSocket = require("ws");
//const { execute, parse } = require("graphql");
import { readFileSync } from "fs";
import { join } from "path";
import { gql } from "graphql-tag";
import { DocumentNode } from "graphql";
import * as http from "http";
import { testUser, ServerType } from "../types/interfaces";
//import { books } from "./testdata";
//import exp from "constants";
dotenv.config();

let logintoken: string;
const PORT = process.env.PORT || 4000;
let mongoServer: typeof MongoMemoryServer;
let app: Express.Application;
let httpServer: http.Server;
let serverSetup: ServerType;
const user: testUser = {
  username: "testUser1",
  password: "testPassword",
  favoriteGenre: "testGenre",
};
//Websocket client for testing subscriptions.
/*const client: typeof Client = createClient({
  url: `ws://localhost:${PORT}/`,
  webSocketImpl: WebSocket,
});*/
const typeDefs: DocumentNode = gql(
  readFileSync(join("src/", "schema.graphql"), "utf8")
);

/*Helpe function for adding books.
const createAddBookMutation = (book: AddBookArgs) => {
  return `mutation {
    addBook(title: "${book.title}", author: "${book.author}", published: ${
    book.published
  }, genres: ${JSON.stringify(book.genres)}){
      title
      author {
        name
        bookCount
      }
      published
      genres
    }
  }
    `;
};/*/
/*Query creator function for adding books.
const addBook = async (mutation: string) => {
  const response = await request(app)
    .post("/")
    .set("Content-Type", "application/json")
    .set("Authorization", `bearer ${logintoken}`)
    .send({ query: mutation });

  return response;
};*/

beforeAll(async () => {
  //Create a new in-memory Mongodatabase before running tests.
  mongoServer = await MongoMemoryServer.create();
  const uri: string = mongoServer.getUri();

  await mongoose.connect(uri, {});

  await User.deleteMany({});
  await Book.deleteMany({});
  await Author.deleteMany({});
  //Setup a new server for testing
  serverSetup = await createServer(typeDefs, resolvers);
  app = serverSetup.app;
  httpServer = serverSetup.httpServer;
  await new Promise<void>((resolve) =>
    httpServer.listen(PORT, () => resolve())
  );
  console.log(`Server is running on http://localhost:${PORT}`);
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
  //(await wsClient) && wsClient.dispose();
  httpServer.close();
});

describe("Apollo Server", () => {
  it("should create a user", async () => {
    const mutation = `
      mutation {
        createUser(username: "${user.username}", password: "${user.password}", favoriteGenre: "${user.favoriteGenre}") {
          username
          favoriteGenre
          id
        }
      }
    `;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send({ query: mutation });

    const { data } = response.body;
    console.log("Data from createUser test: ", data);
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.createUser).toBeDefined();
    expect(data.createUser.username).toBe(user.username);
    expect(data.createUser.favoriteGenre).toBe(user.favoriteGenre);
    expect(data.createUser.id).toBeDefined();
  });
  it("is successful and returns an authorization token", async () => {
    const loginMutation = `
        mutation {
        login(username: "${user.username}", password: "${user.password}"){
          value
        }
      }
      `;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send({ query: loginMutation });
    const { data } = response.body;
    console.log("Data from Login test: ", data);
    expect(response.status).toBe(200);
    expect(data.login.value).toBeDefined();
    logintoken = data.login.value;
    console.log("Login token: ", logintoken);
  });
  it("fails with wrong username", async () => {
    const badCredentialsLoginMutation = `
        mutation {
        login(username: "${"wrongUsername"}", password: "${user.password}"){
          value
        }
      }`;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send({ query: badCredentialsLoginMutation });

    const { data } = response.body;
    const [errors] = response.body.errors;

    expect(response.status).toBe(200);
    expect(data.login).toBeNull();
    expect(errors.message).toBe("Login failed!");
    expect(errors.extensions.code).toBe("WRONG_CREDENTIALS");
    expect(errors.extensions.invalidArgs).toBe("wrongUsername");
  });
  it("fails with wrong password", async () => {
    const badCredentialsLoginMutation = `
        mutation {
        login(username: "${user.username}", password: "${"wrongPassword"}"){
          value
        }
      }`;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send({ query: badCredentialsLoginMutation });

    const { data } = response.body;
    const [errors] = response.body.errors;

    expect(response.status).toBe(200);
    expect(data.login).toBeNull();
    expect(errors.message).toBe("Login failed!");
    expect(errors.extensions.code).toBe("WRONG_CREDENTIALS");
    expect(errors.extensions.invalidArgs).toBe("wrongPassword");
  });
});

export {};
