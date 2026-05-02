'use client';

import React, { createContext, useCallback, useContext, useLayoutEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

const STORAGE_KEY = 'meriter.pilotMultiObraz.welcomeDismissed';

export type PilotObrazUiContextValue = {
  welcomeDismissed: boolean;
  dismissWelcome: () => void;
  openLore: () => void;
};

const PilotObrazUiContext = createContext<PilotObrazUiContextValue | null>(null);

export function usePilotObrazUi(): PilotObrazUiContextValue {
  const v = useContext(PilotObrazUiContext);
  if (!v) {
    throw new Error('usePilotObrazUi must be used within PilotObrazUiProvider');
  }
  return v;
}

export function PilotObrazUiProvider({ children }: { children: React.ReactNode }) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [loreOpen, setLoreOpen] = useState(false);
  const [loreText, setLoreText] = useState<string | null>(null);
  const [loreLoading, setLoreLoading] = useState(false);

  useLayoutEffect(() => {
    try {
      setWelcomeDismissed(window.localStorage.getItem(STORAGE_KEY) === '1');
    } catch {
      /* ignore */
    }
  }, []);

  const dismissWelcome = useCallback(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setWelcomeDismissed(true);
  }, []);

  const openLore = useCallback(async () => {
    setLoreOpen(true);
    if (loreText != null || loreLoading) return;
    setLoreLoading(true);
    try {
      const res = await fetch('/api/pilot/lore');
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = (await res.json()) as { success?: boolean; data?: string; error?: { message?: string } };
        if (!res.ok || json?.success === false) {
          setLoreText(json?.error?.message || t('loreLoadFailed'));
        } else {
          setLoreText(json?.data ?? '');
        }
      } else {
        const txt = await res.text();
        setLoreText(txt);
      }
    } catch {
      setLoreText(t('loreLoadFailed'));
    } finally {
      setLoreLoading(false);
    }
  }, [loreText, loreLoading, t]);

  const value = useMemo(
    () => ({
      welcomeDismissed,
      dismissWelcome,
      openLore,
    }),
    [welcomeDismissed, dismissWelcome, openLore],
  );

  return (
    <PilotObrazUiContext.Provider value={value}>
      {children}

      <Dialog open={loreOpen} onOpenChange={setLoreOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
          <DialogHeader>
            <DialogTitle>{t('aboutMeriterra')}</DialogTitle>
            <DialogDescription className="text-[#94a3b8]">{t('loreSubtitle')}</DialogDescription>
          </DialogHeader>
          {loreLoading ? (
            <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
          ) : (
            <article className="prose prose-invert max-w-none prose-p:text-[#cbd5e1] prose-strong:text-white prose-headings:text-white">
              <ReactMarkdown>{loreText ?? ''}</ReactMarkdown>
            </article>
          )}
        </DialogContent>
      </Dialog>
    </PilotObrazUiContext.Provider>
  );
}
