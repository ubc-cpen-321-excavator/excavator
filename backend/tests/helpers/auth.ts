import jwt from 'jsonwebtoken';

/** The signed-in user most tests act as. */
export const TEST_USER_ID = 'google-sub-123';

/** That user as stored in the `users` collection. */
export const TEST_USER_DOC = {
  googleId: TEST_USER_ID,
  name: { full: 'Sayaka Miki', given: 'Sayaka', family: 'Miki' },
  displayName: 'mermaid',
};

/**
 * @param userId the user to sign in as.
 * @returns an `Authorization` header value with a valid login token for that user.
 */
export function bearer(userId: string = TEST_USER_ID): string {
  return `Bearer ${jwt.sign({}, process.env.JWT_SECRET ?? '', { subject: userId, expiresIn: '1h' })}`;
}
