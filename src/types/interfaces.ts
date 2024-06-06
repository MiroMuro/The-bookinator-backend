import { WebSocketServer } from "ws";
import { ApolloServer } from "@apollo/server";
import express from "express";
import * as http from "http";

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
