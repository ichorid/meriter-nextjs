'use client';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { AppShell } from '@/components/app-shell';
import { Badge, Button, Card, Notice, PageHeader, QueryFailed, Skeleton } from '@/components/ui';
import { trpc } from '@/lib/trpc/client';
import { useUzzCommunityId } from '@/lib/use-uzz-community';
import { clearUzzSessionFlag, closePendingExternalWindow, navigatePendingExternalWindow, openPendingExternalWindow, uzzErrorMessage } from '@/lib/utils';

export default function ProfilePage() {
  const { isUzzAdmin } = useUzzCommunityId(); const me = trpc.auth.me.useQuery(undefined, { retry: false }); const link = trpc.identity.getLinkStatus.useQuery(undefined, { retry: false }); const [error, setError] = useState<string | null>(null); const [logoutError, setLogoutError] = useState<string | null>(null);
  const telegramWindow = useRef<Window | null>(null);
  const [fromCatalog, setFromCatalog] = useState(false);
  useEffect(() => {
    setFromCatalog(new URLSearchParams(window.location.search).get('from') === 'catalog');
  }, []);
  const start = trpc.identity.startTelegramLink.useMutation({
    onSuccess: ({ deepLink }) => {
      if (!deepLink) {
        closePendingExternalWindow(telegramWindow.current);
        setError('Ссылка на бота не настроена. Обратитесь к администратору.');
        return;
      }
      if (!navigatePendingExternalWindow(telegramWindow.current, deepLink)) {
        setError('Разрешите всплывающие окна, чтобы открыть Telegram.');
      }
    },
    onError: (err) => {
      closePendingExternalWindow(telegramWindow.current);
      setError(uzzErrorMessage(err));
    },
  });
  const logout = trpc.auth.logout.useMutation({ onSuccess: () => { clearUzzSessionFlag(); window.location.href = '/catalog'; }, onError: (err) => setLogoutError(uzzErrorMessage(err)) });
  return <AppShell><div className="space-y-8"><PageHeader eyebrow="Идентификация" title="Профиль">Email — единственный способ входа. Telegram связывает этот вход с добрыми делами в сообществе; публично ваш контакт не показывается до принятия заявки.</PageHeader>
    {fromCatalog && !link.data?.telegramUserId ? <Notice>Чтобы оставить заявку на услугу, сначала привяжите Telegram — затем вернитесь в <Link href="/catalog" className="underline">каталог</Link>.</Notice> : null}
    <div className="grid gap-4 md:grid-cols-2"><Card className="space-y-4"><h2 className="text-xl font-black">Аккаунт</h2>{me.isLoading ? <Skeleton className="h-20" /> : me.isError ? <QueryFailed onRetry={() => void me.refetch()} error={me.error} /> : <dl className="space-y-3 text-sm"><div><dt className="text-xs text-stitch-muted">Имя</dt><dd>{me.data?.displayName || 'Не указано'}</dd></div>{me.data?.communityName ? <div><dt className="text-xs text-stitch-muted">Сообщество</dt><dd>{me.data.communityName}</dd></div> : null}</dl>}<div className="flex flex-wrap gap-2"><Link href="/wallet" className="inline-flex min-h-11 items-center rounded-xl border border-stitch-border px-4 text-sm font-semibold">Кошелёк</Link>{isUzzAdmin ? <Link href="/admin" className="inline-flex min-h-11 items-center rounded-xl border border-stitch-border px-4 text-sm font-semibold">Настройки платформы</Link> : null}</div><Button variant="danger" disabled={logout.isPending} onClick={() => logout.mutate()}>Выйти</Button>{logoutError ? <Notice tone="warn" role="alert">{logoutError}</Notice> : null}</Card>
      <Card className="space-y-4"><div className="flex items-center justify-between"><h2 className="text-xl font-black">Связка</h2>{link.data?.linked ? <Badge tone="ok">Готово</Badge> : <Badge tone="warn">Не завершена</Badge>}</div>{link.isLoading ? <Skeleton className="h-20" /> : link.isError ? <QueryFailed onRetry={() => void link.refetch()} error={link.error} /> : <><dl className="space-y-3 text-sm"><div><dt className="text-xs text-stitch-muted">Email для входа</dt><dd className="break-all">{link.data?.email || 'Не указан'}</dd></div><div><dt className="text-xs text-stitch-muted">Telegram</dt><dd>{link.data?.telegramUsername ? `@${link.data.telegramUsername.replace(/^@/, '')}` : link.data?.telegramUserId ? 'Привязан' : 'Не привязан'}</dd></div></dl>{!link.data?.telegramUserId ? <><Button disabled={start.isPending} onClick={() => { telegramWindow.current = openPendingExternalWindow(); start.mutate(); }}>{start.isPending ? 'Готовим ссылку…' : 'Привязать Telegram'}</Button>{start.data?.deepLink ? <a href={start.data.deepLink} target="_blank" rel="noopener noreferrer" className="block text-sm text-stitch-accent-text hover:underline">Открыть Telegram в новом окне</a> : null}</> : <Notice tone="ok">Банки, сделки и добрые дела сопоставлены с этим аккаунтом.</Notice>}{error ? <Notice tone="warn">{error}</Notice> : null}</>}</Card></div>
  </div></AppShell>;
}
