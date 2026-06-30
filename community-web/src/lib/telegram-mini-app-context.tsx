'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  getTelegramInitData,
  getTelegramStartParam,
  isTelegramWebApp,
  parseTelegramChatIdFromInitData,
} from '@/lib/telegram-env';
import { initTelegramWebApp } from '@/lib/telegram-webapp';

type TelegramMiniAppContextValue = {
  isMiniApp: boolean;
  initData: string | null;
  telegramChatId: string | null;
  startParam: string | null;
  bootstrapped: boolean;
  setBootstrapped: (value: boolean) => void;
};

const TelegramMiniAppContext = createContext<TelegramMiniAppContextValue>({
  isMiniApp: false,
  initData: null,
  telegramChatId: null,
  startParam: null,
  bootstrapped: false,
  setBootstrapped: () => undefined,
});

export function TelegramMiniAppProvider({ children }: { children: ReactNode }) {
  const [bootstrapped, setBootstrapped] = useState(false);
  const [isMiniApp, setIsMiniApp] = useState(false);
  const [initData, setInitData] = useState<string | null>(null);
  const [telegramChatId, setTelegramChatId] = useState<string | null>(null);
  const [startParam, setStartParam] = useState<string | null>(null);

  useEffect(() => {
    const mini = isTelegramWebApp();
    setIsMiniApp(mini);
    if (!mini) return;

    initTelegramWebApp();
    const raw = getTelegramInitData();
    setInitData(raw);
    if (raw) {
      setTelegramChatId(parseTelegramChatIdFromInitData(raw));
    }
    setStartParam(getTelegramStartParam());
  }, []);

  const stableSetBootstrapped = useCallback((value: boolean) => {
    setBootstrapped(value);
  }, []);

  const value = useMemo(
    () => ({
      isMiniApp,
      initData,
      telegramChatId,
      startParam,
      bootstrapped,
      setBootstrapped: stableSetBootstrapped,
    }),
    [isMiniApp, initData, telegramChatId, startParam, bootstrapped, stableSetBootstrapped],
  );

  return (
    <TelegramMiniAppContext.Provider value={value}>
      {children}
    </TelegramMiniAppContext.Provider>
  );
}

export function useTelegramMiniApp(): TelegramMiniAppContextValue {
  return useContext(TelegramMiniAppContext);
}
