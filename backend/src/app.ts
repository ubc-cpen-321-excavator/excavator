import express, { type Express } from 'express';

import ipController from "./controllers/ipController";
import nameController from "./controllers/nameController";
import timeController from "./controllers/timeController";
import { userRouter } from './controllers/userController';

// import WebSocket from 'ws';

export function createApp(): Express {
  const app = express();


  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use("/ip", ipController);
  app.use("/name", nameController);
  app.use("/time", timeController);

  app.use('/user', userRouter);

  app.use((_req, res) => {
    res.status(404).json({ error: 'Not Found' });
  });

  return app;
}
