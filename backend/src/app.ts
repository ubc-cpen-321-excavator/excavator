import express, { type Express, type NextFunction, type Request, type Response } from 'express';

import ipController from "./controllers/ipController";
import nameController from "./controllers/nameController";
import timeController from "./controllers/timeController";
import { gemRouter } from './controllers/gemController';
import { placeRouter } from './controllers/placeController';
import { authRouter } from './controllers/authController';
import { favoriteRouter } from './controllers/favoriteController';
import { logError } from "./utils/log";

// import WebSocket from 'ws';

export function createApp(): Express {
  const app = express();

  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use("/ip", ipController);
  app.use("/name", nameController);
  app.use("/time", timeController);

  app.use('/gem', gemRouter);

  app.use('/place', placeRouter);

  app.use('/user/favorites', favoriteRouter);

  app.use('/user', authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  // Errors that reach Express instead of a route's own handling, e.g. malformed JSON rejected by
  // express.json(). Without this, Express answers with its default HTML error page.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    // Too late to answer with JSON: Express closes the connection.
    if (res.headersSent) {
      next(err);
      return;
    }

    const { status, type } = (err ?? {}) as { status?: unknown; type?: unknown };

    if (type === 'entity.parse.failed') {
      res.status(400).json({ message: 'Invalid JSON.' });
      return;
    }
    if (typeof status === 'number' && status >= 400 && status < 500) {
      res.status(status).json({ message: 'Invalid request.' });
      return;
    }

    logError('Unhandled error', err);
    res.status(500).json({ message: 'Internal error.' });
  });

  return app;
}
