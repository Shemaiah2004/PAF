import mongoose from "mongoose";
import { env } from "./env.js";

let listenersRegistered = false;

function redactMongoUri(uri) {
  try {
    const parsed = new URL(uri);
    if (parsed.password) {
      parsed.password = "***";
    }

    return parsed.toString();
  } catch {
    return uri.replace(/:\/\/([^:]+):([^@]+)@/, "://$1:***@");
  }
}

export async function connectDatabase() {
  if (!env.mongoUri?.trim()) {
    throw new Error("MONGODB_URI is not configured.");
  }

  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  if (!listenersRegistered) {
    listenersRegistered = true;

    mongoose.connection.on("connected", () => {
      console.info(
        `[ticketing-api] MongoDB connected: ${redactMongoUri(env.mongoUri)}`
      );
    });

    mongoose.connection.on("error", (error) => {
      console.error("[ticketing-api] MongoDB connection error", error);
    });

    mongoose.connection.on("disconnected", () => {
      console.warn("[ticketing-api] MongoDB disconnected");
    });
  }

  return mongoose.connect(env.mongoUri, {
    serverSelectionTimeoutMS: env.mongoServerSelectionTimeoutMs,
  });
}
