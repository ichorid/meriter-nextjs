/**
 * Tests for LogoutButton Component
 * 
 * Tests the centralized logout button component including:
 * - Logout functionality
 * - Confirmation dialogs
 * - Loading states
 * - Error handling
 */

import React from 'react';
import { renderWithProviders, testUtils } from '../utils/test-utils';
import { LogoutButton } from '@/components/LogoutButton';
import { useAuth } from '@/contexts/AuthContext';

// Mock the auth context
jest.mock('@/contexts/AuthContext');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;

describe('LogoutButton', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('should render logout button with default text', () => {
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

      const { getByText } = renderWithProviders(<LogoutButton />);

      expect(getByText('shared.logout')).toBeInTheDocument();
    });

    it('should render logout button with custom children', () => {
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

      const { getByText } = renderWithProviders(
        <LogoutButton>Custom Logout</LogoutButton>
      );

      expect(getByText('Custom Logout')).toBeInTheDocument();
    });

    it('should apply custom className', () => {
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

      const { container } = renderWithProviders(
        <LogoutButton className="custom-class" />
      );

      const button = container.querySelector('button');
      expect(button).toHaveClass('custom-class');
    });
  });

  describe('Logout Functionality', () => {
    it('should call logout when clicked without confirmation', async () => {
      const mockLogout = jest.fn().mockResolvedValue({});
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: mockLogout,
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(
        <LogoutButton showConfirmation={false} />
      );

      const logoutButton = getByText('shared.logout');
      logoutButton.click();

      await testUtils.waitFor(100);

      expect(mockLogout).toHaveBeenCalled();
    });

    it('should show confirmation dialog when showConfirmation is true', () => {
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

      const { getByText, queryByText } = renderWithProviders(
        <LogoutButton showConfirmation={true} />
      );

      // Initially, confirmation dialog should not be visible
      expect(queryByText('shared.confirmLogout')).not.toBeInTheDocument();

      // Click logout button
      const logoutButton = getByText('shared.logout');
      logoutButton.click();

      // Confirmation dialog should now be visible
      expect(getByText('shared.confirmLogout')).toBeInTheDocument();
      expect(getByText('shared.confirmLogoutMessage')).toBeInTheDocument();
    });

    it('should call logout when confirmed', async () => {
      const mockLogout = jest.fn().mockResolvedValue({});
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: mockLogout,
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(
        <LogoutButton showConfirmation={true} />
      );

      // Click logout button to show confirmation
      const logoutButton = getByText('shared.logout');
      logoutButton.click();

      // Click confirm button
      const confirmButton = getByText('shared.logout');
      confirmButton.click();

      await testUtils.waitFor(100);

      expect(mockLogout).toHaveBeenCalled();
    });

    it('should cancel logout when cancel is clicked', () => {
      const mockLogout = jest.fn();
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: mockLogout,
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText, queryByText } = renderWithProviders(
        <LogoutButton showConfirmation={true} />
      );

      // Click logout button to show confirmation
      const logoutButton = getByText('shared.logout');
      logoutButton.click();

      // Click cancel button
      const cancelButton = getByText('shared.cancel');
      cancelButton.click();

      // Confirmation dialog should be hidden
      expect(queryByText('shared.confirmLogout')).not.toBeInTheDocument();
      expect(mockLogout).not.toHaveBeenCalled();
    });
  });

  describe('Loading States', () => {
    it('should show loading state when logout is in progress', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: true,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(<LogoutButton />);

      expect(getByText('shared.loggingOut')).toBeInTheDocument();
    });

    it('should disable button when loading', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: true,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { container } = renderWithProviders(<LogoutButton />);

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });

    it('should show loading state in confirmation dialog', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: true,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(
        <LogoutButton showConfirmation={true} />
      );

      // Click logout button to show confirmation
      const logoutButton = getByText('shared.loggingOut');
      logoutButton.click();

      // Check if loading state is shown in confirmation dialog
      expect(getByText('shared.loggingOut')).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should handle logout errors gracefully', async () => {
      const mockLogout = jest.fn().mockRejectedValue(new Error('Logout failed'));
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: mockLogout,
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { getByText } = renderWithProviders(
        <LogoutButton showConfirmation={false} />
      );

      const logoutButton = getByText('shared.logout');
      logoutButton.click();

      await testUtils.waitFor(100);

      // Should not throw error, just log it
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper button attributes', () => {
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

      const { container } = renderWithProviders(<LogoutButton />);

      const button = container.querySelector('button');
      expect(button).toHaveAttribute('type', 'button');
      expect(button).not.toBeDisabled();
    });

    it('should be disabled when loading', () => {
      mockUseAuth.mockReturnValue({
        user: { id: '1' },
        isLoading: true,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      const { container } = renderWithProviders(<LogoutButton />);

      const button = container.querySelector('button');
      expect(button).toBeDisabled();
    });
  });
});
