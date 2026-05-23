'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { useCaptiveBrowser } from '@/lib/captive-browser';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

const DISMISS_KEY = 'meriter.captiveHint.dismissed';

/**
 * Full-screen hint when Meriter runs inside a messenger in-app browser (Telegram, etc.).
 * Uses a self-contained light card with explicit text colors so content stays readable
 * regardless of the app dark/light theme on the page underneath.
 */
export function TelegramHint() {
  const { isCaptive } = useCaptiveBrowser();
  const t = useTranslations('login.captiveHint');
  const [open, setOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);

  useEffect(() => {
    if (!isCaptive || typeof window === 'undefined') {
      setOpen(false);
      return;
    }
    try {
      setOpen(sessionStorage.getItem(DISMISS_KEY) !== '1');
    } catch {
      setOpen(true);
    }
  }, [isCaptive]);

  const dismiss = () => {
    try {
      sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // ignore
    }
    setOpen(false);
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-[2147483647] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="captive-hint-title"
    >
      <div
        className={cn(
          'w-full max-w-[360px] rounded-xl border border-slate-200 bg-white p-6 shadow-xl',
          'text-slate-900',
        )}
      >
        <h2 id="captive-hint-title" className="text-lg font-semibold leading-snug text-slate-900">
          {t('title')}
        </h2>

        <p className="mt-3 text-sm leading-relaxed text-slate-700">{t('body')}</p>

        <p className="mt-3 text-sm leading-relaxed text-slate-600">{t('why')}</p>

        <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left text-sm font-medium text-slate-800"
            aria-expanded={detailsOpen}
            onClick={() => setDetailsOpen((v) => !v)}
          >
            <span>{t('disable')}</span>
            <ChevronDown
              className={cn('h-4 w-4 shrink-0 text-slate-500 transition-transform', detailsOpen && 'rotate-180')}
              aria-hidden
            />
          </button>
          {detailsOpen ? (
            <div className="space-y-2 border-t border-slate-200 px-3 py-2.5 text-sm leading-relaxed text-slate-600">
              <p>{t('disableIos')}</p>
              <p>{t('disableAndroid')}</p>
            </div>
          ) : null}
        </div>

        <Button type="button" className="mt-5 w-full sm:w-auto" onClick={dismiss}>
          {t('ok')}
        </Button>
      </div>
    </div>
  );
}
