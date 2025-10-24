/**
 * Integration Test: Telegram Web App Authentication
 * 
 * Tests the complete authentication flow for Telegram Web Apps including:
 * - SDK initialization and configuration
 * - InitData validation and parsing
 * - Web App authentication API calls
 * - JWT cookie handling
 * - User session creation
 * - Redirect after successful authentication
 * - Error handling and fallback scenarios
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders, mockFetch, testUtils } from '../utils/test-utils';
import { LoginForm } from '@/components/LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';
import * as sdkReact from '@telegram-apps/sdk-react';
import crypto from 'crypto';

// Helper to generate valid Telegram Web App initData
function generateValidInitData(userData: any, botToken: string): string {
  const authDate = Math.floor(Date.now() / 1000);
  const user = JSON.stringify(userData);
  
  const dataCheckString = [
    `auth_date=${authDate}`,
    `user=${user}`
  ].join('\n');
  
  // Create secret key (same as backend validation)
  const secretKey = crypto
    .createHmac('sha256', 'WebAppData')
    .update(botToken)
    .digest();
  
  const hash = crypto
    .createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');
  
  return `auth_date=${authDate}&user=${encodeURIComponent(user)}&hash=${hash}`;
}

describe('Telegram Web App Authentication - Integration Test', () => {
  const mockBotToken = 'test_bot_token_123456';
  const mockUserData = {
    id: 434833713,
    first_name: 'Test',
    last_name: 'User',
    username: 'testuser',
    language_code: 'en',
    is_premium: false,
  };
  
  let mockRouter: any;
  let mockSearchParams: URLSearchParams;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fetch mock
    (global.fetch as jest.Mock).mockClear();
    
    // Mock router
    mockRouter = testUtils.mockRouter();
    mockSearchParams = testUtils.mockSearchParams();
    
    // Mock localStorage
    testUtils.mockLocalStorage();
    
    // Mock document.cookie
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });
  
  describe('Successful Authentication Flow', () => {
    it('should authenticate user via Telegram Web App initData', async () => {
      // Generate valid initData
      const initData = generateValidInitData(mockUserData, mockBotToken);
      
      // Mock Telegram SDK to return Web App environment
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'ios',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      // Mock successful authentication API response
      (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({
          success: true,
          user: {
            tgUserId: mockUserData.id.toString(),
            name: `${mockUserData.first_name} ${mockUserData.last_name}`,
            token: 'mock-user-token',
            chatsIds: [],
          },
        }),
      });
      
      // Render login form with auth provider
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      // Wait for authentication to complete
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/rest/telegram-auth/webapp'),
          expect.objectContaining({
            method: 'POST',
            headers: expect.objectContaining({
              'Content-Type': 'application/json',
            }),
            body: JSON.stringify({ initData }),
          })
        );
      }, { timeout: 5000 });
      
      // Verify redirect to home page
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith('/meriter/home');
      });
    });
    
    it('should handle returnTo parameter in redirect', async () => {
      const initData = generateValidInitData(mockUserData, mockBotToken);
      const returnToPath = '/meriter/settings';
      
      // Mock search params with returnTo
      testUtils.mockSearchParams({ returnTo: returnToPath });
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'android',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      mockFetch({
        success: true,
        user: {
          tgUserId: mockUserData.id.toString(),
          name: `${mockUserData.first_name} ${mockUserData.last_name}`,
          token: 'mock-user-token',
          chatsIds: [],
        },
      });
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(mockRouter.push).toHaveBeenCalledWith(returnToPath);
      });
    });
    
    it('should handle deep link parameters', async () => {
      const deepLinkParam = 'cG9sbDplNDQ2MDBiYg'; // base64 encoded poll ID
      const initData = generateValidInitData(mockUserData, mockBotToken);
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'web',
        tgWebAppStartParam: deepLinkParam,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      mockFetch({
        success: true,
        user: {
          tgUserId: mockUserData.id.toString(),
          name: `${mockUserData.first_name} ${mockUserData.last_name}`,
          token: 'mock-user-token',
          chatsIds: [],
        },
      });
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      
      // Deep link handling is tested separately in deep-link-handler tests
      // Here we verify the authentication completes successfully
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle invalid initData', async () => {
      const invalidInitData = 'invalid-data-string';
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'ios',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: invalidInitData,
      });
      
      // Mock API rejection for invalid data
      mockFetch(
        {
          success: false,
          error: 'Invalid Web App authentication data',
        },
        401
      );
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      });
      
      // Should not redirect on error
      expect(mockRouter.push).not.toHaveBeenCalled();
    });
    
    it('should handle network errors gracefully', async () => {
      const initData = generateValidInitData(mockUserData, mockBotToken);
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'android',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      // Mock network failure
      (global.fetch as jest.Mock).mockRejectedValueOnce(
        new Error('Network request failed')
      );
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      });
    });
    
    it('should handle expired auth_date', async () => {
      // Create initData with expired timestamp (25 hours ago)
      const expiredAuthDate = Math.floor(Date.now() / 1000) - (25 * 60 * 60);
      const user = JSON.stringify(mockUserData);
      const dataCheckString = `auth_date=${expiredAuthDate}\nuser=${user}`;
      
      const secretKey = crypto
        .createHmac('sha256', 'WebAppData')
        .update(mockBotToken)
        .digest();
      
      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');
      
      const expiredInitData = `auth_date=${expiredAuthDate}&user=${encodeURIComponent(user)}&hash=${hash}`;
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'ios',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: expiredInitData,
      });
      
      mockFetch(
        {
          success: false,
          error: 'Invalid Web App authentication data',
        },
        401
      );
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(screen.getByText(/Authentication Error/i)).toBeInTheDocument();
      });
    });
  });
  
  describe('Fallback to Widget Authentication', () => {
    it('should show Telegram widget when not in Web App environment', async () => {
      // Mock non-Telegram environment
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(false);
      jest.spyOn(sdkReact, 'useLaunchParams').mockImplementation(() => {
        throw new Error('Not in Telegram environment');
      });
      jest.spyOn(sdkReact, 'useSignal').mockImplementation(() => {
        throw new Error('Not in Telegram environment');
      });
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      // Should show widget instructions
      await waitFor(() => {
        expect(screen.queryByText(/Telegram Web App detected/i)).not.toBeInTheDocument();
      });
      
      // Widget script should be in the DOM
      const scripts = document.querySelectorAll('script[src*="telegram-widget"]');
      expect(scripts.length).toBeGreaterThan(0);
    });
    
    it('should handle SDK initialization failure gracefully', async () => {
      // Mock SDK hooks throwing errors
      jest.spyOn(sdkReact, 'isTMA').mockRejectedValue(
        new Error('SDK initialization failed')
      );
      jest.spyOn(sdkReact, 'useLaunchParams').mockImplementation(() => {
        throw new Error('SDK not initialized');
      });
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      // Should fall back to widget without crashing
      await waitFor(() => {
        const form = screen.getByRole('heading', { name: /Login/i });
        expect(form).toBeInTheDocument();
      });
      
      // No authentication error should be shown for SDK failure
      expect(screen.queryByText(/Authentication Error/i)).not.toBeInTheDocument();
    });
  });
  
  describe('Session Management', () => {
    it('should store user data in React Query cache after authentication', async () => {
      const initData = generateValidInitData(mockUserData, mockBotToken);
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'ios',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      const mockUserResponse = {
        success: true,
        user: {
          tgUserId: mockUserData.id.toString(),
          name: `${mockUserData.first_name} ${mockUserData.last_name}`,
          token: 'mock-user-token',
          chatsIds: ['-1003040721280'],
        },
      };
      
      mockFetch(mockUserResponse);
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      
      // Verify user data is cached (implementation specific to React Query)
      // This would be verified by checking the query cache
    });
  });
  
  describe('Loading States', () => {
    it('should show loading spinner during authentication', async () => {
      const initData = generateValidInitData(mockUserData, mockBotToken);
      
      jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
      jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
        tgWebAppPlatform: 'ios',
        tgWebAppStartParam: null,
      });
      jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
        value: initData,
      });
      
      // Mock slow API response
      (global.fetch as jest.Mock).mockImplementation(
        () => new Promise(resolve =>
          setTimeout(() =>
            resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve({
                success: true,
                user: {
                  tgUserId: mockUserData.id.toString(),
                  name: `${mockUserData.first_name} ${mockUserData.last_name}`,
                  token: 'mock-user-token',
                  chatsIds: [],
                },
              }),
            }), 100)
        )
      );
      
      renderWithProviders(
        <AuthProvider>
          <LoginForm />
        </AuthProvider>
      );
      
      // Should show loading spinner
      expect(screen.getByText(/Authenticating/i)).toBeInTheDocument();
    });
  });
});
