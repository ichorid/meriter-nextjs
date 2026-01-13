import React from 'react';
import '@testing-library/jest-dom';

// Mock axios globally before anything else
jest.mock('axios');

// Mock superjson (ES module that Jest can't handle)
jest.mock('superjson', () => ({
    default: {
        serialize: jest.fn((data) => ({ json: JSON.stringify(data), meta: {} })),
        deserialize: jest.fn((data) => JSON.parse(data.json)),
        stringify: jest.fn((data) => JSON.stringify(data)),
        parse: jest.fn((data) => JSON.parse(data)),
    },
    SuperJSON: {
        serialize: jest.fn((data) => ({ json: JSON.stringify(data), meta: {} })),
        deserialize: jest.fn((data) => JSON.parse(data.json)),
        stringify: jest.fn((data) => JSON.stringify(data)),
        parse: jest.fn((data) => JSON.parse(data)),
    },
}));

// Mock tRPC client and hooks to avoid QueryClient compatibility issues in tests
// This provides a comprehensive mock for all tRPC hooks used in the application
jest.mock('@/lib/trpc/client', () => {
    // Mock query result
    const mockQueryResult = {
        data: null,
        isLoading: false,
        error: null,
        refetch: jest.fn().mockResolvedValue({ data: null }),
        isFetching: false,
        isError: false,
        isSuccess: false,
    };

    // Mock mutation result
    const mockMutationResult = {
        mutateAsync: jest.fn().mockResolvedValue({}),
        mutate: jest.fn(),
        isLoading: false,
        error: null,
        isError: false,
        isSuccess: false,
    };

    // Create a mock utils object with invalidate methods
    const createMockUtils = () => ({
        users: {
            getMe: { invalidate: jest.fn() },
        },
        comments: {
            getReplies: { invalidate: jest.fn() },
            getByPublicationId: { invalidate: jest.fn() },
        },
        votes: {
            create: { 
                invalidate: jest.fn(),
                mutateAsync: jest.fn().mockResolvedValue({}),
            },
        },
        wallets: {
            getByCommunity: { invalidate: jest.fn() },
            getAll: { invalidate: jest.fn() },
            getBalance: { invalidate: jest.fn() },
            getTransactions: { invalidate: jest.fn() },
            withdraw: { invalidate: jest.fn() },
        },
        publications: {
            getBySlug: { invalidate: jest.fn() },
            getByCommunity: { invalidate: jest.fn() },
        },
        communities: {
            getById: { invalidate: jest.fn() },
        },
    });

    // Create a proxy that returns mocks for any property access
    // This handles nested paths like trpc.users.getMe.useQuery
    // The proxy returns itself for any property, and also provides useQuery, useMutation, etc.
    const createTRPCProxy = (): any => {
        const handler: ProxyHandler<any> = {
            get: (_target, prop: string) => {
                if (prop === 'useUtils') {
                    return jest.fn(() => createMockUtils());
                }
                if (prop === 'Provider') {
                    return ({ children }: { children: React.ReactNode }) => children;
                }
                if (prop === 'useQuery') {
                    return jest.fn(() => mockQueryResult);
                }
                if (prop === 'useMutation') {
                    return jest.fn(() => mockMutationResult);
                }
                if (prop === 'useInfiniteQuery') {
                    return jest.fn(() => ({
                        data: { pages: [], pageParams: [] },
                        isLoading: false,
                        error: null,
                        fetchNextPage: jest.fn(),
                        hasNextPage: false,
                        isFetching: false,
                        isError: false,
                        isSuccess: false,
                    }));
                }
                if (prop === 'invalidate') {
                    return jest.fn();
                }
                if (prop === 'mutateAsync') {
                    return jest.fn().mockResolvedValue({});
                }
                // For any other property, return another proxy (allows infinite nesting)
                // This makes trpc.users.getMe.useQuery work
                return createTRPCProxy();
            },
        };
        return new Proxy({}, handler);
    };

    return {
        trpc: createTRPCProxy(),
        getTrpcClient: jest.fn(() => ({
            links: [],
            transformer: {},
        })),
    };
});

// Mock next-intl
jest.mock('next-intl', () => ({
    useTranslations: jest.fn((namespace: string) => (key: string) => `${namespace}.${key}`),
    useLocale: jest.fn(() => 'en'),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next-intl/server', () => ({
    getMessages: jest.fn(() => Promise.resolve({})),
}));

// Mock Next.js 15 App Router navigation
jest.mock('next/navigation', () => ({
    useRouter: jest.fn(() => ({
        push: jest.fn(),
        replace: jest.fn(),
        prefetch: jest.fn(),
        back: jest.fn(),
        forward: jest.fn(),
        refresh: jest.fn(),
    })),
    usePathname: jest.fn(() => '/'),
    useSearchParams: jest.fn(() => new URLSearchParams()),
    useParams: jest.fn(() => ({})),
}));

