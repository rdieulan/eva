// Test setup file
import { vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Mock localStorage
const localStorageMock = {
  store: {} as Record<string, string>,
  getItem: vi.fn((key: string) => localStorageMock.store[key] || null),
  setItem: vi.fn((key: string, value: string) => {
    localStorageMock.store[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete localStorageMock.store[key];
  }),
  clear: vi.fn(() => {
    localStorageMock.store = {};
  }),
};

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

// Mock fetch API
global.fetch = vi.fn();

// Reset mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
  localStorageMock.clear();
});

