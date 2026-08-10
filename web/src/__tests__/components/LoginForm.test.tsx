/**
 * Tests for LoginForm — Telegram widget visibility and fallback.
 */

import React from 'react';
import { renderWithProviders, testUtils, mockNextRouter, mockNextSearchParams } from '../utils/test-utils';
import { LoginForm } from '@/components/LoginForm';
import { useAuth } from '@/contexts/AuthContext';
import { isTelegramLoginEnabled } from '@/lib/constants/login-methods';

jest.mock('@/contexts/AuthContext');

jest.mock('@telegram-apps/sdk-react', () => ({
  useLaunchParams: jest.fn(() => ({ tgWebAppStartParam: null })),
  useSignal: jest.fn(() => ({ value: null })),
  initDataRaw: { value: null },
  isTMA: jest.fn(() => Promise.resolve(false)),
}));

jest.mock('@/lib/captive-browser', () => ({
  isCaptiveBrowser: jest.fn(() => false),
  useCaptiveBrowser: jest.fn(() => ({
    isCaptive: false,
    copyLink: jest.fn(),
    openInBrowser: jest.fn(),
  })),
}));

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const { mockPush } = mockNextRouter();
mockNextSearchParams({ returnTo: '/meriter/profile' });

describe('LoginForm', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPush.mockClear();
    mockUseAuth.mockReturnValue(testUtils.createMockAuthContext());
  });

  it('renders login form title', () => {
    const { getByText } = renderWithProviders(<LoginForm emailEnabled />);
    expect(getByText('login.welcome')).toBeInTheDocument();
  });

  it('does not render Telegram widget while Telegram login is disabled by policy', () => {
    const { container } = renderWithProviders(
      <LoginForm botUsername="meriter_dev1_bot" enabledProviders={['telegram']} emailEnabled />,
    );

    expect(isTelegramLoginEnabled({ telegram: true }, 'meriter_dev1_bot')).toBe(false);
    expect(container.querySelector('script[data-telegram-login]')).not.toBeInTheDocument();
  });

  it('does not render Telegram widget without botUsername', () => {
    const { container } = renderWithProviders(
      <LoginForm botUsername={null} enabledProviders={['telegram']} emailEnabled />,
    );

    expect(isTelegramLoginEnabled({ telegram: true }, null)).toBe(false);
    expect(container.querySelector('script[data-telegram-login]')).not.toBeInTheDocument();
  });

  it('does not show Telegram fallback when widget is disabled by policy', async () => {
    const { container, queryByText } = renderWithProviders(
      <LoginForm botUsername="meriter_dev1_bot" enabledProviders={['telegram']} emailEnabled />,
    );

    expect(container.querySelector('script[data-telegram-login]')).not.toBeInTheDocument();
    expect(queryByText('login.telegramWidgetUnavailable')).not.toBeInTheDocument();
  });
});
