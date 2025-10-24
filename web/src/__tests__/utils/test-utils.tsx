/**
 * Test Utilities for Component Testing
 * 
 * Provides utilities for testing React components with:
 * - Custom render function with providers
 * - Mock data generators
 * - Test helpers for common patterns
 */

import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';

// Mock messages for next-intl
const mockMessages = {
  shared: {
    logout: 'Logout',
    cancel: 'Cancel',
    confirm: 'Confirm',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
  },
  login: {
    title: 'Login',
    welcome: 'Welcome',
    subtitle: 'Sign in to continue',
    telegramWidget: {
      instructions: 'Click the button below to sign in with Telegram',
    },
    telegramWebApp: {
      detected: 'Telegram Web App detected',
    },
    backToHome: 'Back to Home',
  },
  home: {
    title: 'Home',
    publications: 'Publications',
    wallets: 'Wallets',
    updates: 'Updates',
  },
};

// Create a custom render function that includes providers
interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  queryClient?: QueryClient;
  locale?: string;
  messages?: Record<string, any>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
        mutations: {
          retry: false,
        },
      },
    }),
    locale = 'en',
    messages = mockMessages,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </QueryClientProvider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Mock user data generator
export const mockUser = {
  id: '1',
  tgUserId: '12345',
  username: 'testuser',
  firstName: 'Test',
  lastName: 'User',
  photoUrl: 'https://example.com/photo.jpg',
  token: 'mock-token',
};

// Mock API responses
export const mockApiResponses = {
  user: {
    success: true,
    data: mockUser,
  },
  auth: {
    success: true,
    data: {
      user: mockUser,
      token: 'mock-token',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    },
  },
  error: {
    success: false,
    error: 'Mock error message',
  },
};

// Mock Telegram Web App data
export const mockTelegramData = {
  initData: 'mock-init-data',
  user: {
    id: 12345,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_bot: false,
    is_premium: true,
  },
  launchParams: {
    tgWebAppStartParam: 'test-param',
  },
};

// Mock fetch responses
export const mockFetch = (response: any, status = 200) => {
  const mockResponse = {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  };
  
  (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);
  return mockResponse;
};

// Mock fetch error
export const mockFetchError = (error: string) => {
  (global.fetch as jest.Mock).mockRejectedValueOnce(new Error(error));
};

// Test helpers for common patterns
export const testUtils = {
  // Wait for async operations
  waitFor: (ms: number) => new Promise(resolve => setTimeout(resolve, ms)),
  
  // Mock localStorage
  mockLocalStorage: (data: Record<string, string> = {}) => {
    const mockStorage = {
      getItem: jest.fn((key: string) => data[key] || null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: Object.keys(data).length,
      key: jest.fn(),
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockStorage,
      writable: true,
    });
    
    return mockStorage;
  },
  
  // Mock sessionStorage
  mockSessionStorage: (data: Record<string, string> = {}) => {
    const mockStorage = {
      getItem: jest.fn((key: string) => data[key] || null),
      setItem: jest.fn(),
      removeItem: jest.fn(),
      clear: jest.fn(),
      length: Object.keys(data).length,
      key: jest.fn(),
    };
    
    Object.defineProperty(window, 'sessionStorage', {
      value: mockStorage,
      writable: true,
    });
    
    return mockStorage;
  },
  
  // Mock URL search params
  mockSearchParams: (params: Record<string, string> = {}) => {
    const searchParams = new URLSearchParams(params);
    jest.mocked(require('next/navigation').useSearchParams).mockReturnValue(searchParams);
    return searchParams;
  },
  
  // Mock router
  mockRouter: (mockRouter = {}) => {
    const defaultRouter = {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      forward: jest.fn(),
      refresh: jest.fn(),
    };
    
    jest.mocked(require('next/navigation').useRouter).mockReturnValue({
      ...defaultRouter,
      ...mockRouter,
    });
    
    return { ...defaultRouter, ...mockRouter };
  },
};

// Re-export everything from @testing-library/react
export * from '@testing-library/react';

// Add a test to make this file valid
describe('Test Utils', () => {
  it('should export test utilities', () => {
    expect(renderWithProviders).toBeDefined();
    expect(mockUser).toBeDefined();
    expect(mockApiResponses).toBeDefined();
    expect(testUtils).toBeDefined();
  });
});
