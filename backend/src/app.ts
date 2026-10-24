import express, { type Express } from 'express';

import ipController from "./controllers/ipController";
import nameController from "./controllers/nameController";
import timeController from "./controllers/timeController";
import { gemRouter } from './controllers/gemController';
import { authRouter } from './controllers/authController';

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

  app.use('/user', authRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  return app;
}
