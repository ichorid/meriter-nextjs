'use client';

import { useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { useCommunitySourceWallet } from '@/hooks/api/useCommunities';
import { TopUpCommunityWalletDialog } from './TopUpCommunityWalletDialog';
import { Button } from '@/components/ui/shadcn/button';
import { Wallet } from 'lucide-react';

interface CommunityWalletCardProps {
  communityId: string;
  title?: string;
  footer?: ReactNode;
  /** Lead/superadmin: show payout under top-up when wallet has balance */
  canPayout?: boolean;
  readOnly?: boolean;
  onPayoutClick?: () => void;
}

export function CommunityWalletCard({
  communityId,
  title,
  footer,
  canPayout = false,
  readOnly = false,
  onPayoutClick,
}: CommunityWalletCardProps) {
  const tProjects = useTranslations('projects');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const { data: wallet, isLoading } = useCommunitySourceWallet(communityId);
  const [topUpOpen, setTopUpOpen] = useState(false);

  const balance = Math.floor(wallet?.balance ?? 0);
  const heading = title ?? tCommunities('cardWallet');
  const showPayout =
    Boolean(onPayoutClick) && canPayout && !readOnly && balance >= 1;

  return (
    <>
      <div className="flex h-full min-h-0 flex-col gap-3">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-base-content/70" aria-hidden />
          <span className="font-medium">{heading}</span>
        </div>
        {isLoading ? (
          <p className="text-sm text-base-content/60">...</p>
        ) : (
          <p className="text-2xl font-semibold tabular-nums text-base-content">
            {tCommon('meritsAmount', { amount: balance })}
          </p>
        )}
        {footer}
        <div className="mt-auto flex w-full shrink-0 flex-col gap-2">
          <Button
            size="sm"
            variant="outline"
            className="h-9 min-h-9 w-full rounded-xl px-3 sm:w-auto"
            onClick={() => setTopUpOpen(true)}
          >
            {tProjects('topUp')}
          </Button>
          {showPayout && (
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="h-9 min-h-9 w-full rounded-xl px-3 sm:w-auto"
              onClick={() => onPayoutClick?.()}
            >
              {tProjects('payoutMerits')}
            </Button>
          )}
        </div>
      </div>
      <TopUpCommunityWalletDialog
        communityId={communityId}
        open={topUpOpen}
        onOpenChange={setTopUpOpen}
      />
    </>
  );
}
