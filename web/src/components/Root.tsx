'use client';

import { type PropsWithChildren, _useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { _usePathname } from 'next/navigation';

import { ErrorBoundary } from '@/components/ErrorBoundary';
import { _ErrorPage } from '@/components/ErrorPage';
import { useDidMount } from '@/hooks/useDidMount';
import { ThemeProvider } from '@/shared/lib/theme-provider';
import { setGlobalToastHandler } from '@/providers/QueryProvider';
import { useToastStore } from '@/shared/stores/toast.store';

// Dynamically import ToastContainer to avoid SSR issues
const ToastContainer = dynamic(() => import('@/shared/components/toast-container').then(mod => ({ default: mod.ToastContainer })), { ssr: false });

import './styles.css';

// Universal wrapper - works in all environments
function AppWrapper({ children }: PropsWithChildren) {
  return (
    <ThemeProvider>
      <div className="app">
        {children}
        <ToastContainer />
      </div>
    </ThemeProvider>
  );
}

function RootInner({ children }: PropsWithChildren) {
  const addToast = useToastStore((state) => state.addToast);

  // Set global toast handler for QueryProvider
  useEffect(() => {
    setGlobalToastHandler(addToast);
  }, [addToast]);

  return <AppWrapper>{children}</AppWrapper>;
}

export function Root(props: PropsWithChildren) {
  const didMount = useDidMount();

  return didMount ? (
    <ErrorBoundary>
      <RootInner {...props} />
    </ErrorBoundary>
  ) : (
    <div className="root__loading">Loading</div>
  );
}