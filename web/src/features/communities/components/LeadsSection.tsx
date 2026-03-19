'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronDown, ChevronUp, Users } from 'lucide-react';
import { SearchInput } from '@/components/molecules/SearchInput';
import { LeadCard } from '@/components/molecules/LeadCard/LeadCard';
import { routes } from '@/lib/constants/routes';
import type { EnrichedLead } from '@/types/lead';
import { useTranslations } from 'next-intl';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { DismissibleHint } from '@/components/molecules/DismissibleHint/DismissibleHint';
import { useAllLeads } from '@/hooks/api/useUsers';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';

export interface LeadsSectionProps {
  /** When false, section is not rendered. Allows parent to hide the block without removing the module. */
  visible?: boolean;
}

/**
 * Leads list section for the communities page.
 * Can be toggled off via `visible={false}` (e.g. current UI does not show leads; keep for future use).
 */
export function LeadsSection({ visible = false }: LeadsSectionProps) {
  const router = useRouter();
  const t = useTranslations('common');
  const tSearch = useTranslations('search');
  const tAbout = useTranslations('about');
  const tCommunities = useTranslations('communities');

  const [leadsExpanded, setLeadsExpanded] = useLocalStorage<boolean>('communities.leadsExpanded', true);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: leadsData, isLoading: leadsLoading } = useAllLeads(
    { pageSize: 100 },
    { enabled: visible && leadsExpanded }
  );
  const leads = (leadsData?.data || []) as EnrichedLead[];

  const filteredLeads = useMemo(() => {
    if (!searchQuery.trim()) return leads;
    const query = searchQuery.toLowerCase();
    return leads.filter((lead) => {
      const displayName = (lead.displayName || '').toLowerCase();
      const username = (lead.username || '').toLowerCase();
      const bio = (lead.profile?.bio || '').toLowerCase();
      const teamNames = (lead.leadCommunities || []).map((team) => team.toLowerCase());
      const matchesTeamName = teamNames.some((teamName) => teamName.includes(query));
      return (
        displayName.includes(query) ||
        username.includes(query) ||
        bio.includes(query) ||
        matchesTeamName
      );
    });
  }, [leads, searchQuery]);

  if (!visible) return null;

  return (
    <div id="leads-section" className="bg-base-100 py-4 space-y-3">
      <button
        onClick={() => setLeadsExpanded(!leadsExpanded)}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
      >
        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
          {tCommunities('leads')}
        </p>
        {leadsExpanded ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>

      {leadsExpanded && (
        <div className="animate-in fade-in duration-200 space-y-4">
          <DismissibleHint storageKey="communities.leadsHelper">
            {tCommunities('leadsHelper')}
          </DismissibleHint>

          {leads.length > 0 && (
            <div>
              <SearchInput
                placeholder={tSearch('results.searchLeadsPlaceholder')}
                value={searchQuery}
                onSearch={setSearchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full"
              />
            </div>
          )}

          {leadsLoading ? (
            <div className="space-y-3">
              <CardSkeleton />
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredLeads.length > 0 ? (
            <div className="bg-base-100 rounded-lg shadow-none overflow-hidden">
              {filteredLeads.map((lead) => (
                <LeadCard
                  key={lead.id}
                  id={lead.id}
                  displayName={lead.displayName || lead.username || t('unknownUser')}
                  username={lead.username}
                  avatarUrl={lead.avatarUrl}
                  totalMerits={lead.totalMerits}
                  leadCommunities={lead.leadCommunities}
                  showRoleChip={false}
                  onClick={() => router.push(routes.userProfile(lead.id))}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-base-content/60">
              <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
              <p className="font-medium">
                {searchQuery ? tAbout('noLeadsMatchingSearch') : tAbout('noLeadsFound')}
              </p>
              <p className="text-sm mt-1">
                {searchQuery ? tAbout('tryDifferentSearchTerm') : tAbout('noLeadsAvailable')}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
