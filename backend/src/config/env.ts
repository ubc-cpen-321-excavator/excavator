import 'dotenv/config';

const rawPort = process.env.PORT;
const port =
  rawPort === undefined || rawPort === ''
    ? 3000
    : Number.parseInt(rawPort, 10);

if (Number.isNaN(port) || port < 1 || port > 65535) {
  throw new Error(`Invalid PORT: ${rawPort}`);
}

export const env = {
  port,
  mongodb_uri: process.env.MONGODB_URI ?? 'mongodb://localhost:27017/cpen321',
  google_client_id: process.env.GOOGLE_CLIENT_ID!,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET!
} as const;
