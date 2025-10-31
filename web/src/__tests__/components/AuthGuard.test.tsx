/**
 * Tests for AuthGuard Component
 * 
 * Tests the authentication guard component including:
 * - Route protection
 * - Authentication state checking
 * - Redirect handling
 * - Loading states
 * - Error handling
 */

import React from 'react';
import { renderWithProviders, testUtils } from '../utils/test-utils';
import { AuthGuard, withAuthGuard, useAuthGuard } from '@/components/AuthGuard';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
jest.mock('@/contexts/AuthContext');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

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

// Test component
function TestComponent() {
  return <div data-testid="protected-content">Protected Content</div>;
}

describe('AuthGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
  });

  describe('Authentication State Handling', () => {
    it('should render children when user is authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByTestId } = renderWithProviders(
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      );

      expect(getByTestId('protected-content')).toBeInTheDocument();
    });

    it('should show loading state when authentication is loading', () => {
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

      const { getByTestId } = renderWithProviders(
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      );

      expect(getByTestId('loading-spinner')).toBeInTheDocument();
    });

    it('should redirect to login when user is not authenticated', () => {
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

      // Mock window.location.pathname
      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/meriter/home',
        },
        writable: true,
      });

      renderWithProviders(
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      );

      expect(mockPush).toHaveBeenCalledWith('/meriter/login?returnTo=%2Fmeriter%2Fhome');
    });

    it('should show error state when authentication fails', () => {
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

      const { getByTestId } = renderWithProviders(
        <AuthGuard>
          <TestComponent />
        </AuthGuard>
      );

      expect(getByTestId('auth-error')).toBeInTheDocument();
      expect(getByTestId('auth-error')).toHaveTextContent('Authentication failed');
    });
  });

  describe('Custom Options', () => {
    it('should use custom redirect URL', () => {
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

      Object.defineProperty(window, 'location', {
        value: {
          pathname: '/meriter/home',
        },
        writable: true,
      });

      renderWithProviders(
        <AuthGuard redirectTo="/custom-login">
          <TestComponent />
        </AuthGuard>
      );

      expect(mockPush).toHaveBeenCalledWith('/custom-login?returnTo=%2Fmeriter%2Fhome');
    });

    it('should use custom fallback component', () => {
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

      const CustomFallback = () => <div data-testid="custom-fallback">Custom Loading</div>;

      const { getByTestId } = renderWithProviders(
        <AuthGuard fallback={<CustomFallback />}>
          <TestComponent />
        </AuthGuard>
      );

      expect(getByTestId('custom-fallback')).toBeInTheDocument();
    });

    it('should not require authentication when requireAuth is false', () => {
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

      const { getByTestId } = renderWithProviders(
        <AuthGuard requireAuth={false}>
          <TestComponent />
        </AuthGuard>
      );

      expect(getByTestId('protected-content')).toBeInTheDocument();
      expect(mockPush).not.toHaveBeenCalled();
    });
  });
});

describe('withAuthGuard HOC', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should wrap component with AuthGuard', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1' },
      isLoading: false,
      isAuthenticated: true,
      authenticateWithTelegram: jest.fn(),
      authenticateWithTelegramWebApp: jest.fn(),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    const ProtectedComponent = withAuthGuard(TestComponent);

    const { getByTestId } = renderWithProviders(<ProtectedComponent />);

    expect(getByTestId('protected-content')).toBeInTheDocument();
  });
});

describe('useAuthGuard Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should provide authentication guard functionality', () => {
    mockUseAuth.mockReturnValue({
      user: { id: '1' },
      isLoading: false,
      isAuthenticated: true,
      authenticateWithTelegram: jest.fn(),
      authenticateWithTelegramWebApp: jest.fn(),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    function TestHookComponent() {
      const { requireAuth, isAuthenticated, isLoading, user } = useAuthGuard();
      
      return (
        <div>
          <div data-testid="is-authenticated">{isAuthenticated ? 'true' : 'false'}</div>
          <div data-testid="is-loading">{isLoading ? 'true' : 'false'}</div>
          <div data-testid="user-id">{user?.id || 'no-user'}</div>
          <button 
            data-testid="require-auth-btn"
            onClick={() => requireAuth()}
          >
            Require Auth
          </button>
        </div>
      );
    }

    const { getByTestId } = renderWithProviders(<TestHookComponent />);

    expect(getByTestId('is-authenticated')).toHaveTextContent('true');
    expect(getByTestId('is-loading')).toHaveTextContent('false');
    expect(getByTestId('user-id')).toHaveTextContent('1');
  });

  it('should redirect when requireAuth is called and user is not authenticated', () => {
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

    Object.defineProperty(window, 'location', {
      value: {
        pathname: '/meriter/home',
      },
      writable: true,
    });

    function TestHookComponent() {
      const { requireAuth } = useAuthGuard();
      
      return (
        <button 
          data-testid="require-auth-btn"
          onClick={() => requireAuth()}
        >
          Require Auth
        </button>
      );
    }

    const { getByTestId } = renderWithProviders(<TestHookComponent />);

    const requireAuthBtn = getByTestId('require-auth-btn');
    requireAuthBtn.click();

    expect(mockPush).toHaveBeenCalledWith('/meriter/login?returnTo=%2Fmeriter%2Fhome');
  });
});
