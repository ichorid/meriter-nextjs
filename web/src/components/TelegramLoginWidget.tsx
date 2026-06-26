'use client';

import { useEffect, useState } from 'react';
import { config } from '@/config';

declare global {
  interface Window {
    onTelegramAuth?: (user: Record<string, unknown>) => void;
  }
}

type TelegramLoginWidgetProps = {
  botUsername: string;
  disabled?: boolean;
  linkMode?: boolean;
  onSuccess: (result: { isNewUser: boolean }) => void;
  onError: (message: string) => void;
};

export function TelegramLoginWidget({
  botUsername,
  disabled = false,
  linkMode = false,
  onSuccess,
  onError,
}: TelegramLoginWidgetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    window.onTelegramAuth = async (user) => {
      if (disabled || isSubmitting) {
        return;
      }
      setIsSubmitting(true);
      try {
        const endpoint = linkMode
          ? `${config.api.baseUrl}/api/v1/auth/link/telegram`
          : `${config.api.baseUrl}/api/v1/auth/telegram/widget`;
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify(user),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(payload?.message || 'Telegram authentication failed');
        }
        onSuccess({ isNewUser: linkMode ? false : Boolean(payload?.isNewUser) });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Telegram authentication failed';
        onError(message);
      } finally {
        setIsSubmitting(false);
      }
    };

    return () => {
      delete window.onTelegramAuth;
    };
  }, [disabled, isSubmitting, linkMode, onError, onSuccess]);

  useEffect(() => {
    if (disabled || !botUsername) {
      return;
    }

    const container = document.getElementById('meriter-telegram-login-widget');
    if (!container || container.querySelector('script')) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.async = true;
    script.setAttribute('data-telegram-login', botUsername.replace(/^@/, ''));
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-radius', '8');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    container.appendChild(script);
  }, [botUsername, disabled]);

  if (!botUsername) {
    return null;
  }

  return (
    <div
      id="meriter-telegram-login-widget"
      className="flex min-h-[44px] justify-center"
      aria-busy={isSubmitting}
    />
  );
}
