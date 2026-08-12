import mongoose from "mongoose";
import {
  debugError,
  logMongoConnected,
  logMongoReused,
} from "@/lib/debug";

const MONGODB_URI = process.env.MONGODB_URI;

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

global.mongooseCache = cached;

export async function connectDB() {
  if (!MONGODB_URI) {
    debugError("Missing MONGODB_URI environment variable");
    throw new Error("Missing MONGODB_URI environment variable");
  }

  if (cached.conn) {
    logMongoReused();
    return cached.conn;
  }

  const startedAt = Date.now();

  if (!cached.promise) {
    // Never log the URI — may contain credentials.
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
    logMongoConnected(Date.now() - startedAt);
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    debugError("MongoDB connection failed", error, {
      duration: `${Date.now() - startedAt}ms`,
    });
    throw error;
  }
}
