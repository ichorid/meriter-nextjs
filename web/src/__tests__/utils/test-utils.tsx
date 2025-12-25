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
import { AuthContext, AuthContextType } from '@/contexts/AuthContext';
import { trpc, getTrpcClient } from '@/lib/trpc/client';
import type { AppRouterInstance } from 'next/dist/shared/lib/app-router-context.shared-runtime';

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
  authContextValue?: Partial<AuthContextType>;
}

/**
 * Creates a default QueryClient for testing with retry disabled
 * Matches production QueryProvider setup for compatibility
 */
export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0, // Clear cache immediately in tests
        staleTime: 0, // Always consider data stale in tests
      },
      mutations: {
        retry: false,
      },
    },
  });
}

export function renderWithProviders(
  ui: ReactElement,
  {
    queryClient = createTestQueryClient(),
    locale = 'en',
    messages = mockMessages,
    authContextValue,
    ...renderOptions
  }: CustomRenderOptions = {}
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    const defaultAuthValue = testUtils.createMockAuthContext(authContextValue);
    // Use useState to ensure trpcClient is created once, matching production pattern
    const [trpcClient] = React.useState(() => getTrpcClient());

    return (
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <AuthContext.Provider value={defaultAuthValue}>
              {children}
            </AuthContext.Provider>
          </NextIntlClientProvider>
        </QueryClientProvider>
      </trpc.Provider>
    );
  }

  return render(ui, { wrapper: Wrapper, ...renderOptions });
}

// Create a test wrapper component factory for integration tests
export function createTestWrapper(options: CustomRenderOptions = {}) {
  return function TestWrapper({ children }: { children: React.ReactNode }) {
    const {
      queryClient = createTestQueryClient(),
      locale = 'en',
      messages = mockMessages,
      authContextValue,
    } = options;

    const defaultAuthValue = testUtils.createMockAuthContext(authContextValue);
    // Use useState to ensure trpcClient is created once, matching production pattern
    const [trpcClient] = React.useState(() => getTrpcClient());

    return (
      <trpc.Provider client={trpcClient} queryClient={queryClient}>
        <QueryClientProvider client={queryClient}>
          <NextIntlClientProvider locale={locale} messages={messages} timeZone="UTC">
            <AuthContext.Provider value={defaultAuthValue}>
              {children}
            </AuthContext.Provider>
          </NextIntlClientProvider>
        </QueryClientProvider>
      </trpc.Provider>
    );
  };
}

/**
 * Mocks Next.js router with default functions
 */
export function mockNextRouter(overrides: Partial<AppRouterInstance> = {}) {
  const mockPush = jest.fn();
  const mockRouter = {
    push: mockPush,
    replace: jest.fn(),
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
    ...overrides,
  };
  
  jest.mocked(require('next/navigation').useRouter).mockReturnValue(mockRouter);
  return { mockRouter, mockPush };
}

/**
 * Mocks Next.js search params
 */
export function mockNextSearchParams(params: Record<string, string> = {}) {
  const searchParams = new URLSearchParams(params);
  jest.mocked(require('next/navigation').useSearchParams).mockReturnValue(searchParams);
  return searchParams;
}

/**
 * Mocks Telegram SDK
 */
export function mockTelegramSDK(overrides: Partial<{
  tgWebAppStartParam: string | null;
  initData: string | null;
  isTMA: boolean;
}> = {}) {
  const defaults = {
    tgWebAppStartParam: null,
    initData: null,
    isTMA: false,
  };
  
  jest.mock('@telegram-apps/sdk-react', () => ({
    useLaunchParams: jest.fn(() => ({ tgWebAppStartParam: overrides.tgWebAppStartParam ?? defaults.tgWebAppStartParam })),
    useSignal: jest.fn(() => ({ value: null })),
    initDataRaw: { value: overrides.initData ?? defaults.initData },
    isTMA: jest.fn(() => Promise.resolve(overrides.isTMA ?? defaults.isTMA)),
  }));
}

// Mock user data generator
export const mockUser = {
  id: '1',
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
  
  
  // Create mock auth context value (shared implementation)
  createMockAuthContext: (overrides: Partial<AuthContextType> = {}): AuthContextType => ({
    user: null,
    isLoading: false,
    isAuthenticated: false,
    authenticateWithTelegram: jest.fn(),
    authenticateWithTelegramWebApp: jest.fn(),
    authenticateFakeUser: jest.fn(),
    logout: jest.fn(),
    handleDeepLink: jest.fn(),
    authError: null,
    setAuthError: jest.fn(),
    ...overrides,
  }),
  
  // Mock Next.js router (shared implementation)
  mockRouter: mockNextRouter,
  
  // Mock Next.js search params (shared implementation)
  mockSearchParams: mockNextSearchParams,
  
  // Wait for query to resolve
  waitForQuery: async (queryClient: QueryClient, queryKey: readonly unknown[]) => {
    await queryClient.ensureQueryData({ queryKey });
  },
  
  // Create mock query client with specific data
  createMockQueryClient: (initialData: Array<{ queryKey: readonly unknown[]; data: any }> = []) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
    
    initialData.forEach(({ queryKey, data }) => {
      queryClient.setQueryData(queryKey, data);
    });
    
    return queryClient;
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
