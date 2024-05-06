const mongoose = require("mongoose");

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
});

module.exports = mongoose.model("AuthorMongo", schema);
