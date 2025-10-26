'use client';

import { type PropsWithChildren } from 'react';
import {
  initData,
  miniApp,
  useLaunchParams,
  useSignal,
} from '@telegram-apps/sdk-react';
import { AppRoot } from '@telegram-apps/telegram-ui';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { ThemeProvider } from '@/shared/lib/theme-provider';

import './styles.css';

// Inner component that safely uses Telegram hooks
function TelegramAwareWrapper({ children }: PropsWithChildren) {
  // Always call hooks at the top level
  let lp: any = { tgWebAppPlatform: 'web' as const };
  let isDarkValue = false;
  
  try {
    // These hooks will only work if SDKProvider is present
    lp = useLaunchParams();
    const isDarkSignal = useSignal(miniApp.isDark);
    isDarkValue = (isDarkSignal as any)?.value || false;
  } catch (error) {
    // Log the error for debugging but continue with defaults
    console.debug('Telegram SDK hooks not available, using defaults:', error);
  }

  return (
    <ThemeProvider>
      <AppRoot
        appearance={isDarkValue ? 'dark' : 'light'}
        platform={['macos', 'ios'].includes(lp?.tgWebAppPlatform) ? 'ios' : 'base'}
      >
        {children}
      </AppRoot>
    </ThemeProvider>
  );
}

function RootInner({ children }: PropsWithChildren) {
  return <TelegramAwareWrapper>{children}</TelegramAwareWrapper>;
}

export function Root(props: PropsWithChildren) {
  // Unfortunately, Telegram Mini Apps does not allow us to use all features of
  // the Server Side Rendering. That's why we are showing loader on the server
  // side.
  const didMount = useDidMount();

  return didMount ? (
    <ErrorBoundary>
      <RootInner {...props} />
    </ErrorBoundary>
  ) : (
    <div className="root__loading">Loading</div>
  );
}
