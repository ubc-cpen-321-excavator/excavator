import { createApp } from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { logError, logInfo } from './utils/log';
import { attachFeed, closeFeed } from './controllers/feedController';

const app = createApp();


// Readd the code below later once we implement HTTPS (with `import https from 'https'` and `import fs from 'node:fs'`)

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
  logInfo(`Server listening on port ${env.port}: http://localhost:${env.port}`);
});

// Live feed of new Gems, as a WebSocket at ws://<server>/feed on the same port.
const feed = attachFeed(server);

// Routes that don't touch the DB (e.g. /health) keep working if MongoDB is down.
connectDB()
  .then(() => {
    logInfo('Connected to MongoDB.');
  })
  .catch((err: unknown) => {
    logError('MongoDB connection failed', err);
  });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    // Clients first: the HTTP server won't finish closing while a feed connection is open.
    closeFeed(feed)
      .then(() => new Promise<void>(resolve => {
        server.close(() => {
          resolve();
        });
      }))
      .then(() => disconnectDB())
      .catch((err: unknown) => {
        logError('Shutdown failed', err);
      })
      .finally(() => {
        // Re-send the signal: with this one-time handler gone, Node's default handler ends the process.
        process.kill(process.pid, signal);
      });
  });
}
