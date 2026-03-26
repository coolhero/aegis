// Set required environment variables for tests
process.env.DATABASE_HOST = process.env.DATABASE_HOST || 'localhost';
process.env.DATABASE_PORT = process.env.DATABASE_PORT || '5432';
process.env.DATABASE_USER = process.env.DATABASE_USER || 'aegis';
process.env.DATABASE_PASSWORD = process.env.DATABASE_PASSWORD || 'aegis_dev';
process.env.DATABASE_NAME = process.env.DATABASE_NAME || 'aegis_test';
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6379';
process.env.PORT = process.env.PORT || '3000';
// Jest sets NODE_ENV=test by default, override to match our Environment enum
(process.env as Record<string, string>).NODE_ENV = 'development';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-jwt-secret-key-for-testing-only';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret-key-for-testing-only';
