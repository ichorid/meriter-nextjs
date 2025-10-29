'use client';

import { type PropsWithChildren, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { ThemeProvider } from '@/shared/lib/theme-provider';
import { useAppMode } from '@/contexts/AppModeContext';
import { ToastContainer } from '@/shared/components/toast-container';

import './styles.css';

// Dynamically import Telegram SDK components only when needed
const TelegramSDKWrapper = dynamic(
  () => import('./TelegramSDKWrapper'),
  { ssr: false }
);

// Desktop mode wrapper - simple, no Telegram UI  
function DesktopWrapper({ children }: PropsWithChildren) {
  const [Components, setComponents] = useState<typeof import('./organisms/index') | null>(null);
  const pathname = usePathname();
  
  useEffect(() => {
    import('./organisms/index').then(setComponents);
  }, []);
  
  // Pages using AdaptiveLayout should not have global sidebar/topbar
  // (AdaptiveLayout handles its own navigation)
  // Login page should not show any navigation (plain page)
  // All other pages now use AdaptiveLayout
  const isLoginPage = pathname === '/meriter/login';
  const shouldShowGlobalNav = false; // All pages use AdaptiveLayout or are plain (login)
  
  if (!Components) {
    return (
      <ThemeProvider>
        <div className="app">
          {shouldShowGlobalNav && <div className="md:pl-[72px]">{children}</div>}
          {!shouldShowGlobalNav && children}
          <ToastContainer />
        </div>
      </ThemeProvider>
    );
  }
  
  return (
    <ThemeProvider>
      <div className="app">
        {shouldShowGlobalNav && (
          <>
            <Components.VerticalSidebar />
            <div className="md:pl-[72px]">
              <Components.ContextTopBar />
              {children}
            </div>
          </>
        )}
        {!shouldShowGlobalNav && children}
        <ToastContainer />
      </div>
    </ThemeProvider>
  );
}

function RootInner({ children }: PropsWithChildren) {
  const { isTelegramMiniApp, isReady } = useAppMode();

  // Wait for detection to complete
  if (!isReady) {
    return <div className="root__loading">Loading</div>;
  }

  // Conditionally render based on app mode
  if (isTelegramMiniApp) {
    return <TelegramSDKWrapper>{children}</TelegramSDKWrapper>;
  }

  return <DesktopWrapper>{children}</DesktopWrapper>;
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
