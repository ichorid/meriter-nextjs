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

  it('shows Telegram widget when botUsername and telegram provider are enabled', () => {
    const { container } = renderWithProviders(
      <LoginForm botUsername="meriter_dev1_bot" enabledProviders={['telegram']} emailEnabled />,
    );

    expect(isTelegramLoginEnabled({ telegram: true }, 'meriter_dev1_bot')).toBe(true);
    const widgetScript = container.querySelector('script[data-telegram-login]');
    expect(widgetScript).toBeInTheDocument();
    expect(widgetScript?.getAttribute('data-telegram-login')).toBe('meriter_dev1_bot');
  });

  it('does not render Telegram widget without botUsername', () => {
    const { container } = renderWithProviders(
      <LoginForm botUsername={null} enabledProviders={['telegram']} emailEnabled />,
    );

    expect(isTelegramLoginEnabled({ telegram: true }, null)).toBe(false);
    expect(container.querySelector('script[data-telegram-login]')).not.toBeInTheDocument();
  });

  it('shows fallback message when Telegram widget script fails to load', async () => {
    const { container, findByText } = renderWithProviders(
      <LoginForm botUsername="meriter_dev1_bot" enabledProviders={['telegram']} emailEnabled />,
    );

    const script = container.querySelector('script[data-telegram-login]');
    expect(script).toBeInTheDocument();
    script?.dispatchEvent(new Event('error'));

    expect(await findByText('login.telegramWidgetUnavailable')).toBeInTheDocument();
  });
});
