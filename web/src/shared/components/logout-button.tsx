'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate } from 'swr';
import { useTranslations } from 'next-intl';

/**
 * Clear persisted Telegram SDK storage to prevent stale state after logout
 */
function clearTelegramSDKStorage(): void {
  try {
    // Clear localStorage keys used by Telegram SDK
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK storage key:', key);
    });
    
    // Also clear sessionStorage
    const sessionKeysToRemove = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key && (key.startsWith('tma/') || key.includes('telegram') || key.includes('init-data'))) {
        sessionKeysToRemove.push(key);
      }
    }
    
    sessionKeysToRemove.forEach(key => {
      sessionStorage.removeItem(key);
      console.log('🧹 Cleared Telegram SDK session storage key:', key);
    });
  } catch (error) {
    console.warn('⚠️ Failed to clear Telegram SDK storage:', error);
  }
}

export const LogoutButton = ({ className = '' }: { className?: string }) => {
    const t = useTranslations('shared');
    const router = useRouter();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        setIsLoggingOut(true);
        
        try {
            const response = await fetch('/api/rest/telegram-auth/logout', {
                method: 'POST',
                credentials: 'include',
            });
            
            if (response.ok) {
                // Clear all SWR cache to remove any cached user data
                mutate(() => true, undefined, { revalidate: false });
                
                // Clear Telegram SDK storage to prevent stale state
                clearTelegramSDKStorage();
                
                // Redirect to login page
                router.push('/meriter/login');
            } else {
                console.error('Logout failed');
                setIsLoggingOut(false);
            }
        } catch (error) {
            console.error('Logout error:', error);
            setIsLoggingOut(false);
        }
    };

    return (
        <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            className={className}
        >
            {isLoggingOut ? `${t('logout')}...` : t('logout')}
        </button>
    );
};

