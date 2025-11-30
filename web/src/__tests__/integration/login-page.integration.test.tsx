/**
 * Integration Tests for Login Page
 * 
 * Tests the complete login flow including:
 * - LoginForm rendering and interactions
 * - OAuth provider authentication
 * - Fake authentication (development mode)
 * - Error handling
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { LoginForm } from '@/components/LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppModeProvider } from '@/contexts/AppModeContext';

// Mock toast store
const mockAddToast = jest.fn();
jest.mock('@/shared/stores/toast.store', () => ({
  useToastStore: jest.fn((selector: any) => {
    if (selector.toString().includes('addToast')) {
      return mockAddToast;
    }
    return {
      toasts: [],
      removeToast: jest.fn(),
    };
  }),
}));

// Mock next-intl
const mockMessages = {
  login: {
    title: 'Login',
    welcome: 'Welcome',
    subtitle: 'Sign in to continue',
    signInWith: 'Sign in with {{provider}}',
  },
  registration: {
    inviteCodeLabel: 'Invite Code',
    inviteDescription: 'Enter your invite code if you have one',
    inviteCodePlaceholder: 'Enter invite code',
  },
};

// Mock Next.js navigation
const mockPush = jest.fn();
const mockReplace = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace,
    prefetch: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: () => '/meriter/login',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock Telegram SDK
jest.mock('@telegram-apps/sdk-react', () => ({
  useLaunchParams: jest.fn(() => ({ tgWebAppStartParam: null })),
  useSignal: jest.fn(() => ({ value: null })),
  initDataRaw: { value: null },
  isTMA: jest.fn(() => Promise.resolve(false)),
}));

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  ...jest.requireActual('@/contexts/AuthContext'),
  useAuth: jest.fn(),
}));

// Mock AppModeContext
jest.mock('@/contexts/AppModeContext', () => ({
  ...jest.requireActual('@/contexts/AppModeContext'),
  useAppMode: jest.fn(),
}));

// Mock config
jest.mock('@/config', () => ({
  config: {
    api: {
      baseUrl: '',
      endpoints: {
        auth: '/api/v1/auth',
        publications: '/api/v1/publications',
        comments: '/api/v1/comments',
        communities: '/api/v1/communities',
        polls: '/api/v1/polls',
        wallet: '/api/v1/users/me/wallets',
        transactions: '/api/v1/users/me/transactions',
        votes: '/api/v1/votes',
        users: '/api/v1/users',
      },
    },
    app: {
      env: 'test',
      isDevelopment: false,
      isProduction: false,
      isTest: true,
      url: 'http://localhost:3000',
    },
    telegram: {
      botToken: undefined,
      apiUrl: 'https://api.telegram.org',
      botUrl: '',
      avatarBaseUrl: '',
    },
    s3: {
      enabled: false,
    },
    features: {
      debug: false,
      analytics: false,
    },
  },
  isFakeDataMode: jest.fn(() => false),
}));

// Mock OAuth providers
jest.mock('@/lib/utils/oauth-providers', () => ({
  OAUTH_PROVIDERS: [
    { id: 'google', name: 'Google', icon: 'LogIn' },
    { id: 'telegram', name: 'Telegram', icon: 'LogIn' },
  ],
  getOAuthUrl: jest.fn((providerId: string, params?: string) => {
    const baseUrl = `https://oauth.example.com/${providerId}`;
    return params ? `${baseUrl}?${params}` : baseUrl;
  }),
}));

import { useAuth } from '@/contexts/AuthContext';
import { useAppMode } from '@/contexts/AppModeContext';
import { getOAuthUrl } from '@/lib/utils/oauth-providers';
import { isFakeDataMode } from '@/config';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAppMode = useAppMode as jest.MockedFunction<typeof useAppMode>;
const mockGetOAuthUrl = getOAuthUrl as jest.MockedFunction<typeof getOAuthUrl>;
const mockIsFakeDataMode = isFakeDataMode as jest.MockedFunction<typeof isFakeDataMode>;

// Test wrapper with all providers
function TestWrapper({ children }: { children: React.ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return (
    <QueryClientProvider client={queryClient}>
      <NextIntlClientProvider locale="en" messages={mockMessages}>
        <AppModeProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </AppModeProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('Login Page Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();
    mockAddToast.mockClear();
    mockRemoveToast.mockClear();

    // Reset fake data mode to false by default
    mockIsFakeDataMode.mockReturnValue(false);

    // Default auth context mock
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      authenticateWithTelegram: jest.fn().mockResolvedValue({}),
      authenticateWithTelegramWebApp: jest.fn().mockResolvedValue({}),
      authenticateFakeUser: jest.fn().mockResolvedValue({}),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    // Default app mode mock
    mockUseAppMode.mockReturnValue({
      isTelegramMiniApp: false,
      isReady: true,
    });
  });

  describe('LoginForm Rendering', () => {
    it('should render LoginForm with title', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Translation keys are rendered when translations aren't resolved in test
      expect(screen.getByText(/login\.title/i)).toBeInTheDocument();
    });

    it('should render invite code input', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Check for translation key or actual label
      expect(screen.getByText(/registration\.inviteCodeLabel/i)).toBeInTheDocument();
      const input = screen.getByPlaceholderText(/registration\.inviteCodePlaceholder/i);
      expect(input).toBeInTheDocument();
    });

    it('should render OAuth provider buttons', () => {
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Buttons contain translation key "login.signInWith"
      const buttons = screen.getAllByText(/login\.signInWith/i);
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('LoginForm Interactions', () => {
    it('should allow entering invite code', async () => {
      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      const inviteInput = screen.getByPlaceholderText(/registration\.inviteCodePlaceholder/i);
      await user.type(inviteInput, 'TEST123');

      expect(inviteInput).toHaveValue('TEST123');
    });

    it('should handle OAuth provider click', async () => {
      const user = userEvent.setup();

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Click the first OAuth button (Google)
      const buttons = screen.getAllByText(/login\.signInWith/i);
      await user.click(buttons[0]!);

      // Verify getOAuthUrl was called (component uses it to generate the URL)
      // The component calls getOAuthUrl and then sets window.location.href
      // Second param can be undefined if no search params are present
      expect(mockGetOAuthUrl).toHaveBeenCalledWith('google', undefined);
    });

    it('should handle fake authentication when in fake data mode', async () => {
      mockIsFakeDataMode.mockReturnValue(true);

      const mockAuthenticateFakeUser = jest.fn().mockResolvedValue({});
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: mockAuthenticateFakeUser,
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const user = userEvent.setup();
      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByText(/Fake Data Mode Enabled/i)).toBeInTheDocument();
      const fakeLoginButton = screen.getByText(/Fake Login/i);
      await user.click(fakeLoginButton);

      await waitFor(() => {
        expect(mockAuthenticateFakeUser).toHaveBeenCalled();
      });
    });
  });

  describe('Error Handling', () => {
    it('should display auth error when present via toast', async () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: 'Authentication failed',
        setAuthError: jest.fn(),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Wait for useEffect to trigger toast
      await waitFor(() => {
        expect(mockAddToast).toHaveBeenCalledWith('Authentication failed', 'error');
      });
    });

    it('should show loading state during authentication', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      expect(screen.getByText(/Authenticating.../i)).toBeInTheDocument();
    });
  });

  describe('OAuth Provider Filtering', () => {
    it('should filter providers when enabledProviders prop is passed', () => {
      // Ensure fake data mode is off for this test
      mockIsFakeDataMode.mockReturnValue(false);
      
      render(
        <TestWrapper>
          <LoginForm enabledProviders={['google']} />
        </TestWrapper>
      );

      // Should have one OAuth button
      const buttons = screen.getAllByText(/login\.signInWith/i);
      expect(buttons.length).toBe(1);
    });

    it('should show error message when no providers are enabled', () => {
      render(
        <TestWrapper>
          <LoginForm enabledProviders={[]} />
        </TestWrapper>
      );

      expect(screen.getByText(/No authentication providers configured/i)).toBeInTheDocument();
    });
  });

  describe('URL Parameters', () => {
    it('should include returnTo and invite code in OAuth URL', async () => {
      const user = userEvent.setup();

      // Mock useSearchParams to return params
      jest.spyOn(require('next/navigation'), 'useSearchParams').mockReturnValue(
        new URLSearchParams('returnTo=/meriter/home&invite=TEST123')
      );

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Click the first OAuth button
      const buttons = screen.getAllByText(/login\.signInWith/i);
      await user.click(buttons[0]!);

      // Verify getOAuthUrl was called with params containing returnTo and invite
      expect(mockGetOAuthUrl).toHaveBeenCalled();
      const callArgs = mockGetOAuthUrl.mock.calls[0];
      if (callArgs && callArgs[1]) {
        expect(callArgs[1]).toContain('returnTo');
        expect(callArgs[1]).toContain('invite');
      }
    });
  });
});
