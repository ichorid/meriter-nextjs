/**
 * Simple Integration Test: Telegram Web App Authentication
 * 
 * Tests the basic authentication flow for Telegram Web Apps
 */

import React from 'react';
import { screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../utils/test-utils';
import { LoginForm } from '@/components/LoginForm';
import { AuthProvider } from '@/contexts/AuthContext';
import * as sdkReact from '@telegram-apps/sdk-react';

describe('Telegram Web App Authentication - Simple Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (global.fetch as jest.Mock).mockClear();
  });
  
  it('should detect Telegram Web App environment and show appropriate UI', async () => {
    // Mock Telegram SDK to return Web App environment
    jest.spyOn(sdkReact, 'isTMA').mockResolvedValue(true);
    jest.spyOn(sdkReact, 'useLaunchParams').mockReturnValue({
      tgWebAppPlatform: 'ios',
      tgWebAppStartParam: null,
    });
    jest.spyOn(sdkReact, 'useSignal').mockReturnValue({
      value: 'mock-init-data',
    });
    
    renderWithProviders(
      <AuthProvider>
        <LoginForm />
      </AuthProvider>
    );
    
    // Should show Telegram Web App detected message
    await waitFor(() => {
      expect(screen.getByText(/login.telegramWebApp.detected/i)).toBeInTheDocument();
    });
    
    // Should show loading spinner
    expect(document.querySelector('.loading-spinner')).toBeInTheDocument();
  });
  
  it('should fall back to widget when not in Telegram environment', async () => {
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
      expect(screen.queryByText(/login.telegramWebApp.detected/i)).not.toBeInTheDocument();
    });
    
    // Widget script should be in the DOM
    const scripts = document.querySelectorAll('script[src*="telegram-widget"]');
    expect(scripts.length).toBeGreaterThan(0);
  });
});
