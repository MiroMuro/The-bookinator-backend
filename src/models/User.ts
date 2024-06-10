import mongoose from "mongoose";
import { UserMongoDB } from "../types/interfaces";
const uniqueValidator = require("mongoose-unique-validator");
const schema = new mongoose.Schema<UserMongoDB>({
  username: {
    type: String,
    required: true,
    minlength: 3,
    unique: true,
  },
  favoriteGenre: {
    type: String,
    required: false,
    minlength: 2,
  },
  passwordHash: {
    type: String,
    required: true,
  },
});
schema.plugin(uniqueValidator);

module.exports = mongoose.model("User", schema);
