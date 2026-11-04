module.exports = {
  // ts-jest with source maps on: tsconfig.json turns them off for the build, and without them coverage
  // reports the CommonJS import helpers TypeScript adds at the top of each file as uncovered lines.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: { sourceMap: true } }],
  },
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/tests'],
  // Test-only environment, e.g. a JWT secret so login works without a .env file.
  setupFiles: ['<rootDir>/tests/setupEnv.ts'],
  collectCoverageFrom: ['src/**/*.ts'],
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html', 'text-summary'],
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/coverage/'
  ],
};