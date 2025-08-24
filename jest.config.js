module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests', '<rootDir>/server', '<rootDir>/client'],
  testMatch: ['**/__tests__/**/*.ts?(x)', '**/?(*.)+(spec|test).ts?(x)'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        esModuleInterop: true,
        moduleResolution: 'node',
      }
    }]
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/client/src/$1',
    '^@shared/(.*)$': '<rootDir>/shared/$1',
  },
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'server/**/*.{ts,tsx}',
    'client/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
  ],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.ts'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  globals: {
    'ts-jest': {
      isolatedModules: true,
    },
  },
  projects: [
    {
      displayName: 'server',
      testEnvironment: 'node',
      testMatch: ['<rootDir>/tests/server/**/*.test.ts'],
    },
    {
      displayName: 'client',
      testEnvironment: 'jsdom',
      testMatch: ['<rootDir>/tests/client/**/*.test.tsx'],
    },
  ],
};