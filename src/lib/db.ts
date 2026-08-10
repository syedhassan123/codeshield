import mongoose from "mongoose";
import { debugError, debugLog } from "@/lib/debug";

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
    debugLog("MONGODB", "connection reuse (cached)");
    return cached.conn;
  }

  const startedAt = Date.now();
  debugLog("MONGODB", "connecting...");

  if (!cached.promise) {
    // Never log the URI — may contain credentials.
    cached.promise = mongoose.connect(MONGODB_URI, {
      bufferCommands: false,
    });
  }

  try {
    cached.conn = await cached.promise;
    debugLog("MONGODB", "connected", {
      duration: `${Date.now() - startedAt}ms`,
      readyState: mongoose.connection.readyState,
    });
    return cached.conn;
  } catch (error) {
    cached.promise = null;
    debugError("MongoDB connection failed", error, {
      duration: `${Date.now() - startedAt}ms`,
    });
    throw error;
  }
}
