module.exports = {
  testEnvironment: 'node',
  testTimeout: 120000,
  maxWorkers: 1,
  forceExit: true,
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  collectCoverageFrom: [
    'modules/**/*.js',
    'utils/**/*.js',
    'middleware/**/*.js',
    'integrations/**/*.js',
    '!modules/**/*.routes.js',
  ],
  coveragePathIgnorePatterns: ['/node_modules/', '/tests/'],
  coverageReporters: ['text', 'text-summary'],
};
