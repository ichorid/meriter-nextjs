'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { routes } from '@/lib/constants/routes';
import { Separator } from '@/components/ui/shadcn/separator';

export function FoldableInviteInput() {
  const router = useRouter();
  const t = useTranslations('settings');
  const tReg = useTranslations('registration');
  const [joinTeamExpanded, setJoinTeamExpanded] = useLocalStorage<boolean>('communities.joinTeamExpanded', true);

  const handleLeadsLinkClick = (e: React.MouseEvent) => {
    e.preventDefault();
    router.push(`${routes.communities}?scrollToLeads=true`);
  };

  const helperText = (
    <>
      {tReg('inviteCodeHelperText')}{' '}
      <Link 
        href={`${routes.communities}?scrollToLeads=true`}
        onClick={handleLeadsLinkClick}
        className="text-primary hover:underline font-medium"
      >
        {tReg('inviteCodeHelperLinkText')}
      </Link>
      .
    </>
  );

  return (
    <div className="bg-base-100 py-4 space-y-3">
      <button
        onClick={() => setJoinTeamExpanded(!joinTeamExpanded)}
        className="flex items-center justify-between w-full hover:opacity-80 transition-opacity"
      >
        <p className="text-xs font-medium text-base-content/40 uppercase tracking-wide">
          {t('inviteSection')}
        </p>
        {joinTeamExpanded ? (
          <ChevronUp className="w-4 h-4 text-base-content/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-base-content/40" />
        )}
      </button>
      {joinTeamExpanded && (
        <div className="animate-in fade-in duration-200 space-y-3">
          <p className="text-xs text-muted-foreground">
            {helperText}
          </p>
          <InviteInput hideLabel />
        </div>
      )}
    </div>
  );
}

