import express from "express";
import AuthService, { InvalidTokenError, currentUser, isValidDisplayName } from "../services/authService";
import { asyncHandler, methodNotAllowed } from "../utils/http";
import { logError } from "../utils/log";

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
authRouter.post('/auth/google', asyncHandler(async (req, res) => {
  if (!req.body) {
    res.status(400).json({ message: 'Invalid request.' });
    return;
  }

  const { idToken } = req.body as { idToken?: unknown };
  if (typeof idToken !== 'string' || idToken === '') {
    // Not logged: the value may be a credential.
    logError('Wrong OAuth idToken: missing or not a string');
    res.status(400).json({ message: `Wrong OAuth idToken.` });
    return;
  }

  try {
    const token = await authService.login(idToken);
    res.json({ sessionId: token });
  } catch (err) {
    logError('Login failed', err);
    res.status(err instanceof InvalidTokenError ? 401 : 500).json({ message: `Login failed.` });
  }
}));

authRouter.all('/auth/google', methodNotAllowed(['POST']));

/**
 * GET /user/me
 * Requires login: `Authorization: Bearer <token>`.
 *
 * Gets the signed-in user's profile.
 * - 200 `{ id, name: { full, given?, family? }, displayName }`: `displayName` is the one they chose,
 *   or their Google name.
 * - 401 `{ message }`: not signed in (see `AuthService.reqJwt`).
 */
authRouter.get('/me', authService.reqJwt, (req, res) => {
  res.json(currentUser(req));
});

/**
 * PATCH /user/me with JSON body `{ displayName }`
 * Requires login: `Authorization: Bearer <token>`.
 *
 * Sets the signed-in user's display name, shown to other users (e.g. on their comments).
 * - 200 the updated profile, as `GET /user/me` returns it.
 * - 400 `{ message: 'Invalid display name.' }`: missing, not a string, blank, over 50 characters
 *   after trimming, or with control characters.
 * - 401 `{ message }`: not signed in (see `AuthService.reqJwt`).
 * - 500 `{ message: 'Update profile failed.' }`: database error.
 */
authRouter.patch('/me', authService.reqJwt, asyncHandler(async (req, res) => {
  const { displayName } = (req.body ?? {}) as { displayName?: unknown };
  if (!isValidDisplayName(displayName)) {
    res.status(400).json({ message: 'Invalid display name.' });
    return;
  }

  const user = currentUser(req);
  try {
    await authService.setDisplayName(user.id, displayName);
    user.setDisplayName(displayName.trim());
    res.json(user);
  } catch (err) {
    logError('Update profile failed', err);
    res.status(500).json({ message: 'Update profile failed.' });
  }
}));

authRouter.all('/me', methodNotAllowed(['GET', 'PATCH']));
