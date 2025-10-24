'use client';

import { BOT_USERNAME } from '@config/meriter';
import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { initDataRaw, useLaunchParams, useSignal, isTMA } from '@telegram-apps/sdk-react';
import { useDeepLinkHandler } from '@shared/lib/deep-link-handler';

const PageMeriterLogin = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('login');
    const locale = useLocale();
    const launchParams = useLaunchParams();
    const rawData = useSignal(initDataRaw);
    const [isInTelegram, setIsInTelegram] = useState(false);
    const startParam = launchParams.tgWebAppStartParam;
    const { handleDeepLink } = useDeepLinkHandler(router, searchParams, startParam);
    const [user] = swr("/api/rest/getme", { init: true });
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const [discoveryStatus, setDiscoveryStatus] = useState('');
    const telegramWidgetRef = useRef<HTMLDivElement>(null);
    const webAppAuthAttempted = useRef(false);
    
    // Extract returnTo query parameter using Next.js hook
    const returnTo = searchParams.get('returnTo');

    // Determine if we're in Telegram environment (real or mocked)
    useEffect(() => {
        const checkTelegramEnvironment = async () => {
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const mockEnabled = urlParams.get('mock-telegram') === 'true';
                const isRealTelegram = await isTMA('complete');
                
                // Only consider it Telegram mode if:
                // 1. We're in a real Telegram environment, OR
                // 2. Mock is explicitly enabled via URL parameter
                const shouldUseTelegramMode = isRealTelegram || mockEnabled;
                
                console.log('🔍 Telegram environment check:', {
                    isRealTelegram,
                    mockEnabled,
                    shouldUseTelegramMode,
                    hasRawData: !!rawData
                });
                
                setIsInTelegram(shouldUseTelegramMode);
            } catch (error) {
                console.warn('⚠️ Failed to check Telegram environment:', error);
                setIsInTelegram(false);
            }
        };
        
        checkTelegramEnvironment();
    }, [rawData]);

    // Function to handle Telegram Web App authentication
    const authenticateWithTelegramWebApp = async (initData: string) => {
        console.log('🟣 Telegram Web App auth detected, authenticating...');
        console.log('🟣 InitData being sent:', initData);
        console.log('🟣 InitData length:', initData?.length);
        setIsAuthenticating(true);
        setDiscoveryStatus('Authenticating...');
        setAuthError(null);

        try {
            setDiscoveryStatus('Discovering your communities...');
            
            const authResponse = await fetch('/api/rest/telegram-auth/webapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ initData }),
                credentials: 'include',
            });

            console.log('🟣 Backend response status:', authResponse.status);
            console.log('🟣 Backend response headers:', Object.fromEntries(authResponse.headers.entries()));

            if (!authResponse.ok) {
                const errorData = await authResponse.json().catch(() => ({}));
                console.error('🔴 Web App auth failed:', errorData);
                console.error('🔴 Response status:', authResponse.status);
                console.error('🔴 Response statusText:', authResponse.statusText);
                throw new Error('Authentication failed');
            }

            const data = await authResponse.json();
            console.log('🟣 Web App auth successful!', data);

            if (data.success) {
                setDiscoveryStatus('Discovery complete!');
                
                // Use deep link handler for navigation
                handleDeepLink();
            } else {
                setAuthError(t('authError'));
            }
        } catch (error) {
            console.error('🔴 Web App auth error:', error);
            setAuthError(t('connectionError', { message: (error as Error).message }));
        } finally {
            setIsAuthenticating(false);
            setDiscoveryStatus('');
        }
    };

    // Check if already authenticated - redirect immediately
    useEffect(() => {
        if (user?.token) {
            console.log('🟢 Already authenticated, handling deep link...');
            handleDeepLink();
        }
    }, [user?.token, handleDeepLink]);

    // Auto-authenticate if opened in Telegram Web App
    useEffect(() => {
        if (isInTelegram && rawData && !webAppAuthAttempted.current && !user?.token) {
            webAppAuthAttempted.current = true;
            authenticateWithTelegramWebApp(rawData);
        }
    }, [isInTelegram, rawData, user?.token]);

    useEffect(() => {
        console.log('🟢 Login page mounted. BOT_USERNAME:', BOT_USERNAME);
        console.log('🟢 Telegram Web App mode:', isInTelegram);
        console.log('🟢 Telegram start_param:', startParam);
        console.log('🟢 Raw initData:', rawData);
        console.log('🟢 Launch params:', launchParams);
        
        if (returnTo) {
            console.log('🟢 returnTo parameter found:', returnTo);
        }
        
        // Skip widget loading if in Telegram Web App mode
        if (isInTelegram) {
            console.log('🟢 Skipping widget load - using Web App authentication');
            return;
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
                    
                    // Determine redirect based on returnTo parameter
                    let redirectPath = '/meriter/home'; // default
                    
                    if (returnTo) {
                        console.log('🔵 Using returnTo parameter:', returnTo);
                        redirectPath = returnTo;
                    }
                    
                    console.log('🔵 Redirecting to:', redirectPath);
                    router.push(redirectPath);
                } else {
                    setAuthError(t('authError'));
                }
            } catch (error) {
                console.error('🔴 Auth error:', error);
                setAuthError(t('connectionError', { message: (error as Error).message }));
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
            script.setAttribute('data-lang', locale === 'ru' ? 'ru' : 'en');
            script.async = true;
            
            telegramWidgetRef.current.appendChild(script);
            console.log('🟢 Telegram widget script loaded');
        }

        return () => {
            // Cleanup
            delete (window as any).onTelegramAuth;
        };
    }, [returnTo, router, locale, isInTelegram]);

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
                <div className="center">
                    <div>{t('redirecting')}</div>
                </div>
            </Page>
        );
    }

    return (
        <Page className="index">
            <div className="center">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-base-content mb-4">
                        {t('welcomeTitle')}
                    </h1>
                </div>

                <div className="mar-80">
                    {!isAuthenticating && !isInTelegram && (
                        <div ref={telegramWidgetRef} id="telegram-login-widget"></div>
                    )}
                    {!isAuthenticating && isInTelegram && (
                        <div className="text-center text-base-content/70">
                            {t('authenticating')}
                        </div>
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
                                {discoveryStatus || t('discoveringCommunities')}
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </Page>
    );
};

export default PageMeriterLogin;
