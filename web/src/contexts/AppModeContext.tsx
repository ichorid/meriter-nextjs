'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { detectTelegramEnvironment } from '@/lib/telegram-env-detector';

interface AppModeContextType {
  isTelegramMiniApp: boolean;
  isReady: boolean;
}

const AppModeContext = createContext<AppModeContextType>({
  isTelegramMiniApp: false,
  isReady: false,
});

export const useAppMode = () => useContext(AppModeContext);

export function AppModeProvider({ children }: { children: ReactNode }) {
  const [isTelegramMiniApp, setIsTelegramMiniApp] = useState(false);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const result = detectTelegramEnvironment();
    setIsTelegramMiniApp(result.isTelegramMiniApp);
    
    // Add a small delay to ensure detection completes
    // This helps with hydration mismatches
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 50);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <AppModeContext.Provider value={{ isTelegramMiniApp, isReady }}>
      {children}
    </AppModeContext.Provider>
  );
}
