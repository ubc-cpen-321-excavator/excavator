import express from "express";
import UserService from "../services/userService";

export const userRouter = express.Router();

export const userService = new UserService();

userRouter.get('/login', async (req, res) => {
  const { code } = req.query;
  if (!code || typeof (code) !== 'string') {
    console.log(`Wrong OAuth code: ${code}`);
    res.status(400).json({ message: `Wrong OAuth code.` });
  }

  userService.login(code as string)
    .then(sessionId => res.json({ sessionId: sessionId }))
    .catch(err => {
      console.log(`Login failed: ${err}`);
      res.status(400).json({ message: `Login failed.` });
    });
});
