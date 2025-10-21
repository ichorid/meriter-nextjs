'use client';

import { BOT_USERNAME } from '@config/meriter';
import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState, useRef } from "react";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useRouter } from 'next/navigation';

const PageMeriterLogin = () => {
    const router = useRouter();
    const [user] = swr("/api/rest/getme", { init: true });
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [discoveryStatus, setDiscoveryStatus] = useState('');
    const telegramWidgetRef = useRef<HTMLDivElement>(null);
    const [returnTo, setReturnTo] = useState<string | null>(null);

    useEffect(() => {
        console.log('🟢 Login page mounted. BOT_USERNAME:', BOT_USERNAME);
        
        // Extract returnTo query parameter
        const params = new URLSearchParams(window.location.search);
        const returnToParam = params.get('returnTo');
        if (returnToParam) {
            setReturnTo(returnToParam);
            console.log('🟢 returnTo parameter found:', returnToParam);
        }
        
        // Define the global callback function that Telegram will call
        (window as any).onTelegramAuth = async (user: any) => {
            console.log('🔵 Telegram callback received!', user);
            setIsAuthenticating(true);
            setDiscoveryStatus('Authenticating...');
            setAuthError(null);

            try {
                console.log('🔵 Sending auth request to backend...');
                setDiscoveryStatus('Discovering your communities...');
                
                const authResponse = await fetch('/api/rest/telegram-auth', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(user),
                    credentials: 'include',
                });

                console.log('🔵 Backend response status:', authResponse.status);

                if (!authResponse.ok) {
                    const errorData = await authResponse.json().catch(() => ({}));
                    console.error('🔴 Auth failed:', errorData);
                    throw new Error('Authentication failed');
                }

                const data = await authResponse.json();
                console.log('🔵 Auth successful!', data);

                if (data.success) {
                    setDiscoveryStatus('Discovery complete!');
                    
                    // Determine redirect based on pending communities or returnTo
                    let redirectPath = '/meriter/home'; // default
                    
                    if (data.hasPendingCommunities) {
                        console.log('🔵 User has pending communities, redirecting to /meriter/manage');
                        redirectPath = '/meriter/manage';
                    } else if (returnTo) {
                        console.log('🔵 Using returnTo parameter:', returnTo);
                        redirectPath = returnTo;
                    }
                    
                    console.log('🔵 Redirecting to:', redirectPath);
                    router.push(redirectPath);
                } else {
                    setAuthError('Ошибка авторизации');
                }
            } catch (error) {
                console.error('🔴 Auth error:', error);
                setAuthError('Ошибка подключения к серверу: ' + (error as Error).message);
            } finally {
                setIsAuthenticating(false);
                setDiscoveryStatus('');
            }
        };

        // Load Telegram Widget script
        if (telegramWidgetRef.current && !document.getElementById('telegram-widget-script')) {
            const script = document.createElement('script');
            script.id = 'telegram-widget-script';
            script.src = 'https://telegram.org/js/telegram-widget.js?22';
            script.setAttribute('data-telegram-login', BOT_USERNAME);
            script.setAttribute('data-size', 'large');
            script.setAttribute('data-radius', '20');
            script.setAttribute('data-onauth', 'onTelegramAuth(user)');
            script.setAttribute('data-request-access', 'write');
            script.setAttribute('data-lang', 'ru');
            script.async = true;
            
            telegramWidgetRef.current.appendChild(script);
            console.log('🟢 Telegram widget script loaded');
        }

        return () => {
            // Cleanup
            delete (window as any).onTelegramAuth;
        };
    }, [router]);

    useEffect(() => {
        if (user?.token) {
            console.log('🟢 User already authenticated, redirecting...');
            const redirectPath = returnTo || '/meriter/home';
            router.push(redirectPath);
        }
    }, [user, router, returnTo]);

    // If already authenticated, don't show login
    if (user?.token) {
        return (
            <Page className="index">
                <div className="flex justify-end mb-2">
                    <ThemeToggle />
                </div>
                <div className="center">
                    <div>Переход на главную...</div>
                </div>
            </Page>
        );
    }

    return (
        <Page className="index">
            <div className="flex justify-end mb-2">
                <ThemeToggle />
            </div>
            <div className="center">
                <div>
                    <img src="/meriter/merit.svg" alt="Meriter" />
                </div>

                <div className="mar-80">
                    {!isAuthenticating && (
                        <div ref={telegramWidgetRef} id="telegram-login-widget"></div>
                    )}
                    {authError && (
                        <div className="text-red-500 mt-4">{authError}</div>
                    )}
                </div>
            </div>

            {isAuthenticating && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="card bg-base-100 shadow-xl p-8 max-w-md">
                        <div className="flex flex-col items-center gap-4">
                            <span className="loading loading-spinner loading-lg"></span>
                            <p className="text-lg font-medium">
                                {discoveryStatus || 'Discovering your communities...'}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
};

export default PageMeriterLogin;
