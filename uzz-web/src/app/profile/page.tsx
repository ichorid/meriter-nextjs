'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { Button, Card } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { uzzErrorMessage } from '@/lib/utils';

export default function ProfilePage() {
  const { isUzzAdmin } = useUzzCommunityId();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, { retry: false });
  const [error, setError] = useState<string | null>(null);

  const startTg = trpc.identity.startTelegramLink.useMutation({
    onSuccess: (data) => {
      if (data.deepLink) window.location.href = data.deepLink;
      setError(null);
    },
    onError: (err) => setError(uzzErrorMessage(err)),
  });

  const logout = trpc.auth.logout.useMutation({
    onSuccess: () => {
      window.location.href = '/catalog';
    },
  });

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
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-3">
              <span className="text-stitch-muted">Почта</span>
              <span className="truncate">{linkStatus.data?.email || 'не указана'}</span>
            </li>
            <li className="flex justify-between gap-3">
              <span className="text-stitch-muted">Telegram</span>
              <span>{linkStatus.data?.telegramUserId ? 'привязан' : 'не привязан'}</span>
            </li>
          </ul>
          {!linkStatus.data?.telegramUserId ? (
            <>
              <Button
                type="button"
                disabled={startTg.isPending || me.isError}
                onClick={() => startTg.mutate()}
              >
                {startTg.isPending ? 'Готовим ссылку…' : 'Привязать Telegram'}
              </Button>
              {error ? <p className="text-sm text-red-400">{error}</p> : null}
            </>
          ) : (
            <p className="text-sm text-stitch-accent">Можно пользоваться правами на обмен.</p>
          )}
        </Card>
      </div>
    </AppShell>
  );
}
