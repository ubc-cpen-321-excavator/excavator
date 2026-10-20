import express from "express";
import UserService from "../services/userService";

export const userRouter = express.Router();

export const userService = new UserService();

userRouter.post('/login/callback', async (req, res) => {
  try {
    const { code } = req.body;
    if (!code || typeof (code) !== 'string') {
      res.status(400).json({ message: `Wrong OAuth parameter: code: ${code}` });
      return;
    }

    const sessionId = await userService.login(code);
    res.json({ sessionId: sessionId });
  } catch (err) {
    res.status(400).json({ message: `Login failed: ${err}` })
  }
});
