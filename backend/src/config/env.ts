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
  // Signs login tokens. Login fails (500) if it is missing, rather than signing with an empty secret.
  jwt_secret: process.env.JWT_SECRET || undefined,
  google_client_id: process.env.GOOGLE_CLIENT_ID!,
  google_client_secret: process.env.GOOGLE_CLIENT_SECRET!,
  // Google Places API (New) key. Without it, the Places client falls back to Application Default Credentials.
  google_places_api_key: process.env.GOOGLE_PLACES_API_KEY || undefined,
} as const;
