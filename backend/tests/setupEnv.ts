// Runs before every test file (jest.config.js `setupFiles`), before any app code is imported.
// Gives tests a JWT secret when none is set, so login can sign tokens without a .env file.
process.env.JWT_SECRET ??= 'test-jwt-secret';
