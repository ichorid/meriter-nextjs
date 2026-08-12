'use client';

import Link from 'next/link';
import { AppShell } from '@/components/app-shell';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { bankStatusLabel } from '@/lib/utils';

export default function HomePage() {
  const communityId = config.defaultCommunityId;
  const enabled = Boolean(communityId);

  const banks = trpc.banks.listMine.useQuery(
    { communityId },
    { enabled, retry: false },
  );
  const linkStatus = trpc.identity.getLinkStatus.useQuery(undefined, {
    enabled,
    retry: false,
  });

  const fakeAuth = trpc.auth.authenticateFake.useMutation({
    onSuccess: () => {
      void banks.refetch();
      void linkStatus.refetch();
    },
  });

  return (
    <AppShell>
      <div className="space-y-6">
        <section className="space-y-2">
          <h1 className="text-2xl font-extrabold tracking-tight">Мои банки</h1>
          <p className="text-sm text-stitch-muted">
            Банки появляются из признанных добрых дел. Номинал — игровой потолок сделки в ₽.
          </p>
        </section>

        {linkStatus.data ? (
          <p className="text-sm text-stitch-muted">
            Связка email+Telegram:{' '}
            <span className={linkStatus.data.linked ? 'text-stitch-accent' : 'text-amber-300'}>
              {linkStatus.data.linked ? 'есть' : 'нет'}
            </span>
            {!linkStatus.data.linked ? (
              <>
                {' '}
                —{' '}
                <Link href="/profile" className="text-stitch-accent hover:underline">
                  привязать в профиле
                </Link>
              </>
            ) : null}
          </p>
        ) : null}

        <section className="space-y-3">
          {banks.isLoading ? (
            <p className="text-sm text-stitch-muted">Загрузка…</p>
          ) : banks.isError ? (
            <p className="text-sm text-stitch-muted">
              Не удалось загрузить банки. Возможно, нужна сессия —{' '}
              <Link href="/login" className="text-stitch-accent hover:underline">
                войти
              </Link>
              .
            </p>
          ) : !banks.data?.length ? (
            <div className="rounded-xl border border-stitch-border bg-stitch-surface p-5">
              <p className="text-sm text-stitch-muted">
                Пока нет активных банков. Опубликуйте доброе дело в Telegram и дождитесь начисления
                заслуг.
              </p>
            </div>
          ) : (
            banks.data.map((bank) => (
              <article
                key={bank.id}
                className="rounded-xl border border-stitch-border bg-stitch-surface p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-extrabold">Банк {bank.id.slice(0, 8)}</h2>
                  <span className="text-sm text-stitch-muted">{bankStatusLabel(bank.status)}</span>
                </div>
                <p className="mt-1 text-sm text-stitch-accent">
                  {bank.nominalRub != null ? `номинал ${bank.nominalRub} ₽` : 'номинал не задан'}
                </p>
                <p className="text-xs text-stitch-muted">осталось хопов: {bank.hopsLeft}</p>
              </article>
            ))
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/catalog"
            className="rounded-xl border border-stitch-border bg-stitch-surface p-4 transition hover:border-stitch-accent"
          >
            <h2 className="font-extrabold">Каталог</h2>
            <p className="mt-1 text-sm text-stitch-muted">Найти услугу или товар</p>
          </Link>
          <Link
            href="/lots"
            className="rounded-xl border border-stitch-border bg-stitch-surface p-4 transition hover:border-stitch-accent"
          >
            <h2 className="font-extrabold">Мои услуги</h2>
            <p className="mt-1 text-sm text-stitch-muted">Создать карточку предложения</p>
          </Link>
          <Link
            href="/deals"
            className="rounded-xl border border-stitch-border bg-stitch-surface p-4 transition hover:border-stitch-accent"
          >
            <h2 className="font-extrabold">Сделки</h2>
            <p className="mt-1 text-sm text-stitch-muted">Запросы и исполнение</p>
          </Link>
          <Link
            href="/wallet"
            className="rounded-xl border border-stitch-border bg-stitch-surface p-4 transition hover:border-stitch-accent"
          >
            <h2 className="font-extrabold">Кошелёк</h2>
            <p className="mt-1 text-sm text-stitch-muted">Баланс заслуг</p>
          </Link>
        </section>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <p className="text-stitch-muted">
            Нет сессии?{' '}
            <Link href="/login" className="text-stitch-accent hover:underline">
              Войти по email
            </Link>
          </p>
          {config.development.fakeDataMode ? (
            <button
              type="button"
              disabled={fakeAuth.isPending}
              onClick={() => fakeAuth.mutate({})}
              className="rounded-lg border border-stitch-border px-3 py-1.5 text-stitch-text hover:border-stitch-accent disabled:opacity-60"
            >
              {fakeAuth.isPending ? 'Вход…' : 'Войти как тестовый пользователь'}
            </button>
          ) : null}
          {fakeAuth.isError ? (
            <span className="text-red-400">{fakeAuth.error.message}</span>
          ) : null}
        </div>
      </div>
    </AppShell>
  );
}
