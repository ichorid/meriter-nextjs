/**
 * Tests for LoginForm Component
 * 
 * Tests the centralized login form component including:
 * - Telegram widget authentication
 * - Telegram Web App authentication
 * - Error handling
 * - Loading states
 * - Deep link handling
 */

import React from 'react';
import { renderWithProviders, testUtils, mockUser } from '../utils/test-utils';
import { LoginForm } from '@/components/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { useBotConfig } from '@/contexts/BotConfigContext';

// Mock the auth context
jest.mock('@/contexts/AuthContext');

// Mock the bot config context
jest.mock('@/contexts/BotConfigContext');

// Mock Telegram SDK
jest.mock('@telegram-apps/sdk-react', () => ({
  useLaunchParams: jest.fn(() => ({ tgWebAppStartParam: null })),
  useSignal: jest.fn(() => ({ value: null })),
  initDataRaw: { value: null },
  isTMA: jest.fn(() => Promise.resolve(false)),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseBotConfig = useBotConfig as jest.MockedFunction<typeof useBotConfig>;

// Mock Next.js navigation
const mockPush = jest.fn();
jest.mocked(require('next/navigation').useRouter).mockReturnValue({
  push: mockPush,
  replace: jest.fn(),
  prefetch: jest.fn(),
  back: jest.fn(),
  forward: jest.fn(),
  refresh: jest.fn(),
});

// Mock search params
jest.mocked(require('next/navigation').useSearchParams).mockReturnValue(
  new URLSearchParams('?returnTo=/meriter/home')
);

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    
    mockUseAuth.mockReturnValue({
      user: null,
      isLoading: false,
      isAuthenticated: false,
      authenticateWithTelegram: jest.fn(),
      authenticateWithTelegramWebApp: jest.fn(),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    mockUseBotConfig.mockReturnValue({
      botUsername: 'test_bot',
    });
  });

  describe('Rendering', () => {
    it('should render login form with title and instructions', () => {
      const { getByText } = renderWithProviders(<LoginForm />);

      expect(getByText('login.welcome')).toBeInTheDocument();
      expect(getByText('login.subtitle')).toBeInTheDocument();
    });

    it('should render Telegram widget when not in Telegram environment', () => {
      const { container } = renderWithProviders(<LoginForm />);

      // Check if Telegram widget container exists
      const widgetContainer = container.querySelector('[data-telegram-login]');
      expect(widgetContainer).toBeInTheDocument();
    });

    it('should render Telegram Web App message when in Telegram environment', async () => {
      // Mock Telegram Web App environment
      jest.mocked(require('@telegram-apps/sdk-react').isTMA).mockResolvedValue(true);
      jest.mocked(require('@telegram-apps/sdk-react').useLaunchParams).mockReturnValue({
        tgWebAppStartParam: 'test-param',
      });
      jest.mocked(require('@telegram-apps/sdk-react').useSignal).mockReturnValue({
        value: 'mock-init-data',
      });

      const { getByText } = renderWithProviders(<LoginForm />);

      // Wait for async operations
      await testUtils.waitFor(100);

      expect(getByText('login.telegramWebApp.detected')).toBeInTheDocument();
    });
  });

  describe('Authentication Flow', () => {
    it('should handle Telegram widget authentication', async () => {
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

      renderWithProviders(<LoginForm />);

      // Simulate Telegram widget authentication
      const mockTelegramUser = {
        id: 12345,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
      };

      // Call the global callback that would be set by the widget
      (window as any).onTelegramAuth(mockTelegramUser);

      await testUtils.waitFor(100);

      expect(mockAuthenticateWithTelegram).toHaveBeenCalledWith(mockTelegramUser);
    });

    it('should handle Telegram Web App authentication', async () => {
      const mockAuthenticateWithTelegramWebApp = jest.fn().mockResolvedValue({});
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: mockAuthenticateWithTelegramWebApp,
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      // Mock Telegram Web App environment
      jest.mocked(require('@telegram-apps/sdk-react').isTMA).mockResolvedValue(true);
      jest.mocked(require('@telegram-apps/sdk-react').useLaunchParams).mockReturnValue({
        tgWebAppStartParam: 'test-param',
      });
      jest.mocked(require('@telegram-apps/sdk-react').useSignal).mockReturnValue({
        value: 'mock-init-data',
      });

      renderWithProviders(<LoginForm />);

      // Wait for async operations
      await testUtils.waitFor(100);

      expect(mockAuthenticateWithTelegramWebApp).toHaveBeenCalledWith('mock-init-data');
    });

    it('should redirect after successful authentication', async () => {
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

      renderWithProviders(<LoginForm />);

      // Simulate successful authentication
      const mockTelegramUser = mockUser;
      (window as any).onTelegramAuth(mockTelegramUser);

      await testUtils.waitFor(100);

      expect(mockPush).toHaveBeenCalledWith('/meriter/home');
    });
  });

  describe('Error Handling', () => {
    it('should display authentication errors', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: 'Authentication failed',
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(<LoginForm />);

      expect(getByText('Authentication failed')).toBeInTheDocument();
    });

    it('should handle authentication errors gracefully', async () => {
      const mockSetAuthError = jest.fn();
      const mockAuthenticateWithTelegram = jest.fn().mockRejectedValue(new Error('Auth failed'));
      
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: mockAuthenticateWithTelegram,
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: mockSetAuthError,
      });

      renderWithProviders(<LoginForm />);

      // Simulate failed authentication
      const mockTelegramUser = mockUser;
      (window as any).onTelegramAuth(mockTelegramUser);

      await testUtils.waitFor(100);

      expect(mockSetAuthError).toHaveBeenCalledWith('Auth failed');
    });
  });

  describe('Loading States', () => {
    it('should show loading state when authenticating', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: true,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(<LoginForm />);

      expect(getByText('Authenticating...')).toBeInTheDocument();
    });
  });

  describe('Deep Link Handling', () => {
    it('should handle deep links when in Telegram environment', async () => {
      const mockHandleDeepLink = jest.fn();
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: mockHandleDeepLink,
        authError: null,
        setAuthError: jest.fn(),
      });

      // Mock Telegram Web App environment with start param
      jest.mocked(require('@telegram-apps/sdk-react').isTMA).mockResolvedValue(true);
      jest.mocked(require('@telegram-apps/sdk-react').useLaunchParams).mockReturnValue({
        tgWebAppStartParam: 'test-param',
      });
      jest.mocked(require('@telegram-apps/sdk-react').useSignal).mockReturnValue({
        value: 'mock-init-data',
      });

      renderWithProviders(<LoginForm />);

      // Wait for async operations
      await testUtils.waitFor(100);

      expect(mockHandleDeepLink).toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate back to home when back button is clicked', () => {
      const { getByText } = renderWithProviders(<LoginForm />);

      const backButton = getByText('login.backToHome');
      backButton.click();

      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });
});
