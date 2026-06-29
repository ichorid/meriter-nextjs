import type { LucideIcon } from 'lucide-react';
import { Clock, User, Users } from 'lucide-react';

export type TgCommunityTabId = 'me' | 'members' | 'history';

export type TgCommunityTab = {
  id: TgCommunityTabId;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
};

export function buildTgCommunityTabs(communityId: string): TgCommunityTab[] {
  const base = `/c/${communityId}`;
  return [
    {
      id: 'me',
      href: `${base}/me`,
      label: 'Баланс',
      shortLabel: 'Баланс',
      icon: User,
    },
    {
      id: 'members',
      href: `${base}/members`,
      label: 'Участники',
      shortLabel: 'Люди',
      icon: Users,
    },
    {
      id: 'history',
      href: `${base}/merit-history`,
      label: 'История',
      shortLabel: 'История',
      icon: Clock,
    },
  ];
}

export function resolveTgActiveTab(pathname: string, communityId: string): TgCommunityTabId {
  const base = `/c/${communityId}`;
  if (pathname.startsWith(`${base}/members`)) return 'members';
  if (pathname.startsWith(`${base}/merit-history`)) return 'history';
  if (pathname.startsWith(`${base}/posts/`)) return 'me';
  return 'me';
}
