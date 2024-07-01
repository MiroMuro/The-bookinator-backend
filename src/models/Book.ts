import mongoose from "mongoose";
// you must install this library
const uniqueValidator = require("mongoose-unique-validator");

const schema = new mongoose.Schema({
  title: {
    type: String,
    required: true,
    unique: true,
    minlength: 2,
  },
  published: {
    type: Number,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AuthorMongo",
  },
  genres: {
    type: [String],
    validate: {
      validator: function (v: string[]) {
        return v.length <= 3; // Set the maximum array length here
      },
      message: "Genres array exceeds maximum length of 3",
    },
  },
});

schema.plugin(uniqueValidator);

module.exports = mongoose.model("BookMongo", schema);
