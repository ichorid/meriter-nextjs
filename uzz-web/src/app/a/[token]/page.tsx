'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';

export default function RedeemMagicLinkPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const token = typeof params.token === 'string' ? params.token : '';
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);

  const redeem = trpc.auth.redeemEmailLoginLink.useMutation({
    onSuccess: () => {
      router.replace('/');
    },
    onError: (err) => {
      setError(err.message || 'Ссылка недействительна или устарела');
    },
  });

  const mutate = redeem.mutate;

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    mutate({ token });
  }, [token, mutate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-stitch-border bg-stitch-surface p-6 text-center">
        {error ? (
          <>
            <p className="text-sm text-red-400">{error}</p>
            <a href="/login" className="text-sm text-stitch-accent hover:underline">
              Вернуться ко входу
            </a>
          </>
        ) : (
          <p className="text-sm text-stitch-muted">Вход…</p>
        )}
      </div>
    </div>
  );
}
