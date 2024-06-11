const MONGODB_URI = process.env.MONGODB_URI;
const mongoose = require("mongoose");
require("dotenv").config();

describe("MongoDB Connection", () => {
  beforeAll(async () => {
    await mongoose.connect(MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("should connect to MongoDB", async () => {
    const connectionState = mongoose.connection.readyState;
    expect(connectionState).toBe(1); // 1 means connected
  });
});
