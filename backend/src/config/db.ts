import mongoose from "mongoose";
import { env } from './env';

export async function connectDB(): Promise<void> {
  await mongoose.connect(env.mongodb_uri);
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}
