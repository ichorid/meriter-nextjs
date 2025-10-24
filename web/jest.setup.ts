import React from 'react';

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
  useQuery: jest.fn(),
  useMutation: jest.fn(),
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
  },
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

// Increase default test timeout for async-heavy flows
jest.setTimeout(30000);

