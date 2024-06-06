const MONGODB_URI = process.env.MONGODB_URI;
const mongoose = require("mongoose");
describe("MongoDB Connection", () => {
  beforeAll(async () => {
    await mongoose.connect(
      "mongodb+srv://mssl2000:90cZUt5J1CMajhGt@miro.oyuedl2.mongodb.net/?retryWrites=true&w=majority&appName=miro",
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      }
    );
  });

  afterAll(async () => {
    await mongoose.disconnect();
  });

  it("should connect to MongoDB", async () => {
    const connectionState = mongoose.connection.readyState;
    expect(connectionState).toBe(1); // 1 means connected
  });
});
