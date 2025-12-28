'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';

export function FoldableInviteInput() {
  const t = useTranslations('settings');
  const [joinTeamExpanded, setJoinTeamExpanded] = useLocalStorage<boolean>('communities.joinTeamExpanded', true);

  return (
    <div className="space-y-3">
      <button
        onClick={() => setJoinTeamExpanded(!joinTeamExpanded)}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
      >
        <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
          {t('inviteSection')}
        </h2>
        {joinTeamExpanded ? (
          <ChevronUp className="w-5 h-5 text-brand-text-secondary" />
        ) : (
          <ChevronDown className="w-5 h-5 text-brand-text-secondary" />
        )}
      </button>
      {joinTeamExpanded && (
        <div className="animate-in fade-in duration-200">
          <InviteInput />
        </div>
      )}
    </div>
  );
}

