const mongoose = require("mongoose");
require("dotenv").config();

console.log("MONGODB_URI:", process.env.MONGODB_URI);

async function connectDB() {
  try {
    console.log("Connecting to MongoDB...");

    await mongoose.connect('mongodb://atlas-sql-665611f513d39707115587b0-9zyhz.a.query.mongodb.net/shield_ace_proctor?ssl=true&authSource=admin', {
      family: 4,
      serverSelectionTimeoutMS: 10000,
    });

    console.log("✅ MongoDB connected successfully!");
  } catch (error) {
    console.error("❌ MongoDB connection failed:");
    console.error(error);
  }
}

connectDB();