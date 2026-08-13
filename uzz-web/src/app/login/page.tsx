'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { uzzErrorMessage } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter();
  const me = trpc.auth.me.useQuery(undefined, { retry: false });
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (me.data) router.replace('/catalog');
  }, [me.data, router]);

  const sendLink = trpc.auth.sendEmailLoginLink.useMutation({
    onSuccess: () => {
      setSent(true);
      setError(null);
    },
    onError: (err) => {
      setError(uzzErrorMessage(err));
      setSent(false);
    },
  });

  const fakeAuth = trpc.auth.authenticateFake.useMutation({
    onSuccess: () => {
      router.replace('/catalog');
    },
    onError: (err) => {
      setError(uzzErrorMessage(err));
    },
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    sendLink.mutate({ email: email.trim() });
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 safe-area-pb pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-stitch-border bg-stitch-surface p-5 shadow-lg sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Услуги за заслуги</h1>
          <p className="text-sm text-stitch-muted">
            Пришлём одноразовую ссылку на почту. Пароль не нужен.
          </p>
        </div>

        {sent ? (
          <div className="space-y-3 rounded-lg border border-stitch-border bg-stitch-canvas/60 p-4 text-sm">
            <p>
              Ссылка отправлена на <span className="font-medium text-stitch-accent">{email}</span>.
            </p>
            <p className="text-stitch-muted">Проверьте почту и перейдите по ссылке.</p>
            <button
              type="button"
              className="text-stitch-accent underline"
              onClick={() => setSent(false)}
            >
              Отправить ещё раз
            </button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm text-stitch-muted">Почта</span>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-stitch-border bg-stitch-canvas px-3 py-2 text-stitch-text outline-none ring-stitch-accent focus:ring-2"
                placeholder="почта@пример.ру"
              />
            </label>
            {error ? <p className="text-sm text-red-400">{error}</p> : null}
            <button
              type="submit"
              disabled={sendLink.isPending}
              className="w-full rounded-lg bg-stitch-accent px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {sendLink.isPending ? 'Отправка…' : 'Получить ссылку'}
            </button>
          </form>
        )}

        {config.development.fakeDataMode ? (
          <button
            type="button"
            disabled={fakeAuth.isPending}
            onClick={() => {
              setError(null);
              fakeAuth.mutate({});
            }}
            className="w-full rounded-lg border border-stitch-border px-4 py-2.5 text-sm font-medium text-stitch-text hover:border-stitch-accent disabled:opacity-60"
          >
            {fakeAuth.isPending ? 'Вход…' : 'Войти как тестовый пользователь'}
          </button>
        ) : null}

        <p className="text-center text-xs text-stitch-muted">
          <Link href="/catalog" className="text-stitch-accent hover:underline">
            Смотреть обмен без входа
          </Link>
        </p>
      </div>
    </div>
  );
}
