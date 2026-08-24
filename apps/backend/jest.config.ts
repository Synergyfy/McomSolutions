import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['src/**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/src/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // ─── Resource limits ──────────────────────────────────────────────────────
  // 2 workers instead of '50%' (which was 4 on this 4-core machine).
  // Each worker boots a NestJS testing module — 4 parallel boots saturated CPU.
  maxWorkers: 2,

  // Abort any test that hangs for more than 15 seconds so a stuck Redis/Prisma
  // connection attempt can't freeze the machine indefinitely.
  testTimeout: 15000,

  // ─── Environment setup ────────────────────────────────────────────────────
  // Runs BEFORE any test file or module is imported.
  // Sets NODE_ENV=test and DATABASE_URL → mcom_mall_test (never touches prod DB).
  setupFiles: ['<rootDir>/test/jest-setup.ts'],
};

export default config;
