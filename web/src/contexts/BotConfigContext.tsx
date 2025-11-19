/**
 * Stub file for BotConfigContext
 * This file exists to satisfy Jest module resolution for tests
 */

import React, { createContext, useContext, ReactNode } from 'react';

interface BotConfig {
  botUsername: string;
}

interface BotConfigContextType {
  botUsername: string | null;
  isLoading: boolean;
  error: Error | null;
}

const BotConfigContext = createContext<BotConfigContextType>({
  botUsername: null,
  isLoading: false,
  error: null,
});

export function BotConfigProvider({ children }: { children: ReactNode }) {
  return (
    <BotConfigContext.Provider
      value={{
        botUsername: null,
        isLoading: false,
        error: null,
      }}
    >
      {children}
    </BotConfigContext.Provider>
  );
}

export function useBotConfig() {
  return useContext(BotConfigContext);
}

