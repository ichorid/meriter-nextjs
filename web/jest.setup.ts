import React from 'react';
import '@testing-library/jest-dom';

// Mock axios globally before anything else
jest.mock('axios');

// Mock next-intl
jest.mock('next-intl', () => ({
    useTranslations: jest.fn((namespace: string) => (key: string) => `${namespace}.${key}`),
    useLocale: jest.fn(() => 'en'),
    NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock('next-intl/server', () => ({
    getMessages: jest.fn(() => Promise.resolve({})),
}));

// Mock next/config
jest.mock('next/config', () => () => ({
    publicRuntimeConfig: {},
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
  })),
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
jest.mock('./src/config/index.ts', () => ({
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
    },
  },
  isFakeDataMode: jest.fn(() => false),
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

// Mock @gluestack-ui/themed to avoid ES module issues
jest.mock('@gluestack-ui/themed', () => ({
  Button: 'Button',
  ButtonText: 'ButtonText',
  Spinner: 'Spinner',
  Card: 'Card',
  CardHeader: 'CardHeader',
  CardBody: 'CardBody',
  CardFooter: 'CardFooter',
  VStack: 'VStack',
  HStack: 'HStack',
  Heading: 'Heading',
  Text: 'Text',
  Box: 'Box',
  Center: 'Center',
}));

// Increase default test timeout for async-heavy flows
jest.setTimeout(30000);

