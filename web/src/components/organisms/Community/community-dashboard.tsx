'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { PieChart, Users } from 'lucide-react';
import { CooperativeSharesDisplay } from '@/components/molecules/CooperativeSharesDisplay';
import { CommunityWalletCard } from './CommunityWalletCard';
import { CommunityWalletPayoutDialog } from './CommunityWalletPayoutDialog';
import { Button } from '@/components/ui/shadcn/button';
import { routes } from '@/lib/constants/routes';
import { useCommunitySourceWallet } from '@/hooks/api/useCommunities';

const cardShell =
  'flex min-h-0 flex-col rounded-xl border border-base-300 bg-base-200/60 p-4 dark:border-base-content/10 dark:bg-base-200/40 md:h-full';

export interface CommunityDashboardProps {
  communityId: string;
  founderSharePercent: number;
  investorSharePercent: number;
  totalMembers: number;
  canPayout?: boolean;
  readOnly?: boolean;
}

function SharesMiniBar({ founder, investor }: { founder: number; investor: number }) {
  const other = Math.max(0, 100 - founder - investor);
  if (founder === 0 && investor === 0 && other === 0) {
    return null;
  }
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-base-300/80 dark:bg-white/10">
      {founder > 0 && (
        <div className="h-full shrink-0 bg-blue-500 transition-all" style={{ width: `${founder}%` }} />
      )}
      {investor > 0 && (
        <div className="h-full shrink-0 bg-amber-500 transition-all" style={{ width: `${investor}%` }} />
      )}
      {other > 0 && (
        <div className="h-full shrink-0 bg-base-content/20 transition-all" style={{ width: `${other}%` }} />
      )}
    </div>
  );
}

export function CommunityDashboard({
  communityId,
  founderSharePercent,
  investorSharePercent,
  totalMembers,
  canPayout = false,
  readOnly = false,
}: CommunityDashboardProps) {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('pages.communities');
  const [payoutOpen, setPayoutOpen] = useState(false);
  const { data: wallet } = useCommunitySourceWallet(communityId);
  const walletBalance = Math.floor(wallet?.balance ?? 0);

  return (
    <>
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={cardShell}>
            <CommunityWalletCard
              communityId={communityId}
              title={tCommunities('cardWallet')}
              footer={
                founderSharePercent > 0 || investorSharePercent > 0 ? (
                  <div className="text-xs text-base-content/60">
                    <CooperativeSharesDisplay
                      founderSharePercent={founderSharePercent}
                      investorSharePercent={investorSharePercent}
                    />
                  </div>
                ) : undefined
              }
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
            <Button
              variant="outline"
              size="sm"
              className="mt-auto h-9 min-h-9 w-full shrink-0 rounded-xl px-3 sm:w-auto"
              asChild
            >
              <Link href={routes.communityMembers(communityId)}>{tCommunities('viewTeamMembers')}</Link>
            </Button>
          </div>

          <div className={`${cardShell} gap-3`}>
            <div className="flex items-center gap-2 text-sm font-medium text-base-content">
              <PieChart className="h-5 w-5 shrink-0 text-base-content/70" aria-hidden />
              {tCommunities('cardShares')}
            </div>
            {(founderSharePercent > 0 || investorSharePercent > 0) && (
              <div className="text-sm text-base-content/70">
                <CooperativeSharesDisplay
                  founderSharePercent={founderSharePercent}
                  investorSharePercent={investorSharePercent}
                />
              </div>
            )}
            <div className="min-h-0 flex-1" aria-hidden />
            <SharesMiniBar founder={founderSharePercent} investor={investorSharePercent} />
            {canPayout && !readOnly && walletBalance >= 1 && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="mt-2 h-9 w-full shrink-0 rounded-xl"
                onClick={() => setPayoutOpen(true)}
              >
                {t('payoutMerits')}
              </Button>
            )}
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
