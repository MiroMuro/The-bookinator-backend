//Importing these modules seems to execute the index.ts file,
//
//const start = require("../index");
import request from "supertest";
import express from "express";
const { expressMiddleware } = require("@apollo/server/express4");
const User = require("../models/User");
const Book = require("../models/Book"); // Assuming you have a Book model
const Author = require("../models/Author"); // Assuming you have an Author model
const cors = require("cors");
const jwt = require("jsonwebtoken");
const MONGODB_URI = process.env.MONGODB_URI;
const mongoose = require("mongoose");
require("dotenv").config();

const { server, app, httpServer, wsServer } = require("../server");
//User for testing.
const testUser = {
  username: "testUser1",
  password: "testPassword",
  favoriteGenre: "testGenre",
};
beforeAll(async () => {
  //Set up the database for the tests.
  await mongoose
    .connect(
      "mongodb+srv://mssl2000:90cZUt5J1CMajhGt@miro.oyuedl2.mongodb.net/?retryWrites=true&w=majority&appName=miro"
    )
    .then(() => {
      console.log("Connection established to MongoDB");
    })
    .catch((error: any) => {
      console.log("Error connecring to MongoDB: ", error.message);
    });
  //Clear the colletions before running the tests.
  await User.deleteMany({});
  await Book.deleteMany({});
  await Author.deleteMany({});

  //Start the server.
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
});
afterAll(async () => {
  await server.stop();
  await httpServer.close();
  await mongoose.connection.close();
});

describe("Apollo Server", () => {
  it("An user can be created", async () => {
    const mutation = `
    mutation {
      createUser(username: "${testUser.username}", password: "${testUser.password}", favoriteGenre: "${testUser.favoriteGenre}") {
        username
        favoriteGenre
        id
      }
    }
  `;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("x-apollo-operation-name", "createUser")
      .send({ query: mutation });

    const { data, errros } = response.body;

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.createUser.username).toBe(testUser.username);
    expect(data.createUser.favoriteGenre).toBe(testUser.favoriteGenre);
    expect(data.createUser.id).toBeDefined();
  }),
    it("An user can be logged in", async () => {});
  it("should respond to a simple query", async () => {
    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("x-apollo-operation-name", "allGenres")
      .send('{"query":"query { allGenres }"}');
    console.log("Response body data: ", response.body.data);
    expect(response.status).toBe(200);
    expect(response.body.data).toBeDefined();
  });
});
export {};
