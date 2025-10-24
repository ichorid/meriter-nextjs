'use client';

import { type PropsWithChildren, useEffect } from 'react';
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

function RootInner({ children }: PropsWithChildren) {
  let lp;
  let isDark;
  let initDataUser;

  try {
    lp = useLaunchParams();
    isDark = useSignal(miniApp.isDark);
    initDataUser = useSignal(initData.user);
  } catch (error: any) {
    console.warn('⚠️ Telegram Web App not detected, running in development mode:', error.message);
    // Fallback values for development
    lp = { tgWebAppPlatform: 'web' };
    isDark = { value: false };
    initDataUser = { value: null };
  }

  // Note: Locale setting from Telegram user data would need to be handled
  // on the server side or through a different mechanism since we can't
  // use server-side functions in client components

  return (
    <ThemeProvider>
      <AppRoot
        appearance={(isDark as any)?.value ? 'dark' : 'light'}
        platform={
          ['macos', 'ios'].includes(lp?.tgWebAppPlatform) ? 'ios' : 'base'
        }
      >
        {children}
      </AppRoot>
    </ThemeProvider>
  );
}

export function Root(props: PropsWithChildren) {
  // Unfortunately, Telegram Mini Apps does not allow us to use all features of
  // the Server Side Rendering. That's why we are showing loader on the server
  // side.
  const didMount = useDidMount();

  return didMount ? (
    <ErrorBoundary fallback={ErrorPage}>
      <RootInner {...props} />
    </ErrorBoundary>
  ) : (
    <div className="root__loading">Loading</div>
  );
}
