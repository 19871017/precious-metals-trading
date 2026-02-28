import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';
import { jest } from '@jest/globals';

// Mock database
jest.mock('../config/database', () => ({
  query: jest.fn(),
  transaction: jest.fn(),
}));

// Mock Redis
jest.mock('../utils/redis', () => ({
  default: new Redis(),
}));

// Mock logger
jest.mock('../utils/logger', () => ({
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Global test setup
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});