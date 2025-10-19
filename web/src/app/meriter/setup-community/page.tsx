'use client';

import { BOT_USERNAME } from '@config/meriter';
import Page from '@shared/components/page';
import { swr } from '@lib/swr';
import { useEffect, useState, useRef } from "react";
import { ThemeToggle } from "@shared/components/theme-toggle";
import { useRouter } from 'next/navigation';

const PageSetupCommunity = () => {
    const router = useRouter();
    const [user] = swr("/api/rest/getme", { init: true });
    const [authError, setAuthError] = useState<string | null>(null);
    const [isAuthenticating, setIsAuthenticating] = useState(false);
    const telegramWidgetRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        console.log('🟢 Setup community page mounted. BOT_USERNAME:', BOT_USERNAME);
        
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
                    // Always redirect to manage page for community setup
                    console.log('🔵 Redirecting to /meriter/manage for community setup...');
                    router.push('/meriter/manage');
                } else {
                    setAuthError('Ошибка авторизации');
                }
            } catch (error) {
                console.error('🔴 Auth error:', error);
                setAuthError('Ошибка подключения к серверу: ' + (error as Error).message);
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
            console.log('🟢 User already authenticated, redirecting to manage...');
            router.push('/meriter/manage');
        }
    }, [user, router]);

    // If already authenticated, don't show login
    if (user?.token) {
        return (
            <Page className="index">
                <div className="flex justify-end mb-2">
                    <ThemeToggle />
                </div>
                <div className="center">
                    <div>Переход на страницу настройки...</div>
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

                <div className="mar-40">
                    <h2 style={{ fontSize: '24px', marginBottom: '20px', textAlign: 'center' }}>
                        Настройка сообщества
                    </h2>
                    <p style={{ marginBottom: '20px', textAlign: 'center', maxWidth: '500px' }}>
                        Вы добавили бота Meriter в свою группу! Сейчас мы настроим его работу.
                    </p>
                    <p style={{ marginBottom: '30px', textAlign: 'center', maxWidth: '500px' }}>
                        Для начала авторизуйтесь через Telegram:
                    </p>
                </div>

                <div className="mar-40">
                    {isAuthenticating ? (
                        <div>Авторизация...</div>
                    ) : (
                        <div ref={telegramWidgetRef} id="telegram-login-widget"></div>
                    )}
                    {authError && (
                        <div className="text-red-500 mt-4">{authError}</div>
                    )}
                </div>

                <div className="mar-40">
                    <p style={{ fontSize: '14px', color: '#666', textAlign: 'center', maxWidth: '500px' }}>
                        После авторизации вы сможете:
                    </p>
                    <ul style={{ fontSize: '14px', color: '#666', textAlign: 'left', maxWidth: '500px', margin: '10px auto' }}>
                        <li>✓ Настроить ценности сообщества (хештеги)</li>
                        <li>✓ Задать название баллов</li>
                        <li>✓ Выбрать символ для баллов</li>
                        <li>✓ Отправить памятку участникам</li>
                    </ul>
                </div>
            </div>
        </Page>
    );
};

export default PageSetupCommunity;

