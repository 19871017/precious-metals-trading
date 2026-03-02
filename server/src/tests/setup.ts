import { jest } from '@jest/globals';

const mockQuery = jest.fn();
const mockTransaction = jest.fn();
const mockFindOne = jest.fn();
const mockPoolConnect = jest.fn();

// Mock database module
jest.mock('../config/database', () => ({
  __esModule: true,
  query: mockQuery,
  transaction: mockTransaction,
  findOne: mockFindOne,
  dbAvailable: true,
  pool: {
    connect: mockPoolConnect,
  },
}));

// Mock Redis module
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  expire: jest.fn(),
  incr: jest.fn(),
  decr: jest.fn(),
};

jest.mock('../utils/redis', () => ({
  __esModule: true,
  default: mockRedis,
}));

// Mock logger (silent)
jest.mock('../utils/logger', () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

beforeEach(() => {
  mockQuery.mockReset();
  mockTransaction.mockReset();
  mockFindOne.mockReset();
  mockPoolConnect.mockReset();
  Object.values(mockRedis).forEach((fn: any) => {
    if (typeof fn.mockReset === 'function') {
      fn.mockReset();
    }
  });
});
