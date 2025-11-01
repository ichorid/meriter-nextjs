'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';

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
 * Fetches bot username from /api/v1/config backend API endpoint once on mount and caches it.
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
        const response = await apiClient.get('/api/v1/config') as any;
        
        // Parse API response format: { success: true, data: { botUsername }, meta: {...} }
        const data: BotConfig = response?.success && response?.data 
          ? response.data 
          : response; // Fallback for non-standard responses
        
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

  // Show loading state while fetching
  if (isLoading) {
    return (
      <BotConfigContext.Provider value={value}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="loading loading-spinner loading-lg mb-4"></div>
            <p className="text-base-content/70">Loading bot configuration...</p>
          </div>
        </div>
      </BotConfigContext.Provider>
    );
  }

  // Show error state if fetch failed
  if (error) {
    return (
      <BotConfigContext.Provider value={value}>
        <div className="flex items-center justify-center min-h-screen">
          <div className="alert alert-error max-w-md">
            <div className="flex flex-col">
              <h3 className="font-bold">Configuration Error</h3>
              <p className="text-sm mt-2">{error.message}</p>
            </div>
          </div>
        </div>
      </BotConfigContext.Provider>
    );
  }

  // Only render children once config is loaded successfully
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

