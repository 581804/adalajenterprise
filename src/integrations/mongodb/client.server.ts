// Server-side MongoDB connection (via Mongoose). NEVER import this from route
// files, components, or any module that ships to the client bundle — it reads
// MONGODB_URI (a secret) and Mongoose does not run in the browser.
// Load inside server handlers/server functions only:
//   const { connectMongo } = await import("@/integrations/mongodb/client.server");
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI;
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || "adalajenterprise";

// In dev, Vite/HMR can re-evaluate this module on every file save, which would
// otherwise open a fresh connection each time. Stash the promise on
// `globalThis` so it survives module reloads. In production each server
// process just gets its own single promise, which is what we want anyway.
declare global {
  // eslint-disable-next-line no-var
  var _mongooseConnectionPromise: Promise<typeof mongoose> | undefined;
}

function createConnectionPromise(): Promise<typeof mongoose> {
  if (!MONGODB_URI) {
    const message =
      "Missing MongoDB environment variable: MONGODB_URI. Set it in your .env file.";
    console.error(`[MongoDB] ${message}`);
    throw new Error(message);
  }

  mongoose.set("strictQuery", true);

  return mongoose.connect(MONGODB_URI, {
    dbName: MONGODB_DB_NAME,
    maxPoolSize: 10,
  });
}

/**
 * Ensure the shared Mongoose connection is established, then return it.
 * Safe to call on every request — it resolves instantly once connected.
 *
 * Usage:
 *   await connectMongo();
 *   const user = await User.findOne({ email });
 */
export async function connectMongo(): Promise<typeof mongoose> {
  if (!globalThis._mongooseConnectionPromise) {
    globalThis._mongooseConnectionPromise = createConnectionPromise();
  }
  try {
    return await globalThis._mongooseConnectionPromise;
  } catch (err) {
    // Don't cache a rejected connection attempt — let the next call retry
    // (e.g. if Atlas was briefly unreachable or the URI was fixed since).
    globalThis._mongooseConnectionPromise = undefined;
    throw err;
  }
}
