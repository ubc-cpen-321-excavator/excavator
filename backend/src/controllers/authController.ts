import express from "express";
import AuthService from "../services/authService";
import { alphnumDashOnly } from "../utils/trust";

export const authRouter = express.Router();

export const authService = new AuthService();

authRouter.post('/google', async (req, res) => {
  if (!req.body) {
    res.status(400).json({ message: 'Invalid request.' });
    return;
  }

  const { idToken } = req.body;
  if (!idToken || typeof (idToken) !== 'string') {
    console.log(`Wrong OAuth idToken: ${alphnumDashOnly(idToken)}`);
    res.status(400).json({ message: `Wrong OAuth idToken.` });
    return;
  }

  await authService.login(idToken)
    .then(sessionId => res.json({ sessionId: sessionId }))
    .catch(err => {
      console.log(`Login failed: ${alphnumDashOnly(err)}`);
      res.status(400).json({ message: `Login failed.` });
    });

  return;
});
