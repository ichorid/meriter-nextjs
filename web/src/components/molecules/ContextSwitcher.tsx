'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useActingAsStore } from '@/stores/acting-as.store';
import { useLeadCommunities } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslations } from 'next-intl';

const SELF_VALUE = '__self__';

type LeadCommunity = {
  id: string;
  name?: string;
  isProject?: boolean;
  typeTag?: string;
};

function isLeadContextProject(c: LeadCommunity): boolean {
  return c.isProject === true || c.typeTag === 'project';
}

function sortByName(a: LeadCommunity, b: LeadCommunity): number {
  return (a.name ?? a.id).localeCompare(b.name ?? b.id, undefined, {
    sensitivity: 'base',
  });
}

/**
 * Dropdown to switch posting context: as self or as a community (for leads).
 * When a community is selected, publication.create and withdraw send actingAsCommunityId.
 */
export function ContextSwitcher() {
  const { user } = useAuth();
  const t = useTranslations('shared.contextSwitcher');
  const { actingAsCommunityId, setActingAs } = useActingAsStore();
  const { data: leadCommunitiesRaw = [] } = useLeadCommunities(user?.id ?? '');

  const leadCommunities = leadCommunitiesRaw as LeadCommunity[];

  const { projects, communities } = useMemo(() => {
    const projectsList: LeadCommunity[] = [];
    const communitiesList: LeadCommunity[] = [];
    for (const c of leadCommunities) {
      if (isLeadContextProject(c)) {
        projectsList.push(c);
      } else {
        communitiesList.push(c);
      }
    }
    projectsList.sort(sortByName);
    communitiesList.sort(sortByName);
    return { projects: projectsList, communities: communitiesList };
  }, [leadCommunities]);

  if (leadCommunities.length === 0) return null;

  return (
    <Select
      value={actingAsCommunityId ?? SELF_VALUE}
      onValueChange={(v) => setActingAs(v === SELF_VALUE ? null : v)}
    >
      <SelectTrigger className="w-[220px]" aria-label={t('ariaLabel')}>
        <SelectValue placeholder={t('postAsPlaceholder')} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={SELF_VALUE}>{t('asMyself')}</SelectItem>
        <SelectSeparator />
        {projects.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t('projects')}</SelectLabel>
            {projects.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {t('asEntity', { name: c.name ?? c.id })}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
        {projects.length > 0 && communities.length > 0 ? (
          <SelectSeparator />
        ) : null}
        {communities.length > 0 ? (
          <SelectGroup>
            <SelectLabel>{t('communities')}</SelectLabel>
            {communities.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {t('asEntity', { name: c.name ?? c.id })}
              </SelectItem>
            ))}
          </SelectGroup>
        ) : null}
      </SelectContent>
    </Select>
  );
}
