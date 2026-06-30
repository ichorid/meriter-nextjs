'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { TelegramLoginPanel } from '@/components/shell';
import { isTelegramWebApp } from '@/lib/telegram-env';

export default function LoginPage() {
  const router = useRouter();

  useEffect(() => {
    if (isTelegramWebApp()) {
      router.replace('/tg');
    }
  }, [router]);

  if (typeof window !== 'undefined' && isTelegramWebApp()) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 safe-area-pb pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-stitch-border bg-stitch-surface p-5 shadow-lg sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Meriter</h1>
          <p className="text-sm text-stitch-muted">
            Dev-режим: вход для локальной проверки community-web в браузере.
          </p>
        </div>
        <TelegramLoginPanel />
      </div>
    </div>
  );
}
