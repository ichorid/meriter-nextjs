'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useTopUpCommunitySourceWallet } from '@/hooks/api/useCommunities';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { isLocalMembershipHubCommunity } from '@/lib/constants/birzha-source';
import { formatMerits } from '@/lib/utils/currency';
import { MeritsIntegerStepper } from '@/components/molecules/MeritsIntegerStepper/MeritsIntegerStepper';
import { useToastStore } from '@/shared/stores/toast.store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';

interface TopUpCommunityWalletDialogProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopUpCommunityWalletDialog({
  communityId,
  open,
  onOpenChange,
}: TopUpCommunityWalletDialogProps) {
  const router = useRouter();
  const t = useTranslations('projects');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const { user } = useAuth();
  const { data: community } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: globalBalRaw, isLoading: globalLoading } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const topUp = useTopUpCommunitySourceWallet();
  const addToast = useToastStore((s) => s.addToast);

  const [amount, setAmount] = useState(10);
  const [thanksOpen, setThanksOpen] = useState(false);

  const globalFloor = Math.max(0, Math.floor(globalBalRaw ?? 0));
  const maxMerits = globalFloor;

  const isCommunityMember = useMemo(
    () =>
      userRoles.some(
        (r) =>
          r.communityId === communityId && (r.role === 'lead' || r.role === 'participant'),
      ),
    [userRoles, communityId],
  );

  const canOfferJoin =
    Boolean(community && isLocalMembershipHubCommunity(community)) && !isCommunityMember;

  useEffect(() => {
    if (!open) return;
    setThanksOpen(false);
    const cap = maxMerits;
    if (cap >= 1) {
      setAmount((prev) => {
        const clamped = Math.max(1, Math.min(cap, prev));
        return clamped > cap ? Math.min(10, cap) : Math.max(1, Math.min(clamped, cap));
      });
    } else {
      setAmount(1);
    }
  }, [open, maxMerits]);

  const clampAmount = (n: number) => Math.max(1, Math.min(maxMerits, Math.floor(n)));

  const effectiveAmount = clampAmount(amount);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = clampAmount(amount);
    if (num < 1 || maxMerits < 1) return;
    topUp.mutate(
      { communityId, amount: num },
      {
        onSuccess: (data) => {
          onOpenChange(false);
          if (data.thankNonMember) {
            setThanksOpen(true);
          } else {
            setAmount(Math.min(10, Math.max(1, maxMerits)));
          }
        },
      },
    );
  };

  const closeThanks = () => {
    setThanksOpen(false);
    const cap = Math.max(0, Math.floor(globalBalRaw ?? 0));
    setAmount(cap >= 1 ? Math.min(10, cap) : 1);
  };

  const handleJoinClick = () => {
    addToast(tCommunities('walletTopUpJoinNavigateToast'), 'success');
    closeThanks();
    router.push(`/meriter/communities/${communityId}/join`);
  };

  const placeName = community?.name?.trim() || '';

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tCommunities('topUpCommunityWalletTitle')}</DialogTitle>
            <DialogDescription>{t('topUpWarning')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="grid gap-4 py-4">
              <div className="relative h-12 overflow-hidden rounded-lg border-2 border-base-300 bg-base-300 dark:border-base-400 dark:bg-base-200">
                {(() => {
                  const availableAfter = Math.max(0, maxMerits - effectiveAmount);
                  const fillPercent =
                    maxMerits > 0 ? Math.min(100, (availableAfter / maxMerits) * 100) : 0;
                  if (availableAfter > 0 && fillPercent > 0 && !globalLoading) {
                    return (
                      <div
                        className="absolute left-0 top-0 bottom-0 transition-all bg-[#153ED0] dark:bg-[#153ED0] opacity-60 dark:opacity-100"
                        style={{ width: `${fillPercent}%` }}
                      />
                    );
                  }
                  return null;
                })()}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="z-10 text-center text-xs font-medium text-base-content dark:text-base-content">
                    {tShared('available')}{' '}
                    {globalLoading
                      ? '…'
                      : formatMerits(Math.max(0, maxMerits - effectiveAmount))}
                  </span>
                </div>
              </div>
              {maxMerits < 1 && !globalLoading ? (
                <p className="text-sm text-destructive">{tCommunities('walletTopUpInsufficientGlobal')}</p>
              ) : null}
              <div>
                <Label htmlFor="community-topup-amount">{tCommunities('topUpAmountMeritsLabel')}</Label>
                <div className="mt-2">
                  <MeritsIntegerStepper
                    id="community-topup-amount"
                    value={clampAmount(amount)}
                    onChange={(n) => setAmount(n)}
                    min={1}
                    max={Math.max(1, maxMerits)}
                    disabled={topUp.isPending || globalLoading || maxMerits < 1}
                    aria-label={tCommunities('topUpAmountMeritsLabel')}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {tCommon('cancel')}
              </Button>
              <Button
                type="submit"
                disabled={topUp.isPending || globalLoading || maxMerits < 1}
              >
                {topUp.isPending ? tCommunities('walletTopUpSubmitting') : t('topUp')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={thanksOpen}
        onOpenChange={(next) => {
          if (!next) closeThanks();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{tCommunities('walletTopUpThanksTitle')}</DialogTitle>
            <DialogDescription className="text-left text-base text-brand-text-primary">
              {tCommunities('walletTopUpThanksBody', { communityName: placeName || '—' })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex-col gap-2 sm:flex-col sm:space-x-0">
            {canOfferJoin ? (
              <Button type="button" className="w-full" onClick={handleJoinClick}>
                {tCommunities('walletTopUpJoinCommunityCta')}
              </Button>
            ) : null}
            <Button type="button" variant="outline" className="w-full" onClick={closeThanks}>
              {tCommunities('walletTopUpNoThanks')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
