// Import jest-dom matchers
import '@testing-library/jest-dom';

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

// Increase default test timeout for async-heavy flows
jest.setTimeout(30000);

