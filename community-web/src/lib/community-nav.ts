import type { LucideIcon } from 'lucide-react';
import {
  Calendar,
  Coins,
  FileText,
  LayoutGrid,
  Newspaper,
  Settings,
  Shield,
  Users,
} from 'lucide-react';

export type CommunityTabId =
  | 'feed'
  | 'members'
  | 'projects'
  | 'documents'
  | 'events'
  | 'merit-history'
  | 'moderation'
  | 'settings';

export type CommunityTab = {
  id: CommunityTabId;
  href: string;
  label: string;
  shortLabel: string;
  icon: LucideIcon;
  placement: 'primary' | 'more';
};

export type BuildCommunityTabsOptions = {
  isLead: boolean;
  moderationEnabled: boolean;
};

const TAB_DEFINITIONS: Omit<CommunityTab, 'href'>[] = [
  {
    id: 'feed',
    label: 'Лента',
    shortLabel: 'Лента',
    icon: Newspaper,
    placement: 'primary',
  },
  {
    id: 'members',
    label: 'Пользователи',
    shortLabel: 'Участники',
    icon: Users,
    placement: 'primary',
  },
  {
    id: 'projects',
    label: 'Проекты',
    shortLabel: 'Проекты',
    icon: LayoutGrid,
    placement: 'primary',
  },
  {
    id: 'merit-history',
    label: 'Заслуги',
    shortLabel: 'Заслуги',
    icon: Coins,
    placement: 'primary',
  },
  {
    id: 'documents',
    label: 'Документы',
    shortLabel: 'Документы',
    icon: FileText,
    placement: 'more',
  },
  {
    id: 'events',
    label: 'События',
    shortLabel: 'События',
    icon: Calendar,
    placement: 'more',
  },
  {
    id: 'moderation',
    label: 'Модерация',
    shortLabel: 'Модерация',
    icon: Shield,
    placement: 'more',
  },
  {
    id: 'settings',
    label: 'Настройки',
    shortLabel: 'Настройки',
    icon: Settings,
    placement: 'more',
  },
];

const MORE_TAB_IDS = new Set<CommunityTabId>([
  'documents',
  'events',
  'moderation',
  'settings',
]);

export function buildCommunityTabs(
  communityId: string,
  options: BuildCommunityTabsOptions,
): CommunityTab[] {
  const { isLead, moderationEnabled } = options;

  return TAB_DEFINITIONS.filter((tab) => {
    if (tab.id === 'moderation') {
      return moderationEnabled && isLead;
    }
    return true;
  }).map((tab) => ({
    ...tab,
    href: `/c/${communityId}/${tab.id === 'merit-history' ? 'merit-history' : tab.id}`,
  }));
}

export function getPrimaryTabs(tabs: CommunityTab[]): CommunityTab[] {
  return tabs.filter((tab) => tab.placement === 'primary');
}

export function getMoreTabs(tabs: CommunityTab[]): CommunityTab[] {
  return tabs.filter((tab) => tab.placement === 'more');
}

export function isMoreTabActive(activeId: string): boolean {
  return MORE_TAB_IDS.has(activeId as CommunityTabId);
}
