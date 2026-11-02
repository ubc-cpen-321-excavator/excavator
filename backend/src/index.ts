import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { alphnumDashOnly } from './utils/trust';
import { attachFeed, closeFeed } from './controllers/feedController';
import https from 'https';
import fs from "node:fs";

const app = createApp();


// Readd the code below later once we implement HTTPS

// const server = https
//     .createServer(
//         {
//             key: fs.readFileSync("secrets/m1_ec2_key.pem"),
//             cert: fs.readFileSync("secrets/m1_ec2_cert.pem")
//         }
//         ,app
//     )
//     .listen(env.port, () => {
//       console.log(`Server listening on ${env.port}\nLink: https://localhost:${env.port}`);
//     })

const server = app.listen(env.port, () => {
    console.log(`Server listening on ${env.port}\nLink: http://localhost:${env.port}`);
})

// Live feed of new Gems, as a WebSocket at ws://<server>/feed on the same port.
const feed = attachFeed(server);

// Routes that don't touch the DB (e.g. /health) keep working if MongoDB is down.
connectDB()
  .then(() => console.log('Connected to MongoDB.'))
  .catch(err => console.log(`MongoDB connection failed: ${alphnumDashOnly(err)}`));

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    // Clients first: the HTTP server won't finish closing while a feed connection is open.
    closeFeed(feed).finally(() => {
      server.close(() => {
        disconnectDB().finally(() => process.exit(0));
      });
    });
  });
}
