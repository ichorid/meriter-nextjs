// Jest setup file - runs before all tests
// Set NODE_ENV=test so that config files allow test defaults
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'test';
}

// Set required environment variables for tests
// These are needed before modules are imported, as ConfigModule validates on import
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key';
}

