'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';

export default function ProfilePage() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, { retry: false });
  const [error, setError] = useState<string | null>(null);

  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      if (data.deepLink) {
        window.location.href = data.deepLink;
      }
      setError(null);
    },
    onError: (err) => setError(err.message || 'Не удалось начать привязку'),
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/login';
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Профиль</h1>
          <p className="text-sm text-stitch-muted">
            Вход по почте. Telegram нужен, чтобы видеть права на обмен с добрых дел.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Аккаунт</h2>
          {me.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Имя</dt>
                <dd>{me.data?.displayName || '—'}</dd>
              </div>
              {me.data?.communityName ? (
                <div className="flex justify-between gap-3">
                  <dt className="text-stitch-muted">Сообщество</dt>
                  <dd>{me.data.communityName}</dd>
                </div>
              ) : null}
            </dl>
          )}
          <Link href="/wallet" className="inline-block text-sm text-stitch-accent hover:underline">
            Кошелёк и история
          </Link>
          {me.data ? (
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              className="block rounded-lg border border-stitch-border px-3 py-1.5 text-sm text-stitch-muted hover:border-red-400"
            >
              Выйти
            </button>
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Связка</h2>
          <dl className="space-y-1 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-stitch-muted">Почта</dt>
              <dd>{linkStatus.data?.email || 'не указана'}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-stitch-muted">Telegram</dt>
              <dd>{linkStatus.data?.telegramUserId ? 'привязан' : 'не привязан'}</dd>
            </div>
          </dl>
          {!linkStatus.data?.telegramUserId ? (
            <>
              <button
                type="button"
                disabled={startTg.isPending || me.isError}
                onClick={() => startTg.mutate()}
                className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {startTg.isPending ? 'Готовим ссылку…' : 'Привязать Telegram'}
              </button>
              {startTg.data?.deepLink ? (
                <a
                  href={startTg.data.deepLink}
                  className="block text-sm text-stitch-accent hover:underline"
                >
                  Открыть бота
                </a>
              ) : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
