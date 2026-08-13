'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { consumeReturnTo, uzzErrorMessage } from '@/lib/utils';

export default function RedeemMagicLinkPage() {
  const params = useParams<{ token: string }>(); const router = useRouter(); const token = typeof params.token === 'string' ? params.token : ''; const [error, setError] = useState<string | null>(null); const started = useRef(false);
  const redeem = trpc.auth.redeemEmailLoginLink.useMutation({ onSuccess: () => router.replace(consumeReturnTo()), onError: (err) => setError(uzzErrorMessage(err)) }); const mutate = redeem.mutate;
  useEffect(() => { if (!token || started.current) return; started.current = true; mutate({ token }); }, [mutate, token]);
  return <main className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4 text-stitch-text"><section className="w-full max-w-md space-y-4 rounded-2xl border border-stitch-border bg-stitch-surface p-6 text-center">{error ? <><h1 className="text-xl font-black">Не удалось войти</h1><p className="text-sm text-red-300">{error}</p><a href="/login" className="text-sm text-stitch-accent hover:underline">Получить новую ссылку</a></> : <><div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-stitch-border border-t-stitch-accent" /><p className="text-sm text-stitch-muted">Проверяем одноразовую ссылку…</p></>}</section></main>;
}
