import mongoose from "mongoose";
const uniqueValidator = require("mongoose-unique-validator");

const schema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      minlength: 4,
    },
    born: {
      type: Number,
    },
    description: {
      type: String,
      maxLength: 600,
    },
    imageId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Image",
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

schema.plugin(uniqueValidator);

schema.virtual("bookCount", {
  ref: "BookMongo",
  localField: "_id",
  foreignField: "author",
  count: true,
  type: Number,
});

module.exports = mongoose.model("AuthorMongo", schema);
