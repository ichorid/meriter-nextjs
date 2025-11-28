/**
 * OAuth Providers Configuration
 * 
 * Определяет доступные OAuth провайдеры и их конфигурацию
 * Провайдеры проверяются на бэкенде, здесь мы просто определяем их список
 */

import * as LucideIcons from 'lucide-react';

export interface OAuthProvider {
  id: string;
  name: string;
  icon: keyof typeof LucideIcons;
  color: string; // Tailwind color classes
  bgColor: string; // Background color
  textColor: string; // Text color
}

/**
 * Список всех возможных OAuth провайдеров
 * Доступность проверяется на бэкенде при попытке авторизации
 */
export const OAUTH_PROVIDERS: OAuthProvider[] = [
  {
    id: 'google',
    name: 'Google',
    icon: 'Chrome',
    color: 'border-gray-300 hover:border-red-500',
    bgColor: 'bg-white hover:bg-red-50',
    textColor: 'text-gray-700 hover:text-red-600',
  },
  {
    id: 'yandex',
    name: 'Yandex',
    icon: 'Search',
    color: 'border-gray-300 hover:border-yellow-500',
    bgColor: 'bg-white hover:bg-yellow-50',
    textColor: 'text-gray-700 hover:text-yellow-600',
  },
  {
    id: 'vk',
    name: 'VK',
    icon: 'Users',
    color: 'border-gray-300 hover:border-blue-500',
    bgColor: 'bg-white hover:bg-blue-50',
    textColor: 'text-gray-700 hover:text-blue-600',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    icon: 'Send',
    color: 'border-gray-300 hover:border-blue-400',
    bgColor: 'bg-white hover:bg-blue-50',
    textColor: 'text-gray-700 hover:text-blue-500',
  },
  {
    id: 'apple',
    name: 'Apple',
    icon: 'Apple',
    color: 'border-gray-300 hover:border-gray-800',
    bgColor: 'bg-white hover:bg-gray-50',
    textColor: 'text-gray-700 hover:text-gray-900',
  },
  {
    id: 'twitter',
    name: 'Twitter',
    icon: 'Twitter', // Lucide has Twitter icon
    color: 'border-gray-300 hover:border-sky-500',
    bgColor: 'bg-white hover:bg-sky-50',
    textColor: 'text-gray-700 hover:text-sky-600',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    icon: 'Instagram', // Lucide has Instagram icon
    color: 'border-gray-300 hover:border-pink-500',
    bgColor: 'bg-white hover:bg-pink-50',
    textColor: 'text-gray-700 hover:text-pink-600',
  },
  {
    id: 'sber',
    name: 'Sber',
    icon: 'Building2',
    color: 'border-gray-300 hover:border-green-600',
    bgColor: 'bg-white hover:bg-green-50',
    textColor: 'text-gray-700 hover:text-green-700',
  },
];

/**
 * Получает URL для авторизации через провайдер
 */
export function getOAuthUrl(providerId: string, returnTo?: string): string {
  const currentPath = typeof window !== 'undefined' ? window.location.pathname : '/meriter/home';
  
  // Parse returnTo if it contains query parameters
  let returnPath: string = currentPath;
  let queryParams = '';
  
  if (returnTo && returnTo.length > 0) {
    if (returnTo.includes('?')) {
      const [path, query] = returnTo.split('?');
      returnPath = path || currentPath;
      queryParams = query ? `?${query}` : '';
    } else {
      returnPath = returnTo;
    }
  }

  // Build full URL with current origin (web server, port 8001)
  const returnUrl = typeof window !== 'undefined'
    ? `${window.location.origin}${returnPath.startsWith('/') ? returnPath : `/${returnPath}`}${queryParams}`
    : returnPath;

  // Determine API URL
  const isLocalDev = typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || (isLocalDev ? 'http://localhost:8002' : '');

  const oauthUrl = apiBaseUrl
    ? `${apiBaseUrl}/api/v1/auth/${providerId}?returnTo=${encodeURIComponent(returnUrl)}`
    : `/api/v1/auth/${providerId}?returnTo=${encodeURIComponent(returnUrl)}`;

  return oauthUrl;
}


/**
 * Filter providers based on environment variables
 */
export function getEnabledProviders(env: Record<string, string | undefined> = {}): string[] {
  // Default to all enabled if no env vars are checked (or handle as needed)
  // But here we want to respect the flags.
  // If env is empty, we might want to return all or none. 
  // Given the requirement, we should check specific flags.

  return OAUTH_PROVIDERS.filter(provider => {
    const key = `OAUTH_${provider.id.toUpperCase()}_ENABLED`;
    const value = env[key];
    return value === 'true';
  }).map(p => p.id);
}
