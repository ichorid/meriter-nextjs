'use client';

import { type PropsWithChildren, useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { ThemeProvider } from '@/shared/lib/theme-provider';
import { useAppMode } from '@/contexts/AppModeContext';

import './styles.css';

// Dynamically import Telegram SDK components only when needed
const TelegramSDKWrapper = dynamic(
  () => import('./TelegramSDKWrapper'),
  { ssr: false }
);

// Desktop mode wrapper - simple, no Telegram UI  
function DesktopWrapper({ children }: PropsWithChildren) {
  const [Components, setComponents] = useState<typeof import('./organisms/index') | null>(null);
  
  useEffect(() => {
    import('./organisms/index').then(setComponents);
  }, []);
  
  if (!Components) {
    return (
      <ThemeProvider>
        <div className="app">
          <div className="md:pl-[72px]">
            {children}
          </div>
        </div>
      </ThemeProvider>
    );
  }
  
  return (
    <ThemeProvider>
      <div className="app">
        <Components.VerticalSidebar />
        <div className="md:pl-[72px]">
          <Components.ContextTopBar />
          {children}
        </div>
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
