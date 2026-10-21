import express from "express";
import UserService from "../services/userService";
import { alphnumDashOnly } from "../utils/trust";

export const userRouter = express.Router();

export const userService = new UserService();

userRouter.post('/auth/google', async (req, res) => {
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

  userService.login(idToken as string)
    .then(sessionId => res.json({ sessionId: sessionId }))
    .catch(err => {
      console.log(`Login failed: ${alphnumDashOnly(err)}`);
      res.status(400).json({ message: `Login failed.` });
    });
});
