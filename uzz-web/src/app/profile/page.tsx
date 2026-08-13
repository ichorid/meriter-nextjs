'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card, Notice } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { uzzErrorMessage } from '@/lib/utils';

export default function ProfilePage() {
  const { isUzzAdmin } = useUzzCommunityId();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, { retry: false });
  const [error, setError] = useState<string | null>(null);
  const [botMissing, setBotMissing] = useState(false);

  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      if (data.deepLink) {
        window.location.href = data.deepLink;
        return;
      }
      setBotMissing(true);
      setError(null);
    },
    onError: (err) => setError(uzzErrorMessage(err)),
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/catalog';
    },
  });

  const linked = linkStatus.data?.linked === true;
  const hasTelegram = Boolean(linkStatus.data?.telegramUserId);
  const email = linkStatus.data?.email;

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Профиль</h1>
          <p className="text-sm text-stitch-muted">
            Вход по почте. Telegram нужен, чтобы площадка увидела ваши добрые дела.
          </p>
        </header>

        <Card className="space-y-3">
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
          {isUzzAdmin ? (
            <Link href="/admin" className="block text-sm text-stitch-accent hover:underline">
              Админка площадки
            </Link>
          ) : null}
          {me.data ? (
            <Button
              type="button"
              variant="danger"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Выйти
            </Button>
          ) : null}
        </Card>

        <Card className="space-y-3">
          <h2 className="font-extrabold">Связка</h2>
          {linkStatus.isError ? (
            <Notice tone="warn">
              Не удалось проверить связку.{' '}
              <button
                type="button"
                className="underline"
                onClick={() => void linkStatus.refetch()}
              >
                Ещё раз
              </button>
            </Notice>
          ) : (
            <ul className="space-y-2 text-sm">
              <li className="flex justify-between gap-3">
                <span className="text-stitch-muted">Почта</span>
                <span className="truncate">{email || 'не указана'}</span>
              </li>
              <li className="flex justify-between gap-3">
                <span className="text-stitch-muted">Telegram</span>
                <span>{hasTelegram ? 'привязан' : 'не привязан'}</span>
              </li>
            </ul>
          )}
          {linked ? (
            <p className="text-sm text-stitch-accent">Можно пользоваться правами на обмен.</p>
          ) : !hasTelegram ? (
            <>
              <p className="text-sm text-stitch-muted">
                Остался Telegram — без него площадка не увидит добрые дела из чата.
              </p>
              <Button
                type="button"
                disabled={startTg.isPending || me.isError || linkStatus.isError}
                onClick={() => {
                  setBotMissing(false);
                  startTg.mutate();
                }}
              >
                {startTg.isPending ? 'Готовим ссылку…' : 'Привязать Telegram'}
              </Button>
              {botMissing ? (
                <p className="text-sm text-amber-200">
                  Ссылка на бота не настроена. Напишите администратору.
                </p>
              ) : null}
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </>
          ) : (
            <p className="text-sm text-stitch-muted">
              Почта ещё не в связке. В боте сообщества отправьте /email и код из письма.
            </p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
