import { WebSocketServer } from "ws";
import { ApolloServer } from "@apollo/server";
import express from "express";
import * as http from "http";
import { ObjectId } from "mongodb";

export type testUser = {
  username: string;
  password: string;
  favoriteGenre: string;
};
export type ServerType = {
  app: express.Application;
  httpServer: http.Server;
  wsServer: WebSocketServer;
  server: ApolloServer;
  schema: unknown;
};

export type AuthorSetBornArgs = {
  name: string;
  setBornTo: number;
};
export type AddBookArgs = {
  title: string;
  author: string;
  published: number;
  genres: string[];
};
export type AddAuthorArgs = {
  name: string;
  born?: number;
  description?: string;
};

export type LoginArgs = {
  username: string;
  password: string;
};
export type CreateUserArgs = {
  username: string;
  password: string;
  favoriteGenre: string;
};

export type MongoAuthorType = {
  id: string;
  name: string;
  born: number;
  bookCount: number;
};
export type MongoBookType = {
  id: string;
  title: string;
  published: number;
  genres: string[];
  author: MongoAuthorType;
};
export interface UserMongoDB {
  _id?: ObjectId;
  username: string;
  favoriteGenre: string;
  passwordHash: string;
  __v?: number;
}

export interface ImageFile {
  fieldName: string;
  filename: string;
  mimetype: string;
  encoding: string;
  createReadStream: () => NodeJS.ReadableStream;
}

export type FilePromise = Promise<ImageFile>;

export interface MongoError extends Error {
  errors: {
    name: {
      kind: string;
      path: string;
    };
  };
}

export interface Context {
  currentUser: UserMongoDB;
}

export interface ArgsAllBooks {
  author?: string;
  genre?: string;
}

export class JwtValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JwtValidationError";
    Object.setPrototypeOf(this, JwtValidationError.prototype);
  }
}
export type MongoAuthorBookUnion = MongoAuthorType | MongoBookType;
