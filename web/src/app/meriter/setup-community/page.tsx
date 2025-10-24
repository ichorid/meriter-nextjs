'use client';

import { BOT_USERNAME } from '@config/meriter';
import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState, useRef } from "react";
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { useDeepLinkHandler } from '@shared/lib/deep-link-handler';
import { useLaunchParams, initDataRaw, useSignal } from '@telegram-apps/sdk-react';

const PageSetupCommunity = () => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('pages');
    const locale = useLocale();
    const launchParams = useLaunchParams();
    const startParam = launchParams.tgWebAppStartParam;
    const rawData = useSignal(initDataRaw);
    const isInTelegram = !!rawData;
    const { handleDeepLink } = useDeepLinkHandler(router, searchParams, startParam);
    const [user] = swr("/api/rest/getme", { init: true });
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const telegramWidgetRef = useRef<HTMLDivElement>(null);
    const webAppAuthAttempted = useRef(false);

    // Function to handle Telegram Web App authentication
    const authenticateWithTelegramWebApp = async (initData: string) => {
        console.log('🟣 Telegram Web App auth detected, authenticating...');
        setIsAuthenticating(true);
        setAuthError(null);

        try {
            console.log('🔵 Sending auth request to backend...');
            const authResponse = await fetch('/api/rest/telegram-auth/webapp', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ initData }),
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
                // Use deep link handler for navigation
                console.log('🔵 Auth successful, handling deep link navigation...');
                handleDeepLink();
            } else {
                setAuthError(t('setupCommunity.authError'));
            }
        } catch (error) {
            console.error('🔴 Auth error:', error);
            setAuthError(t('setupCommunity.connectionError', { message: (error as Error).message }));
        } finally {
            setIsAuthenticating(false);
        }
    };

    // Auto-authenticate if opened in Telegram Web App
    useEffect(() => {
        if (isInTelegram && rawData && !webAppAuthAttempted.current && !user?.token) {
            webAppAuthAttempted.current = true;
            authenticateWithTelegramWebApp(rawData);
        }
    }, [isInTelegram, rawData, user?.token]);

    useEffect(() => {
        console.log('🟢 Setup community page mounted. BOT_USERNAME:', BOT_USERNAME);
        console.log('🟢 Telegram Web App mode:', isInTelegram);
        
        // Skip widget loading if in Telegram Web App mode
        if (isInTelegram) {
            console.log('🟢 Skipping widget load - using Web App authentication');
            return;
        }
        
        // Define the global callback function that Telegram will call
        (window as any).onTelegramAuth = async (user: any) => {
            console.log('🔵 Telegram callback received!', user);
            setIsAuthenticating(true);
            setAuthError(null);

            try {
                console.log('🔵 Sending auth request to backend...');
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
                    // Use deep link handler for navigation
                    console.log('🔵 Auth successful, handling deep link navigation...');
                    handleDeepLink();
                } else {
                    setAuthError(t('setupCommunity.authError'));
                }
            } catch (error) {
                console.error('🔴 Auth error:', error);
                setAuthError(t('setupCommunity.connectionError', { message: (error as Error).message }));
            } finally {
                setIsAuthenticating(false);
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
    }, [router, locale, isInTelegram]);

    useEffect(() => {
        if (user?.token) {
            console.log('🟢 User already authenticated, handling deep link navigation...');
            handleDeepLink();
        }
    }, [user, handleDeepLink]);

    // If already authenticated, don't show login
    if (user?.token) {
        return (
            <Page className="index">
                <div className="center">
                    <div>{t('setupCommunity.redirecting')}</div>
                </div>
            </Page>
        );
    }

    return (
        <Page className="index">
            <div className="center">
                <div>
                    <img src="/meriter/merit.svg" alt="Meriter" />
                </div>

                <div className="mar-40">
                    <h2 style={{ fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>
                        {t('setupCommunity.title')}
                    </h2>
                    <p style={{ marginBottom: '20px', textAlign: 'center', maxWidth: '500px' }}>
                        {t('setupCommunity.welcome')}
                    </p>
                    <p style={{ marginBottom: '30px', textAlign: 'center', maxWidth: '500px' }}>
                        {t('setupCommunity.authPrompt')}
                    </p>
                </div>

                <div className="mar-40">
                    {isAuthenticating ? (
                        <div className="text-center">
                            <span className="loading loading-spinner loading-lg"></span>
                            <p className="mt-4">{t('setupCommunity.authenticating')}</p>
                        </div>
                    ) : !isInTelegram ? (
                        <div ref={telegramWidgetRef} id="telegram-login-widget"></div>
                    ) : (
                        <div className="text-center text-base-content/70">
                            {t('setupCommunity.authenticating')}
                        </div>
                    )}
                    {authError && (
                        <div className="text-red-500 mt-4">{authError}</div>
                    )}
                </div>

                <div className="mar-40">
                    <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', maxWidth: '500px' }}>
                        {t('setupCommunity.afterAuthYouCan')}
                    </p>
                    <ul style={{ fontSize: '14px', color: '#666', textAlign: 'left', maxWidth: '500px', margin: '10px auto' }}>
                        <li>{t('setupCommunity.setupValues')}</li>
                        <li>{t('setupCommunity.setPointsName')}</li>
                        <li>{t('setupCommunity.chooseSymbol')}</li>
                        <li>{t('setupCommunity.sendGuide')}</li>
                    </ul>
                </div>
            </div>
        </Page>
    );
};

export default PageSetupCommunity;

