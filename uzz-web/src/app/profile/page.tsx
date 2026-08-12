'use client';

import { useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { trpc } from '@/lib/trpc/client';

export default function ProfilePage() {
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, { retry: false });
  const [deepLink, setDeepLink] = useState<string | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      setDeepLink(data.deepLink ?? null);
      setCode(data.code);
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
            Email для входа и привязка Telegram. Без связки банки и сделки на сайте недоступны.
          </p>
        </header>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Аккаунт</h2>
          {me.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : me.isError ? (
            <p className="text-sm text-stitch-muted">Не авторизованы.</p>
          ) : (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Имя</dt>
                <dd>{me.data?.displayName || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Роль</dt>
                <dd>{me.data?.globalRole || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Провайдер</dt>
                <dd>{me.data?.authProvider || '—'}</dd>
              </div>
            </dl>
          )}
          {me.data ? (
            <button
              type="button"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
              className="rounded-lg border border-stitch-border px-3 py-1.5 text-sm text-stitch-muted hover:border-red-400"
            >
              Выйти
            </button>
          ) : null}
        </section>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Связка identity</h2>
          {linkStatus.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : linkStatus.isError ? (
            <p className="text-sm text-stitch-muted">Нужна сессия.</p>
          ) : (
            <dl className="space-y-1 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Email</dt>
                <dd>{linkStatus.data?.email || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Telegram</dt>
                <dd>{linkStatus.data?.telegramUserId || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-stitch-muted">Полная связка</dt>
                <dd className={linkStatus.data?.linked ? 'text-stitch-accent' : 'text-amber-300'}>
                  {linkStatus.data?.linked ? 'да' : 'нет'}
                </dd>
              </div>
            </dl>
          )}
        </section>

        <section className="space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-5">
          <h2 className="font-extrabold">Привязать Telegram</h2>
          <button
            type="button"
            disabled={startTg.isPending || me.isError}
            onClick={() => startTg.mutate()}
            className="rounded-lg bg-stitch-accent px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {startTg.isPending ? 'Генерация…' : 'Получить deep-link'}
          </button>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          {code ? (
            <p className="text-sm text-stitch-muted">
              Код: <span className="font-mono text-stitch-text">{code}</span>
            </p>
          ) : null}
          {deepLink ? (
            <a
              href={deepLink}
              target="_blank"
              rel="noreferrer"
              className="block break-all text-sm text-stitch-accent hover:underline"
            >
              {deepLink}
            </a>
          ) : code ? (
            <p className="text-xs text-stitch-muted">
              Deep-link недоступен (нет BOT_USERNAME) — отправьте код боту вручную.
            </p>
          ) : null}
        </section>
      </div>
    </AppShell>
  );
}
