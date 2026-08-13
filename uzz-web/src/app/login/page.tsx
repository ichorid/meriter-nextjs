'use client';
import Link from 'next/link';
import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Field, Notice, inputClass } from '@/components/ui';
import { config } from '@/config';
import { trpc } from '@/lib/trpc/client';
import { consumeReturnTo, rememberReturnTo, uzzErrorMessage } from '@/lib/utils';

export default function LoginPage() {
  const router = useRouter(); const me = trpc.auth.me.useQuery(undefined, { retry: false }); const [email, setEmail] = useState(''); const [sent, setSent] = useState(false); const [error, setError] = useState<string | null>(null);
  useEffect(() => { const next = new URLSearchParams(window.location.search).get('next'); if (next) rememberReturnTo(next); }, []); useEffect(() => { if (me.data) router.replace(consumeReturnTo()); }, [me.data, router]);
  const send = trpc.auth.sendEmailLoginLink.useMutation({ onSuccess: () => { setSent(true); setError(null); }, onError: (err) => { setSent(false); setError(uzzErrorMessage(err)); } }); const fake = trpc.auth.authenticateFake.useMutation({ onSuccess: () => router.replace(consumeReturnTo()), onError: (err) => setError(uzzErrorMessage(err)) });
  function submit(event: FormEvent) { event.preventDefault(); setError(null); send.mutate({ email: email.trim() }); }
  return <main className="flex min-h-screen items-center justify-center bg-stitch-canvas px-4 py-10 text-stitch-text"><section className="w-full max-w-md space-y-6 rounded-2xl border border-stitch-border bg-stitch-surface p-6 shadow-2xl sm:p-8"><div className="text-center"><p className="text-xs font-bold uppercase tracking-widest text-stitch-accent">Без пароля</p><h1 className="mt-2 text-2xl font-black">Вход по email</h1><p className="mt-2 text-sm leading-6 text-stitch-muted">Пришлём одноразовую защищённую ссылку. Других способов входа в продукте нет.</p></div>{sent ? <Notice tone="ok"><strong>Письмо отправлено на {email}.</strong><br />Откройте ссылку в этом письме. Если его нет, проверьте «Спам» и повторите отправку.</Notice> : <form className="space-y-4" onSubmit={submit}><Field label="Email"><input required type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className={inputClass} placeholder="name@example.com" /></Field>{error ? <Notice tone="warn">{error}</Notice> : null}<Button className="w-full" type="submit" disabled={send.isPending}>{send.isPending ? 'Отправляем…' : 'Получить ссылку'}</Button></form>}{sent ? <Button className="w-full" variant="ghost" disabled={send.isPending} onClick={() => send.mutate({ email: email.trim() })}>Отправить ещё раз</Button> : null}{config.development.fakeDataMode ? <Button className="w-full" variant="ghost" disabled={fake.isPending} onClick={() => fake.mutate({})}>Тестовый вход</Button> : null}<Link href="/catalog" className="block text-center text-sm text-stitch-accent hover:underline">Смотреть каталог без входа</Link></section></main>;
}
