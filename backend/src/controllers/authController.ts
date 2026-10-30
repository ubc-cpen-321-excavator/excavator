import express from "express";
import AuthService, { InvalidTokenError } from "../services/authService";
import { methodNotAllowed } from "../utils/http";
import { alphnumDashOnly } from "../utils/trust";

/** Routes mounted at `/user`. */
export const authRouter = express.Router();

export const authService = new AuthService();

/**
 * POST /user/auth/google with JSON body `{ idToken: '<Google ID token>' }`
 *
 * Logs in with Google Sign-In, storing the user on their first login.
 * The response field is still called `sessionId`, so the app needs no change: it now holds a JWT,
 * which the app sends back as `Authorization: Bearer <sessionId>`. It expires after 7 days.
 * - 200 `{ sessionId }`: logged in.
 * - 400 `{ message: 'Invalid request.' }`: no JSON body.
 * - 400 `{ message: 'Wrong OAuth idToken.' }`: `idToken` is missing or not a string.
 * - 401 `{ message: 'Login failed.' }`: Google rejected the token.
 * - 500 `{ message: 'Login failed.' }`: database error, or `JWT_SECRET` not set.
 */
authRouter.post('/auth/google', async (req, res) => {
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
    const token = await authService.login(idToken);
    res.json({ sessionId: token });
  } catch (err) {
    console.log(`Login failed: ${alphnumDashOnly(err)}`);
    res.status(err instanceof InvalidTokenError ? 401 : 500).json({ message: `Login failed.` });
  }
});

authRouter.all('/auth/google', methodNotAllowed(['POST']));
