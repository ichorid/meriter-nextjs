import type { LucideIcon } from 'lucide-react';
import { Newspaper, Send, User, Users } from 'lucide-react';

export type TgCommunityTabId = 'feed' | 'members' | 'transfer' | 'me';

export type TgCommunityTab = {
  id: TgCommunityTabId;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export type TgMoreTab = {
  id: string;
  href: string;
  label: string;
  leadOnly?: boolean;
  moderationOnly?: boolean;
};

export function buildTgCommunityTabs(communityId: string): TgCommunityTab[] {
  const base = `/c/${communityId}`;
  return [
    {
      id: 'feed',
      href: `${base}/feed`,
      label: 'Лента',
      shortLabel: 'Лента',
      icon: Newspaper,
    },
    {
      id: 'members',
      href: `${base}/members`,
      label: 'Люди',
      shortLabel: 'Люди',
      icon: Users,
    },
    {
      id: 'transfer',
      href: `${base}/transfer`,
      label: 'Перевод',
      shortLabel: 'Перевод',
      icon: Send,
    },
    {
      id: 'me',
      href: `${base}/me`,
      label: 'Я',
      shortLabel: 'Я',
      icon: User,
    },
  ];
}

export function buildTgMoreTabs(
  communityId: string,
  options: { isLead: boolean; moderationEnabled: boolean },
): TgMoreTab[] {
  const base = `/c/${communityId}`;
  const tabs: TgMoreTab[] = [
    { id: 'merit-history', href: `${base}/merit-history`, label: 'История заслуг' },
    { id: 'settings', href: `${base}/settings`, label: 'Настройки', leadOnly: true },
  ];
  if (options.moderationEnabled) {
    tabs.unshift({
      id: 'moderation',
      href: `${base}/moderation`,
      label: 'Модерация',
      leadOnly: true,
      moderationOnly: true,
    });
  }
  return tabs.filter((tab) => !tab.leadOnly || options.isLead);
}

export function resolveTgActiveTab(pathname: string, communityId: string): TgCommunityTabId {
  const base = `/c/${communityId}`;
  if (pathname.startsWith(`${base}/members`)) return 'members';
  if (pathname.startsWith(`${base}/transfer`)) return 'transfer';
  if (pathname.startsWith(`${base}/me`)) return 'me';
  if (pathname.startsWith(`${base}/posts/`)) return 'feed';
  return 'feed';
}
