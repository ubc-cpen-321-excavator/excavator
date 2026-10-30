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
    return res.status(400).json({ message: `Wrong OAuth idToken.` });
  }

  await authService.login(idToken)
    .then(jwt => res.json({ jwt }))
    .catch(err => {
      console.log(`Login failed: ${alphnumDashOnly(err)}`);
      return res.status(400).json({ message: `Login failed.` });
    });
});
