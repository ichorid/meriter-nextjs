/**
 * Configuration Hook
 * 
 * Provides access to configuration values in React components
 * with proper TypeScript support and validation.
 */

import { config } from '@/config';

/**
 * Hook to access configuration values
 * 
 * @example
 * ```tsx
 * const { api, telegram, features } = useConfig();
 * 
 * // Use in component
 * const apiUrl = api.baseUrl;
 * const botUsername = telegram.botUsername;
 * const isDebug = features.debug;
 * ```
 */
export function useConfig() {
  return config;
}

/**
 * Hook to access specific configuration section
 * 
 * @example
 * ```tsx
 * const apiConfig = useApiConfig();
 * const telegramConfig = useTelegramConfig();
 * ```
 */
export function useApiConfig() {
  return config.api;
}

export function useTelegramConfig() {
  return config.telegram;
}

export function useS3Config() {
  return config.s3;
}

export function useFeaturesConfig() {
  return config.features;
}

export function useAppConfig() {
  return config.app;
}

/**
 * Utility hooks for common checks
 */
export function useIsDevelopment() {
  return config.app.isDevelopment;
}

export function useIsProduction() {
  return config.app.isProduction;
}

export function useIsDebug() {
  return config.features.debug;
}
