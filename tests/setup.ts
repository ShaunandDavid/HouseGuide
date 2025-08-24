import '@testing-library/jest-dom';

// Set up test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-12345';
process.env.DATABASE_URL = 'postgresql://test@localhost/test';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.SENDGRID_API_KEY = 'test-sendgrid-key';
process.env.SENDGRID_FROM_EMAIL = 'test@example.com';

// Mock console methods to reduce test output noise
global.console = {
  ...console,
  error: jest.fn(),
  warn: jest.fn(),
  log: jest.fn(),
};