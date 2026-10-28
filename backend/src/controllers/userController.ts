import express from "express";
import UserService, { InvalidTokenError } from "../services/userService";
import { alphnumDashOnly } from "../utils/trust";

/** Routes mounted at `/user`. */
export const userRouter = express.Router();

export const userService = new UserService();

/**
 * POST /user/auth/google with JSON body `{ idToken: '<Google ID token>' }`
 *
 * Logs in with Google Sign-In, storing the user on their first login.
 * - 200 `{ sessionId }`: logged in.
 * - 400 `{ message: 'Invalid request.' }`: no JSON body.
 * - 400 `{ message: 'Wrong OAuth idToken.' }`: `idToken` is missing or not a string.
 * - 400 `{ message: 'Login failed.' }`: Google rejected the token.
 * - 500 `{ message: 'Login failed.' }`: database error.
 */
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

  try {
    const sessionId = await userService.login(idToken);
    res.json({ sessionId: sessionId });
  } catch (err) {
    console.log(`Login failed: ${alphnumDashOnly(err)}`);
    res.status(err instanceof InvalidTokenError ? 400 : 500).json({ message: `Login failed.` });
  }
});
