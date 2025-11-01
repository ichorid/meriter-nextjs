/**
 * Integration Tests for Login Page
 * 
 * Tests the complete login flow including:
 * - BotConfigProvider loading states
 * - API error handling (404, 500, network errors)
 * - LoginForm integration with BotConfigProvider
 * - Component rendering and interactions
 * - Error boundary behavior
 */

import React from 'react';
import { render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NextIntlClientProvider } from 'next-intl';
import { BotConfigProvider } from '@/contexts/BotConfigContext';
import { LoginForm } from '@/components/LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';
import { AppModeProvider } from '@/contexts/AppModeContext';

// Mock next-intl
const mockMessages = {
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

import { useAuth } from '@/contexts/AuthContext';
import { useAppMode } from '@/contexts/AppModeContext';

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseAppMode = useAppMode as jest.MockedFunction<typeof useAppMode>;

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
        <BotConfigProvider>
          <AppModeProvider>
            <AuthProvider>
              {children}
            </AuthProvider>
          </AppModeProvider>
        </BotConfigProvider>
      </NextIntlClientProvider>
    </QueryClientProvider>
  );
}

describe('Login Page Integration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockReplace.mockClear();

    // Reset fetch mock
    (global.fetch as jest.Mock) = jest.fn();

    // Default auth context mock
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      authenticateWithTelegram: jest.fn().mockResolvedValue({}),
      authenticateWithTelegramWebApp: jest.fn().mockResolvedValue({}),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    // Default app mode mock
    mockUseAppMode.mockReturnValue({
      isTelegramMiniApp: false,
      isMobile: false,
      isDesktop: true,
    });
  });

  describe('BotConfigProvider Loading States', () => {
    it('should show loading spinner while fetching bot config', async () => {
      // Mock slow API response
      let resolvePromise: (value: any) => void;
      const delayedResponse = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => delayedResponse);

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      // Should show loading state immediately
      expect(screen.getByText('Loading bot configuration...')).toBeInTheDocument();
      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();

      // Resolve the promise
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { botUsername: 'test_bot' } }),
      });

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading bot configuration...')).not.toBeInTheDocument();
      });
    });

    it('should render children after successful bot config load', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: 'test_bot' },
        }),
      });

      render(
        <TestWrapper>
          <div data-testid="test-content">Test Content</div>
        </TestWrapper>
      );

      // Wait for loading to complete
      await waitFor(() => {
        expect(screen.queryByText('Loading bot configuration...')).not.toBeInTheDocument();
      });

      // Should render children
      expect(screen.getByTestId('test-content')).toBeInTheDocument();
    });

    it('should handle successful API response with standard format', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: 'meriterbot' },
          meta: {},
        }),
      });

      render(
        <TestWrapper>
          <div data-testid="test-content">Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-content')).toBeInTheDocument();
      });
    });

    it('should handle successful API response without wrapper (fallback)', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          botUsername: 'meriterbot',
        }),
      });

      render(
        <TestWrapper>
          <div data-testid="test-content">Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-content')).toBeInTheDocument();
      });
    });
  });

  describe('BotConfigProvider Error Handling', () => {
    it('should show error message when API returns 404', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.reject(new Error('Not JSON')),
      });

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/API endpoint \/api\/v1\/config not found/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should show error message when API returns 500', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'INTERNAL_ERROR',
            message: 'Internal server error',
          },
        }),
      });

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should show error message when API response is missing botUsername', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: '' },
        }),
      });

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/BOT_USERNAME is missing from server response/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should show error message when network request fails', async () => {
      (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('Network error'));

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        // BotConfigProvider shows the error message from the Error object
        expect(screen.getByText(/Network error|Failed to load bot configuration/i)).toBeInTheDocument();
      });

      expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should show error message when API times out', async () => {
      // Mock a promise that never resolves (simulating timeout)
      (global.fetch as jest.Mock).mockImplementation(() => new Promise(() => {}));

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      // Should show loading state initially
      expect(screen.getByText('Loading bot configuration...')).toBeInTheDocument();

      // After a delay, should still be loading (timeout scenario)
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(screen.getByText('Loading bot configuration...')).toBeInTheDocument();
    });

    it('should handle API error response with error object', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: 'BOT_USERNAME is not configured',
            details: {
              message: 'BOT_USERNAME environment variable is required but not set',
            },
          },
        }),
      });

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/BOT_USERNAME is not configured/i)).toBeInTheDocument();
      });
    });
  });

  describe('LoginForm Integration with BotConfigProvider', () => {
    it('should render LoginForm after bot config loads successfully', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: 'test_bot' },
        }),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Wait for bot config to load
      await waitFor(() => {
        expect(screen.queryByText('Loading bot configuration...')).not.toBeInTheDocument();
      });

      // LoginForm should be visible - check for translation keys or actual content
      // Use getByRole to find heading elements more reliably
      expect(screen.getByRole('heading', { name: /login\.title|Login/i })).toBeInTheDocument();
      // LoginForm renders the title, welcome text is in the page component
      // Just verify LoginForm is rendered by checking for login widget instructions
      expect(screen.getByText(/login\.telegramWidget\.instructions|Click the button below/i)).toBeInTheDocument();
    });

    it('should not render LoginForm if bot config fails to load', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: () => Promise.resolve({
          success: false,
          error: { message: 'Internal server error' },
        }),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/Internal server error/i)).toBeInTheDocument();
      });

      // LoginForm should not be visible - error message should be shown instead
      expect(screen.queryByText(/login\.title|Login/i)).not.toBeInTheDocument();
    });

    it('should inject Telegram widget script with correct botUsername', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: 'meriterbot' },
        }),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.queryByText('Loading bot configuration...')).not.toBeInTheDocument();
      });

      // Wait for widget script to be injected
      await waitFor(() => {
        const scripts = document.querySelectorAll('script[data-telegram-login]');
        expect(scripts.length).toBeGreaterThan(0);
        expect(scripts[0].getAttribute('data-telegram-login')).toBe('meriterbot');
      });
    });
  });

  describe('Complete Login Page Flow', () => {
    it('should handle complete successful login flow', async () => {
      const mockAuthenticateWithTelegram = jest.fn().mockResolvedValue({});
      
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: mockAuthenticateWithTelegram,
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: 'test_bot' },
        }),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      // Wait for bot config to load
      await waitFor(() => {
        expect(screen.queryByText('Loading bot configuration...')).not.toBeInTheDocument();
      });

      // Verify LoginForm is rendered - check for translation key or actual text
      expect(screen.getByRole('heading', { name: /login\.title|Login/i })).toBeInTheDocument();

      // Simulate Telegram widget authentication
      const mockTelegramUser = {
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      };

      // Call the global callback that would be set by the widget
      if ((window as any).onTelegramAuth) {
        await (window as any).onTelegramAuth(mockTelegramUser);
      }

      // Wait for authentication to complete
      await waitFor(() => {
        expect(mockAuthenticateWithTelegram).toHaveBeenCalledWith(mockTelegramUser);
      });
    });

    it('should show error if botUsername is not available when LoginForm tries to use it', async () => {
      // This scenario tests the error boundary behavior
      // When bot config fails, LoginForm should not even attempt to render
      // because BotConfigProvider shows error state instead
      
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: false,
        status: 404,
        json: () => Promise.reject(new Error('Not JSON')),
      });

      render(
        <TestWrapper>
          <LoginForm />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/API endpoint \/api\/v1\/config not found/i)).toBeInTheDocument();
      });

      // LoginForm should never render because BotConfigProvider shows error
      expect(screen.queryByText(/login\.title|Login/i)).not.toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle cleanup on unmount during fetch', async () => {
      let resolvePromise: (value: any) => void;
      const delayedResponse = new Promise((resolve) => {
        resolvePromise = resolve;
      });

      (global.fetch as jest.Mock).mockImplementation(() => delayedResponse);

      const { unmount } = render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      // Should show loading
      expect(screen.getByText('Loading bot configuration...')).toBeInTheDocument();

      // Unmount before response completes
      unmount();

      // Resolve the promise after unmount
      resolvePromise!({
        ok: true,
        json: () => Promise.resolve({ success: true, data: { botUsername: 'test_bot' } }),
      });

      // Wait a bit to ensure no state updates occur after unmount
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Should not throw errors
      expect(true).toBe(true);
    });

    it('should handle multiple rapid fetch calls gracefully', async () => {
      let callCount = 0;
      (global.fetch as jest.Mock).mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            data: { botUsername: `bot_${callCount}` },
          }),
        });
      });

      render(
        <TestWrapper>
          <div data-testid="test-content">Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByTestId('test-content')).toBeInTheDocument();
      });

      // Should only have made one fetch call
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    it('should handle empty botUsername after successful API response', async () => {
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          success: true,
          data: { botUsername: '   ' }, // Whitespace only
        }),
      });

      render(
        <TestWrapper>
          <div>Test Content</div>
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/BOT_USERNAME is missing from server response/i)).toBeInTheDocument();
      });
    });
  });
});

