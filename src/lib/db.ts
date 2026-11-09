import mongoose from "mongoose";

const g = globalThis as unknown as { _mongoose?: { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null } };
const cached = (g._mongoose ??= { conn: null, promise: null });

export async function dbConnect() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set (see .env.example)");
  if (cached.conn) return cached.conn;
  cached.promise ??= mongoose.connect(uri);
  try { cached.conn = await cached.promise; } catch (e) { cached.promise = null; throw e; }   // a failed attempt must not be remembered – retry next request
  return cached.conn;
}
