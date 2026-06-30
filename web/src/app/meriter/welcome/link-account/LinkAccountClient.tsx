'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { config } from '@/config';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BrandFormControl } from '@/components/ui';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { Loader2 } from 'lucide-react';

function hasProvider(linked: string[] | undefined, provider: string): boolean {
  return linked?.includes(provider) ?? false;
}

export function LinkAccountClient() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const utils = trpc.useUtils();
  const { config: runtimeConfig } = useRuntimeConfig();
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const linked = user?.linkedProviders ?? [];
  const hasEmail = hasProvider(linked, 'email');
  const hasTelegram = hasProvider(linked, 'telegram');
  const botUsername = runtimeConfig?.botUsername ?? null;
  const telegramOAuthEnabled = runtimeConfig?.oauth?.telegram ?? false;

  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/meriter/login');
    }
  }, [isLoading, user, router]);

  if (isLoading || !user) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const handleLinkEmail = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${config.api.baseUrl}/api/v1/auth/link/email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload?.message || 'Не удалось отправить ссылку');
      }
      setEmailSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Не удалось отправить ссылку');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTelegramLinked = async () => {
    await utils.users.getMe.invalidate();
    router.push('/meriter/welcome');
  };

  return (
    <div className="min-h-svh bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-md space-y-6">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">Привязка входа</h1>
          <p className="text-sm text-muted-foreground">
            Привяжите почту и Telegram к одному профилю, чтобы баланс и имя совпадали в
            группе и на сайте.
          </p>
        </div>

        {!hasEmail && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium">Почта (необязательно)</h2>
            <p className="text-sm text-muted-foreground">
              Без почты повторный вход только через Telegram создаст отдельный профиль.
            </p>
            {emailSent ? (
              <p className="text-sm text-primary">
                Письмо отправлено. Откройте ссылку из письма, чтобы привязать почту.
              </p>
            ) : (
              <>
                <BrandFormControl label="Email">
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </BrandFormControl>
                <Button
                  className="w-full"
                  disabled={!email.trim() || isSubmitting}
                  onClick={handleLinkEmail}
                >
                  {isSubmitting ? 'Отправка…' : 'Отправить ссылку для привязки'}
                </Button>
              </>
            )}
          </section>
        )}

        {!hasTelegram && telegramOAuthEnabled && botUsername && (
          <section className="space-y-3 rounded-xl border border-border bg-card p-4">
            <h2 className="font-medium">Telegram</h2>
            <p className="text-sm text-muted-foreground">
              Привяжите Telegram, чтобы голосовать в группе под тем же аккаунтом.
            </p>
            <TelegramLinkWidget
              botUsername={botUsername}
              mode="link"
              onSuccess={handleTelegramLinked}
              onError={(msg) => setError(msg)}
            />
          </section>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button variant="outline" className="w-full" onClick={() => router.push('/meriter/welcome')}>
          {hasEmail && hasTelegram ? 'Продолжить' : 'Пропустить'}
        </Button>
      </div>
    </div>
  );
}

type TelegramLinkWidgetProps = {
  botUsername: string;
  mode: 'login' | 'link';
  onSuccess: () => void;
  onError: (message: string) => void;
};

function TelegramLinkWidget({ botUsername, mode, onSuccess, onError }: TelegramLinkWidgetProps) {
  if (mode === 'link') {
    return (
      <TelegramLoginWidget
        botUsername={botUsername}
        linkMode
        onSuccess={() => onSuccess()}
        onError={onError}
      />
    );
  }

  return (
    <TelegramLoginWidget
      botUsername={botUsername}
      onSuccess={() => onSuccess()}
      onError={onError}
    />
  );
}
