'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { mutate } from 'swr';
import { useTranslation } from 'react-i18next';

export const LogoutButton = ({ className = '' }: { className?: string }) => {
    const { t } = useTranslation('shared');
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

