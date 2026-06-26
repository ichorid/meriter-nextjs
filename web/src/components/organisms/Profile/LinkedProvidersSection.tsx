'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { trpc } from '@/lib/trpc/client';
import { useRuntimeConfig } from '@/hooks/useRuntimeConfig';
import { config } from '@/config';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { BrandFormControl } from '@/components/ui';
import { TelegramLoginWidget } from '@/components/TelegramLoginWidget';
import { Check, X } from 'lucide-react';

export function LinkedProvidersSection() {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const { config: runtimeConfig } = useRuntimeConfig();
  const linked = user?.linkedProviders ?? [];
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasEmail = linked.includes('email');
  const hasTelegram = linked.includes('telegram');
  const botUsername = runtimeConfig?.botUsername ?? null;
  const telegramEnabled = runtimeConfig?.oauth?.telegram ?? false;

  const sendLinkEmail = async () => {
    setError(null);
    setMessage(null);
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
      setMessage('Письмо отправлено. Откройте ссылку для привязки почты.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка привязки');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-4">
      <h3 className="text-lg font-semibold">Способы входа</h3>

      <div className="flex items-center justify-between text-sm">
        <span>Email</span>
        {hasEmail ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="h-4 w-4" /> привязан
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <X className="h-4 w-4" /> не привязан
          </span>
        )}
      </div>

      {!hasEmail && (
        <div className="space-y-2">
          <BrandFormControl label="Привязать email">
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </BrandFormControl>
          <Button
            variant="outline"
            size="sm"
            disabled={!email.trim() || isSubmitting}
            onClick={sendLinkEmail}
          >
            Отправить ссылку
          </Button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm">
        <span>Telegram</span>
        {hasTelegram ? (
          <span className="inline-flex items-center gap-1 text-primary">
            <Check className="h-4 w-4" /> привязан
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <X className="h-4 w-4" /> не привязан
          </span>
        )}
      </div>

      {!hasTelegram && telegramEnabled && botUsername && (
        <TelegramLoginWidget
          botUsername={botUsername}
          linkMode
          onSuccess={async () => {
            await utils.users.getMe.invalidate();
            setMessage('Telegram привязан.');
          }}
          onError={(msg) => setError(msg)}
        />
      )}

      {message && <p className="text-sm text-primary">{message}</p>}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </section>
  );
}
