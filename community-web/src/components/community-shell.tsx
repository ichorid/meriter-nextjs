'use client';

import { Shell } from '@/components/shell';
import { TgShell } from '@/components/tg-shell';
import { useTelegramMiniApp } from '@/lib/telegram-mini-app-context';
import type { TgCommunityTabId } from '@/lib/community-nav-tg';

export function CommunityShell({
  communityId,
  children,
  active,
  tgActive,
}: {
  communityId: string;
  children: React.ReactNode;
  active: string;
  tgActive: TgCommunityTabId;
}) {
  const { isMiniApp } = useTelegramMiniApp();

  if (isMiniApp) {
    return (
      <TgShell communityId={communityId} active={tgActive}>
        {children}
      </TgShell>
    );
  }

  return (
    <Shell communityId={communityId} active={active}>
      {children}
    </Shell>
  );
}
