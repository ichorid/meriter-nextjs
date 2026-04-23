'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Users } from 'lucide-react';
import { CommunityWalletCard } from './CommunityWalletCard';
import { CommunityWalletPayoutDialog } from './CommunityWalletPayoutDialog';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { useCommunitySourceWallet } from '@/hooks/api/useCommunities';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';

const cardShell =
  'flex min-h-0 flex-col rounded-xl border border-base-300 bg-base-200/60 p-4 dark:border-base-content/10 dark:bg-base-200/40 md:h-full';

export interface CommunityDashboardProps {
  communityId: string;
  totalMembers: number;
  canPayout?: boolean;
  readOnly?: boolean;
  /** When true, show merit history entry (members only). */
  isCommunityMember?: boolean;
}

export function CommunityDashboard({
  communityId,
  totalMembers,
  canPayout = false,
  readOnly = false,
  isCommunityMember = false,
}: CommunityDashboardProps) {
  const tCommunities = useTranslations('pages.communities');
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { data: wallet } = useCommunitySourceWallet(communityId);
  const walletBalance = Math.floor(wallet?.balance ?? 0);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className={cardShell}>
            <CommunityWalletCard
              communityId={communityId}
              title={tCommunities('cardWallet')}
              canPayout={canPayout}
              readOnly={readOnly}
              onPayoutClick={canPayout ? () => setPayoutOpen(true) : undefined}
            />
          </div>

          <div className={`${cardShell} gap-3`}>
            <div className="flex items-center gap-2 text-sm font-medium text-base-content">
              <Users className="h-5 w-5 shrink-0 text-base-content/70" aria-hidden />
              {tCommunities('cardMembers')}
            </div>
            <p className="text-3xl font-semibold tabular-nums text-base-content">{totalMembers}</p>
            {totalMembers === 0 && (
              <p className="text-sm text-base-content/50">{tCommunities('teamNoMembersPreview')}</p>
            )}
            <div className="mt-auto flex w-full flex-col gap-2">
              <CommunityJoinRequestPanel communityId={communityId} layout="compact" />
              <div className="flex w-full flex-row flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 min-h-9 min-w-0 flex-1 shrink-0 rounded-xl px-3"
                  asChild
                >
                  <Link href={routes.communityMembers(communityId)}>{tCommunities('viewTeamMembers')}</Link>
                </Button>
                {isCommunityMember ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 min-h-9 min-w-0 flex-1 shrink-0 rounded-xl px-3"
                    asChild
                  >
                    <Link href={routes.communityMeritHistory(communityId)}>
                      {tCommunities('meritHistoryInCommunity')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
      {canPayout && !readOnly && (
        <CommunityWalletPayoutDialog
          communityId={communityId}
          open={payoutOpen}
          onOpenChange={setPayoutOpen}
          maxAmount={walletBalance}
        />
      )}
    </>
  );
}
