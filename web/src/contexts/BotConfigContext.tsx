'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface BotConfig {
  botUsername: string;
}

interface BotConfigContextType {
  botUsername: string;
  isLoading: boolean;
  error: Error | null;
}

const BotConfigContext = createContext<BotConfigContextType | undefined>(undefined);

interface BotConfigProviderProps {
  children: React.ReactNode;
}

/**
 * Bot Config Provider
 * 
 * Fetches bot username from /api/config route once on mount and caches it.
 * Fails immediately if botUsername is missing - no fallbacks.
 */
export function BotConfigProvider({ children }: BotConfigProviderProps) {
  const [botUsername, setBotUsername] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBotConfig() {
      try {
        const response = await fetch('/api/config');
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(errorData.error || `Failed to fetch bot config: ${response.status}`);
        }

        const data: BotConfig = await response.json();
        
        // Fail fast - no fallbacks
        if (!data.botUsername || data.botUsername.trim() === '') {
          throw new Error('BOT_USERNAME is missing from server response');
        }

        if (isMounted) {
          setBotUsername(data.botUsername);
          setIsLoading(false);
          setError(null);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to load bot configuration');
        console.error('❌ BotConfigProvider error:', error);
        
        if (isMounted) {
          setError(error);
          setIsLoading(false);
          // Don't set botUsername - let components fail if they try to use it
        }
      }
    }

    fetchBotConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  const value: BotConfigContextType = {
    botUsername,
    isLoading,
    error,
  };

  return (
    <BotConfigContext.Provider value={value}>
      {children}
    </BotConfigContext.Provider>
  );
}

/**
 * Hook to access bot configuration
 * 
 * @throws Error if botUsername is not available (not loaded or error occurred)
 */
export function useBotConfig(): { botUsername: string } {
  const context = useContext(BotConfigContext);

  if (context === undefined) {
    throw new Error('useBotConfig must be used within a BotConfigProvider');
  }

  // Fail fast - throw error if loading failed
  if (context.error) {
    throw context.error;
  }

  // If still loading, throw error - components should not use botUsername until loaded
  if (context.isLoading) {
    throw new Error('Bot configuration is still loading');
  }
  
  // Fail fast - throw error if loading completed but botUsername is missing or empty
  if (!context.botUsername || context.botUsername.trim() === '') {
    throw new Error('BOT_USERNAME is not available');
  }

  return {
    botUsername: context.botUsername,
  };
}

