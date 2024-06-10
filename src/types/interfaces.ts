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

export type LoginArgs = {
  username: string;
  password: string;
};
export type CreateUserArgs = {
  username: string;
  password: string;
  favoriteGenre: string;
};

export interface UserMongoDB {
  _id?: ObjectId;
  username: string;
  favoriteGenre: string;
  passwordHash: string;
  __v?: number;
}

export interface Context {
  currentUser: UserMongoDB;
}

export interface ArgsAllBooks {
  author?: string;
  genre?: string;
}
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
export type MongoAuthorBookUnion = MongoAuthorType | MongoBookType;
