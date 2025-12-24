/**
 * Tests for AuthContext
 * 
 * Tests the centralized authentication context including:
 * - User state management
 * - Authentication methods
 * - Error handling
 * - Token management
 */

import React from 'react';
import { renderWithProviders, mockUser, _mockApiResponses, testUtils } from '../utils/test-utils';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useMe, useTelegramAuth, useTelegramWebAppAuth, useLogout } from '@/hooks/api/useAuth';

// Mock the auth hooks
jest.mock('@/hooks/api/useAuth');
jest.mock('@/shared/lib/deep-link-handler');

const mockUseMe = useMe as jest.MockedFunction<typeof useMe>;
const mockUseTelegramAuth = useTelegramAuth as jest.MockedFunction<typeof useTelegramAuth>;
const mockUseTelegramWebAppAuth = useTelegramWebAppAuth as jest.MockedFunction<typeof useTelegramWebAppAuth>;
const mockUseLogout = useLogout as jest.MockedFunction<typeof useLogout>;

// Mock deep link handler
jest.mock('@/shared/lib/deep-link-handler', () => ({
  useDeepLinkHandler: jest.fn(() => ({
    handleDeepLink: jest.fn(),
  })),
}));

// Test component that uses the auth context
function TestComponent() {
  const auth = useAuth();
  
  return (
    <div>
      <div data-testid="user-id">{auth.user?.id || 'no-user'}</div>
      <div data-testid="is-authenticated">{auth.isAuthenticated ? 'true' : 'false'}</div>
      <div data-testid="is-loading">{auth.isLoading ? 'true' : 'false'}</div>
      <div data-testid="auth-error">{auth.authError || 'no-error'}</div>
      <button 
        data-testid="telegram-auth-btn"
        onClick={() => auth.authenticateWithTelegram(mockUser)}
      >
        Telegram Auth
      </button>
      <button 
        data-testid="webapp-auth-btn"
        onClick={() => auth.authenticateWithTelegramWebApp('mock-init-data')}
      >
        WebApp Auth
      </button>
      <button 
        data-testid="logout-btn"
        onClick={() => auth.logout()}
      >
        Logout
      </button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    testUtils.mockLocalStorage();
    testUtils.mockSessionStorage();
  });

  describe('User State Management', () => {
    it('should provide user data when authenticated', () => {
      mockUseMe.mockReturnValue({
        data: mockUser,
        isLoading: false,
        error: null,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(getByTestId('user-id')).toHaveTextContent(mockUser.id);
      expect(getByTestId('is-authenticated')).toHaveTextContent('true');
      expect(getByTestId('is-loading')).toHaveTextContent('false');
    });

    it('should show loading state when user data is loading', () => {
      mockUseMe.mockReturnValue({
        data: undefined,
        isLoading: true,
        error: null,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(getByTestId('user-id')).toHaveTextContent('no-user');
      expect(getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(getByTestId('is-loading')).toHaveTextContent('true');
    });

    it('should show error state when user data fails to load', () => {
      mockUseMe.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: new Error('Failed to load user'),
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(getByTestId('user-id')).toHaveTextContent('no-user');
      expect(getByTestId('is-authenticated')).toHaveTextContent('false');
      expect(getByTestId('auth-error')).toHaveTextContent('Failed to load user');
    });
  });

  describe('Authentication Methods', () => {
    beforeEach(() => {
      mockUseMe.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as unknown);
    });

    it('should handle Telegram widget authentication', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({});
      mockUseTelegramAuth.mockReturnValue({
        mutateAsync: mockMutateAsync,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const telegramAuthBtn = getByTestId('telegram-auth-btn');
      telegramAuthBtn.click();

      expect(mockMutateAsync).toHaveBeenCalledWith(mockUser);
    });

    it('should handle Telegram Web App authentication', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({});
      mockUseTelegramWebAppAuth.mockReturnValue({
        mutateAsync: mockMutateAsync,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const webappAuthBtn = getByTestId('webapp-auth-btn');
      webappAuthBtn.click();

      expect(mockMutateAsync).toHaveBeenCalledWith('mock-init-data');
    });

    it('should handle logout', async () => {
      const mockMutateAsync = jest.fn().mockResolvedValue({});
      mockUseLogout.mockReturnValue({
        mutateAsync: mockMutateAsync,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const logoutBtn = getByTestId('logout-btn');
      logoutBtn.click();

      expect(mockMutateAsync).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle authentication errors', async () => {
      const mockMutateAsync = jest.fn().mockRejectedValue(new Error('Auth failed'));
      mockUseTelegramAuth.mockReturnValue({
        mutateAsync: mockMutateAsync,
      } as unknown);

      mockUseMe.mockReturnValue({
        data: undefined,
        isLoading: false,
        error: null,
      } as unknown);

      const { getByTestId } = renderWithProviders(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      const telegramAuthBtn = getByTestId('telegram-auth-btn');
      telegramAuthBtn.click();

      await testUtils.waitFor(100);

      expect(getByTestId('auth-error')).toHaveTextContent('Auth failed');
    });
  });

  describe('Context Provider', () => {
    it('should throw error when useAuth is used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderWithProviders(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleSpy.mockRestore();
    });
  });
});