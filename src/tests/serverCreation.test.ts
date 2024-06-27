// server.test.js
const request = require("supertest");
const { createServer } = require("../server");
const resolvers = require("../resolver");
const User = require("../models/User");
const Book = require("../models/Book");
const Author = require("../models/Author");
const { createClient, Client } = require("graphql-ws");
const { MongoMemoryServer } = require("mongodb-memory-server");
const dotenv = require("dotenv");
const mongoose = require("mongoose");
const WebSocket = require("ws");
//const { execute, parse } = require("graphql");
import { readFileSync } from "fs";
import { join } from "path";
import { gql } from "graphql-tag";
import { DocumentNode } from "graphql";
import * as http from "http";
import { testUser, ServerType, AddBookArgs } from "../types/interfaces";
import { books } from "./testdata";
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
const client: typeof Client = createClient({
  url: `ws://localhost:${PORT}/`,
  webSocketImpl: WebSocket,
});
const typeDefs: DocumentNode = gql(
  readFileSync(join("src/", "schema.graphql"), "utf8")
);

//Helpe function for adding books.
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
};
//Query creator function for adding books.
const addBook = async (mutation: string) => {
  const response = await request(app)
    .post("/")
    .set("Content-Type", "application/json")
    .set("Authorization", `bearer ${logintoken}`)
    .send({ query: mutation });

  return response;
};

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
  await new Promise<void>((resolve) => httpServer.listen(PORT, resolve));
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
    expect(response.status).toBe(200);
    expect(data.login.value).toBeDefined();
    logintoken = data.login.value;
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
    expect(errors.message).toBe(
      "Login failed! Invalid credentials. Please try again."
    );
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
describe("A book", () => {
  it("CANT be added by an unauthenticated user, and returns correct errors.", async () => {
    const book = books[0];
    const mutation = `
      mutation {
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
    //Omit the authorization token, to simulate an unauthenticated user.
    //e.g an user that is not logged in.
    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .send({ query: mutation });

    const { data } = response.body;
    const [errors] = response.body.errors;
    expect(response.status).toBe(200);
    expect(errors.message).toBe("User not authenticated.");
    expect(errors.extensions.code).toBe("UNAUTHENTICATED_USER");
    expect(errors.extensions.message).toBe("Authenticate yourself first.");
    expect(data.value).toBeUndefined();
  });
  it("Can be added by an authenticated user and Author bookcount is updated correctly", async () => {
    const book = books[0];
    const mutation = createAddBookMutation(book);
    const response = await addBook(mutation);
    const { data } = response.body;

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.addBook).toBeDefined();
    expect(data.addBook.title).toBe(book.title);
    expect(data.addBook.author).toStrictEqual({
      name: book.author,
      bookCount: 1,
    });
    expect(data.addBook.published).toBe(book.published);
    expect(data.addBook.genres).toEqual(book.genres);
  });

  it("Can be fetched correctly", async () => {
    //The added book should be the first book in the array.
    //It needs to be added a bookcount property to the author object.
    const addedBook = {
      ...books[0],
      author: { name: books[0].author, bookCount: 1 },
    };
    const query = `
        query {
          allBooks{
            title
            author {
              name
              bookCount
            }
            genres
            published
            title
        }
      }`;

    const response = await request(app).post("/").send({ query: query });
    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.allBooks).toBeDefined();
    expect(data.allBooks[0]).toEqual(addedBook);
  });
  it("Can be fetched correctly with a genre filter", async () => {
    //Add some more books to test the genre filter.
    const secondBook = books[3];
    const thirdBook = books[4];
    const secondMutation = createAddBookMutation(secondBook);
    const thirdMutation = createAddBookMutation(thirdBook);
    await addBook(secondMutation);
    await addBook(thirdMutation);
    const expectedResult = [
      { ...books[0], author: { name: books[0].author, bookCount: 1 } },
      { ...books[3], author: { name: books[3].author, bookCount: 1 } },
    ];
    const booksByGenreQuery = `
        query {
          allBooks(genre: "${"Horror"}"){
            title
            author {
              name
              bookCount
            }
            genres
            published
            title
        }
      }`;
    const response = await request(app)
      .post("/")
      .send({ query: booksByGenreQuery });
    const { data } = response.body;
    const booksWithHorrorGenre = data.allBooks;
    expect(booksWithHorrorGenre).toHaveLength(2);
    expect(booksWithHorrorGenre).toEqual(expectedResult);
  });
  it("Can be fetched correctly with an author filter", async () => {
    const expectedResult = [
      { ...books[0], author: { name: books[0].author } },
      { ...books[2], author: { name: books[2].author } },
    ];
    const fourthBook = books[2];
    const fourthMutation = createAddBookMutation(fourthBook);
    await addBook(fourthMutation);
    const booksByAuthorQuery = `
        query {
          allBooks(author: "${"Jack Swanson"}"){
            title
            author {
              name
            }
            genres
            published
            title
        }
      }`;

    const response = await request(app)
      .post("/")
      .send({ query: booksByAuthorQuery });
    const { data } = response.body;

    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.allBooks).toHaveLength(2);
    expect(data.allBooks).toEqual(expectedResult);
  });
  it("Can be fetched correctly with both, a genre and an author filter", async () => {
    const expectedResult = [{ ...books[4], author: { name: books[4].author } }];

    const booksByAuthorQuery = `
        query {
          allBooks(author: "${"Miranda Priestly"}",genre: "${"Adventure"}"){
            title
            author {
              name
            }
            genres
            published
            title
        }
      }`;

    const response = await request(app)
      .post("/")
      .send({ query: booksByAuthorQuery });

    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.allBooks).toHaveLength(1);
    expect(data.allBooks).toEqual(expectedResult);
  });
  describe("Cant be added with", () => {
    it("duplicate title and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
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

      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;
      expect(response.status).toBe(200);
      expect(data.value).toBeUndefined();
      expect(errors.message).toBe("Creating a book failed!");
      expect(errors.extensions.code).toBe("DUPLICATE_BOOK_TITLE");
      expect(errors.extensions.error._message).toBe(
        "BookMongo validation failed"
      );
      expect(errors.extensions.error.name).toBe("ValidationError");
      expect(errors.extensions.error.message).toBe(
        "BookMongo validation failed: title: Error, expected `title` to be unique. Value: `Oddly Normal`"
      );
    });
    it("empty title and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
        addBook(title: "${""}", author: "${book.author}", published: ${
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

      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;
      expect(response.status).toBe(200);
      expect(data.value).toBeUndefined();
      expect(errors.message).toBe("Creating a book failed!");
      expect(errors.extensions.message).toBe("Book title too short!");
      expect(errors.extensions.code).toBe("BAD_BOOK_TITLE");
    });
    it("empty author and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
        addBook(title: "${book.title}", author: "${""}", published: ${
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
      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;
      expect(response.status).toBe(200);
      expect(data.value).toBeUndefined();
      expect(errors.message).toBe("Creating a book failed!");
      expect(errors.extensions.message).toBe("Author name too short!");
      expect(errors.extensions.code).toBe("BAD_AUTHOR_NAME");
    });
    it("empty published and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
        addBook(title: "${book.title}", author: "${
        book.author
      }", published: ${undefined}, genres: ${JSON.stringify(book.genres)}){
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
      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;
      expect(response.status).toBe(400);
      expect(data).toBeUndefined();
      expect(errors.message).toBe(
        "Int cannot represent non-integer value: undefined"
      );
      expect(errors.extensions.code).toBe("GRAPHQL_VALIDATION_FAILED");
      //expect(errors.extensions.code).toBe("BAD_BOOK_PUBLICATION_DATE");
    });
    it("negative publication year and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
        addBook(title: "${book.title}", author: "${
        book.author
      }", published: ${-2000}, genres: ${JSON.stringify(book.genres)}){
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
      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;

      expect(response.status).toBe(200);
      expect(data.value).toBeUndefined();
      expect(errors.message).toBe("Creating a book failed!");
      expect(errors.extensions.message).toBe(
        "Publication date cant be negative!"
      );
      expect(errors.extensions.code).toBe("BAD_BOOK_PUBLICATION_DATE");
    });
    it("empty genres and returns corresponsing errors", async () => {
      const book = books[0];
      const mutation = `
        mutation {
        addBook(title: "${book.title}", author: "${book.author}",published: ${
        book.published
      }, genres: ${JSON.stringify([])}){
        title
        author{
          name
          bookCount
        }
        published
        genres
        }
      }
        `;
      const response = await request(app)
        .post("/")
        .set("Content-Type", "application/json")
        .set("Authorization", `bearer ${logintoken}`)
        .send({ query: mutation });

      const { data } = response.body;
      const [errors] = response.body.errors;
      expect(response.status).toBe(200);
      expect(data.value).toBeUndefined();
      expect(errors.message).toBe("Creating a book failed!");
      expect(errors.extensions.message).toBe(
        "Book must have at least one genre!"
      );
      expect(errors.extensions.code).toBe("BAD_BOOK_GENRES");
    });
  });
});
describe("Amount of books ", () => {
  it("is updated correctly after adding books", async () => {
    const secondBook = books[1];
    const thirdBook = books[2];
    const secondMutation = `
        mutation {
        addBook(title: "${secondBook.title}", author: "${
      secondBook.author
    }",published: ${secondBook.published}, genres: ${JSON.stringify(
      secondBook.genres
    )}){
        title
        author{
          name
          bookCount
        }
        published
        genres
        }
      }
        `;
    const thirdMutation = `
        mutation {
        addBook(title: "${thirdBook.title}", author: "${
      thirdBook.author
    }",published: ${thirdBook.published}, genres: ${JSON.stringify(
      thirdBook.genres
    )}){
      title
      author{
        name
        bookCount
      }
      published
      genres
      }
    }
        `;
    const bookCountQuery = `query{bookCount}`;

    //Add two more books
    await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: secondMutation });
    await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: thirdMutation });

    const response = await request(app)
      .post("/")
      .send({ query: bookCountQuery });

    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.bookCount).toBe(5);
  });
});
describe("Genres", () => {
  it("Can be fetched correctly", async () => {
    //Get the unique genres from the first 5 books.
    const uniqueGenres = [
      ...new Set(
        books.flatMap((book, index) => {
          if (index <= 4) {
            return book.genres;
          } else return [];
        })
      ),
    ].sort();
    const mutation = `
      query{allGenres}
      `;
    const response = await request(app).post("/").send({ query: mutation });
    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.allGenres).toEqual(uniqueGenres);
  });
  it("Are updated correctly after adding a book", async () => {
    const book = books[5];
    const uniqueGenres = [
      ...new Set(
        books.flatMap((book) => {
          return book.genres;
        })
      ),
    ].sort();
    const addBookMutation = createAddBookMutation(book);

    const query = `query{allGenres}`;
    const response = await addBook(addBookMutation);

    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.addBook.title).toBe(book.title);
    expect(data.addBook.author).toStrictEqual({
      name: book.author,
      bookCount: 1,
    });
    expect(data.addBook.published).toBe(book.published);
    expect(data.addBook.genres).toEqual(book.genres);

    const queryResponse = await request(app).post("/").send({ query: query });
    const { allGenres } = queryResponse.body.data;
    expect(queryResponse.status).toBe(200);
    expect(allGenres).toHaveLength(7);
    expect(allGenres).toEqual(uniqueGenres);
  });
});
describe("Author", () => {
  it("Count is updated correctly after adding a book by a new author", async () => {
    const addBookMutation = createAddBookMutation(books[6]);
    await addBook(addBookMutation);

    const query = `
      query{authorCount}
      `;
    const response = await request(app).post("/").send({ query: query });
    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.authorCount).toBe(5);
  });
  it("Can be fetched correctly", async () => {
    const uniqueAuthors = books
      .map((book) => book.author)
      .reduce<{ name: string }[]>((acc, author) => {
        if (!acc.find((obj) => obj.name === author)) {
          acc.push({ name: author });
        }
        return acc;
      }, []);

    const allAuthorsQuery = `
      query{
      allAuthors{
        name
      }
    }`;
    const response = await request(app)
      .post("/")
      .send({ query: allAuthorsQuery });
    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.allAuthors).toEqual(uniqueAuthors);
  });
  it("Can be edited correctly", async () => {
    const authorToEdit = books[0].author;
    const expectedResult = { name: "Jack Swanson", born: 1990 };
    const editAuthorBornMutation = `mutation{
        editAuthor(name: "${authorToEdit}", setBornTo: ${1990}){
          name
          born
        }
      }
      `;
    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: editAuthorBornMutation });

    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.editAuthor).toEqual(expectedResult);
  });
  it("Cant be edited with a non-existing author", async () => {
    const authorToEdit = "Non-existing author";
    const editAuthorBornMutation = `mutation{
        editAuthor(name: "${authorToEdit}", setBornTo: ${1990}){
          name
          born
        }
      }
      `;
    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: editAuthorBornMutation });

    const { data } = response.body;
    const [errors] = response.body.errors;
    expect(response.status).toBe(200);
    expect(data.editAuthor).toBeNull();
    expect(errors.message).toBe("Author not found!");
    expect(errors.extensions.code).toBe("AUTHOR_NOT_FOUND");
    //expect(errors.extensions.message).toBe("Author not found!");
  });
  it("Cant be edited with a negative birth year", async () => {
    const authorToEdit = books[0].author;
    const editAuthorBornMutation = `mutation{
        editAuthor(name: "${authorToEdit}", setBornTo: ${-1990}){
          name
          born
        }
      }
      `;
    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: editAuthorBornMutation });

    const { data } = response.body;
    const [errors] = response.body.errors;
    expect(response.status).toBe(200);
    expect(data.editAuthor).toBeNull();
    expect(errors.message).toBe("Author birth year cant be negative!");
    expect(errors.extensions.code).toBe("BAD_AUTHOR_BIRTH_YEAR");
  });
});
describe("Subscriptions", () => {
  // let subscription: PushSubscription;
  afterAll(() => {
    if (client) {
      client.dispose();
    }
  });
  test("send notification to the client after editing an author", async () => {
    // Create a promise to wait for the subscription's next callback
    const dataPromise = new Promise((resolve, reject) => {
      client.subscribe(
        {
          query: `
              subscription {
                authorUpdated {
                  name
                  born
                  bookCount
                  id
                }
              }
            `,
        },
        {
          next(data: unknown) {
            try {
              expect(data).toMatchObject({
                data: {
                  authorUpdated: {
                    name: "Jack Swanson",
                    born: 1990,
                  },
                },
              });
              resolve(data); // Resolve the promise if expectations pass
            } catch (error: unknown) {
              reject(error); // Reject the promise if expectations fail
            }
          },
          error(err: unknown) {
            reject(err); // Reject the promise if there's an error
          },
          complete() {
            console.log("Subscription completed!");
          },
        }
      );
    });
    //wait for the subscription to be ready
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Perform the mutation

    const authorToEdit = books[0].author;
    const expectedResult = { name: "Jack Swanson", born: 1990 };
    const editAuthorBornMutation = `mutation{
        editAuthor(name: "${authorToEdit}", setBornTo: ${1990}){
          name
          born
        }
      }
      `;

    const response = await request(app)
      .post("/")
      .set("Content-Type", "application/json")
      .set("Authorization", `bearer ${logintoken}`)
      .send({ query: editAuthorBornMutation });

    const { data } = response.body;
    expect(response.status).toBe(200);
    expect(data).toBeDefined();
    expect(data.editAuthor).toEqual(expectedResult);

    // Wait for the subscription data to be received and validated
    await dataPromise;
  });
  test("sends notification to the client after adding a book", async () => {
    const dataPromise = new Promise((resolve, reject) => {
      client.subscribe(
        {
          query: `
                subscription {
                  bookAdded {
                    title
                    published
                    author {
                      name
                      bookCount
                    }
                    genres
                  }
                }
              `,
        },
        {
          next(data: unknown) {
            try {
              expect(data).toMatchObject({
                data: {
                  bookAdded: {
                    title: "The ancient pyramids",
                    published: 2015,
                    author: {
                      name: "Jack Swanson",
                      bookCount: 4,
                    },
                    genres: ["History"],
                  },
                },
              });
              resolve(data);
            } catch (error: unknown) {
              reject(error);
            }
          },
          error(err: unknown) {
            reject(err);
          },
          complete() {
            console.log("Subscription completed! ");
          },
        }
      );
    });
    await new Promise((resolve) => setTimeout(resolve, 3000));
    //New comment for a commit.
    const bookToAdd = books[7];
    const addBookMutation = createAddBookMutation(bookToAdd);
    const res = await addBook(addBookMutation);
    const { data } = res.body;

    expect(res.status).toBe(200);
    expect(data).toBeDefined();

    await dataPromise;
  });
});

export {};
