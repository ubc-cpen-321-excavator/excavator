import express from "express";
import UserService from "../services/userService";

export const userRouter = express.Router();

export const userService = new UserService();

userRouter.post('/auth/google', async (req, res) => {
  const { idToken } = req.body;
  if (!idToken || typeof (idToken) !== 'string') {
    console.log(`Wrong OAuth idToken: ${idToken}`);
    res.status(400).json({ message: `Wrong OAuth idToken.` });
  }

  userService.login(idToken!)
    .then(sessionId => res.json({ sessionId: sessionId }))
    .catch(err => {
      console.log(`Login failed: ${err}`);
      res.status(400).json({ message: `Login failed.` });
    });
});