// Mock next/headers for server components if needed
jest.mock('next/headers', () => ({
    cookies: jest.fn(() => ({
        get: jest.fn(),
        set: jest.fn(),
        delete: jest.fn(),
    })),
    headers: jest.fn(() => ({
        get: jest.fn(),
    })),
}));

// Mock @tanstack/react-query
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn(() => ({
    data: undefined,
    isLoading: false,
    error: null,
    isFetched: false,
  })),
  useQueries: jest.fn(({ queries }: { queries: any[] }) => {
    // Return array of query results matching the queries array
    return queries.map(() => ({
      data: undefined,
      isLoading: false,
      error: null,
      isFetched: false,
    }));
  }),
  useMutation: jest.fn(() => ({
    mutateAsync: jest.fn(),
    mutate: jest.fn(),
    isLoading: false,
    error: null,
  })),
  useQueryClient: jest.fn(() => ({
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  })),
  QueryClient: jest.fn(() => ({
    setQueryData: jest.fn(),
    invalidateQueries: jest.fn(),
    clear: jest.fn(),
  })),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock @telegram-apps/sdk-react
jest.mock('@telegram-apps/sdk-react', () => ({
  useLaunchParams: jest.fn(() => ({ tgWebAppStartParam: null })),
  useSignal: jest.fn(() => ({ value: null })),
  initDataRaw: { value: null },
  isTMA: jest.fn(() => Promise.resolve(false)),
  mockTelegramEnv: jest.fn(),
  emitEvent: jest.fn(),
}));

// Mock deep link handler
jest.mock('@/shared/lib/deep-link-handler', () => ({
  useDeepLinkHandler: jest.fn(() => ({
    handleDeepLink: jest.fn(),
  })),
}));

// Mock config
jest.mock('@/config', () => ({
  config: {
    app: {
      isDevelopment: true,
      url: 'http://localhost:3000',
    },
    api: {
      url: 'http://localhost:3000',
    },
    telegram: {
      botUsername: 'test_bot',
      botToken: 'test_token',
      botUrl: 'https://t.me/test_bot',
    },
    development: {
      fakeDataMode: false,
      testAuthMode: false,
    },
  },
  isFakeDataMode: jest.fn(() => false),
  isTestAuthMode: jest.fn(() => false),
  isDevelopment: jest.fn(() => true),
  isProduction: jest.fn(() => false),
  isTest: jest.fn(() => true),
}));



// Mock localStorage and sessionStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

const sessionStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
  length: 0,
  key: jest.fn(),
};
Object.defineProperty(window, 'sessionStorage', {
  value: sessionStorageMock,
});

// Mock fetch
global.fetch = jest.fn();

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
  root: null,
  rootMargin: '',
  thresholds: [],
  takeRecords: jest.fn(() => []),
})) as any;

// Mock ResizeObserver
global.ResizeObserver = jest.fn(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock window.location.href to prevent navigation errors in tests
// Override the href setter to prevent navigation
const originalLocation = window.location;
let mockHref = originalLocation.href || 'http://localhost/';

// Store original descriptor if it exists
const locationDescriptor = Object.getOwnPropertyDescriptor(window, 'location');
const locationHrefDescriptor = Object.getOwnPropertyDescriptor(window.location, 'href');

// Try to make location configurable by deleting and redefining
try {
  // Delete location property if it's configurable
  if (locationDescriptor?.configurable) {
    delete (window as any).location;
  }
} catch (e) {
  // If deletion fails, location is not configurable - we'll work around it
}

// Override href getter/setter on the location object itself
try {
  Object.defineProperty(window.location, 'href', {
    get: () => mockHref,
    set: (value: string) => {
      // Silently capture href changes instead of triggering navigation
      mockHref = value;
    },
    configurable: true,
    enumerable: true,
  });
} catch (e) {
  // If we can't override href, location might not be configurable
  // Create a new location-like object
  const locationProxy = new Proxy(window.location, {
    set(target, prop, value) {
      if (prop === 'href') {
        mockHref = value;
        return true;
      }
      return Reflect.set(target, prop, value);
    },
    get(target, prop) {
      if (prop === 'href') {
        return mockHref;
      }
      return Reflect.get(target, prop);
    },
  });
  
  if (locationDescriptor?.configurable || !locationDescriptor) {
    Object.defineProperty(window, 'location', {
      value: locationProxy,
      writable: true,
      configurable: true,
    });
  }
}

// Suppress console errors and logs during tests (but allow them to be called)
// This prevents test noise while still allowing error tracking
// Run immediately, not in beforeAll, to catch early logs
const originalError = console.error;
const originalLog = console.log;

if (process.env.NODE_ENV === 'test') {
  console.error = jest.fn((...args) => {
    // Allow some console errors to pass through (like React warnings)
    const message = args[0]?.toString() || '';
    // Don't suppress React warnings
    if (message.includes('Warning:') || message.includes('React')) {
      originalError(...args);
    }
  });
  
  // Suppress console.log during tests
  console.log = jest.fn();
}

// Increase default test timeout for async-heavy flows
jest.setTimeout(30000);

