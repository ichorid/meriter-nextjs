'use client';

import Script from 'next/script';
import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import config from '@/config';

function readMeriterTheme(): 'light' | 'dark' {
  if (typeof document === 'undefined') {
    return 'dark';
  }
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function syncGuidewellHostTheme(): void {
  const host = document.getElementById('guidewell-widget-host');
  if (!host) {
    return;
  }
  host.classList.toggle('gw-theme-dark', readMeriterTheme() === 'dark');
}

/**
 * Guidewell AI tutor / co-browse widget (global FAB).
 * Loaded on all pages when NEXT_PUBLIC_GUIDEWELL_ENABLED=true and API key is set.
 */
export function GuidewellWidget() {
  const locale = useLocale();
  const guidewell = config.guidewell;

  useEffect(() => {
    syncGuidewellHostTheme();

    const observer = new MutationObserver(() => {
      syncGuidewellHostTheme();
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    const retry = window.setInterval(() => {
      if (document.getElementById('guidewell-widget-host')) {
        syncGuidewellHostTheme();
        window.clearInterval(retry);
      }
    }, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(retry);
    };
  }, []);

  if (!guidewell.enabled) {
    return null;
  }

  const fabText =
    locale === 'ru'
      ? guidewell.fabTextRu
      : guidewell.fabText;
  const lang = locale === 'ru' ? 'ru' : 'en';
  const initialTheme = readMeriterTheme();

  return (
    <Script
      id="guidewell-widget"
      src={`${guidewell.apiBase}/widget.js`}
      strategy="afterInteractive"
      data-api={guidewell.apiBase}
      data-key={guidewell.apiKey}
      data-fab-text={fabText}
      data-chat={guidewell.chat}
      data-ai={guidewell.ai ? 'true' : 'false'}
      data-lang={lang}
      data-theme={initialTheme}
      data-primary-color={guidewell.primaryColor}
    />
  );
}
