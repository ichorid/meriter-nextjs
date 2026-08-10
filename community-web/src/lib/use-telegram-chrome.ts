'use client';

import { useEffect, useRef } from 'react';
import { isTelegramWebApp } from '@/lib/telegram-env';

type MainButtonOptions = {
  text: string;
  visible?: boolean;
  enabled?: boolean;
  loading?: boolean;
  onClick: () => void;
};

type BackButtonOptions = {
  visible?: boolean;
  onClick: () => void;
};

function getWebApp() {
  if (typeof window === 'undefined') return null;
  return window.Telegram?.WebApp ?? null;
}

export function useTelegramMainButton({
  text,
  visible = true,
  enabled = true,
  loading = false,
  onClick,
}: MainButtonOptions): boolean {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const inMiniApp = typeof window !== 'undefined' && isTelegramWebApp();
  const mainButton = inMiniApp ? getWebApp()?.MainButton : undefined;
  const active = Boolean(mainButton && visible);

  useEffect(() => {
    if (!mainButton || !visible) {
      mainButton?.hide();
      return;
    }

    mainButton.setText(text);
    if (loading || !enabled) {
      mainButton.disable();
    } else {
      mainButton.enable();
    }
    if (loading) {
      mainButton.showProgress();
    } else {
      mainButton.hideProgress();
    }
    mainButton.show();

    const handler = () => onClickRef.current();
    mainButton.onClick(handler);

    return () => {
      mainButton.offClick(handler);
      mainButton.hide();
      mainButton.hideProgress();
    };
  }, [mainButton, text, visible, enabled, loading]);

  return active;
}

export function useTelegramBackButton({
  visible = true,
  onClick,
}: BackButtonOptions): boolean {
  const onClickRef = useRef(onClick);
  onClickRef.current = onClick;
  const inMiniApp = typeof window !== 'undefined' && isTelegramWebApp();
  const backButton = inMiniApp ? getWebApp()?.BackButton : undefined;
  const active = Boolean(backButton && visible);

  useEffect(() => {
    if (!backButton || !visible) {
      backButton?.hide();
      return;
    }

    backButton.show();
    const handler = () => onClickRef.current();
    backButton.onClick(handler);

    return () => {
      backButton.offClick(handler);
      backButton.hide();
    };
  }, [backButton, visible]);

  return active;
}
