'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useTopUpWallet, useProject } from '@/hooks/api/useProjects';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useWalletBalance } from '@/hooks/api/useWallet';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { formatMerits } from '@/lib/utils/currency';
import { MeritsIntegerStepper } from '@/components/molecules/MeritsIntegerStepper/MeritsIntegerStepper';
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

interface TopUpWalletDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TopUpWalletDialog({ projectId, open, onOpenChange }: TopUpWalletDialogProps) {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const { user } = useAuth();
  const { data: projectPayload, isLoading: projectLoading } = useProject(open ? projectId : null);
  const project = projectPayload?.project;
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: globalBalRaw, isLoading: globalLoading } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const topUp = useTopUpWallet();

  const [amount, setAmount] = useState(10);

  const isProjectMember = useMemo(() => {
    if (!user) return false;
    const inRoles = userRoles.some(
      (r) =>
        r.communityId === projectId && (r.role === 'lead' || r.role === 'participant'),
    );
    const members = project?.members;
    const inMembersList = Array.isArray(members) && members.includes(user.id);
    return inRoles || inMembersList;
  }, [user, userRoles, projectId, project?.members]);

  const investingEnabled = project?.settings?.investingEnabled === true;
  const investorSharePercent = project?.investorSharePercent ?? 0;

  const globalFloor = Math.max(0, Math.floor(globalBalRaw ?? 0));
  const maxMerits = globalFloor;

  useEffect(() => {
    if (!open) return;
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
      { projectId, amount: num },
      {
        onSuccess: () => {
          onOpenChange(false);
          setAmount(Math.min(10, Math.max(1, maxMerits)));
        },
      },
    );
  };

  const descriptionBlocks = (() => {
    if (open && projectLoading) {
      return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
    }
    if (isProjectMember) {
      return (
        <p className="text-sm text-brand-text-primary whitespace-pre-line">
          {t('projectWalletTopUpDescMember')}
        </p>
      );
    }
    if (investingEnabled) {
      return (
        <div className="space-y-2 text-sm text-brand-text-primary">
          <p className="whitespace-pre-line">{t('projectWalletTopUpDescInvestmentP1')}</p>
          <p className="whitespace-pre-line">
            {t('projectWalletTopUpDescInvestmentP2', { percent: investorSharePercent })}
          </p>
          <p className="font-medium underline decoration-brand-primary/80 underline-offset-2 whitespace-pre-line">
            {t('projectWalletTopUpDescInvestmentP3')}
          </p>
        </div>
      );
    }
    return (
      <div className="space-y-2 text-sm text-brand-text-primary">
        <p className="whitespace-pre-line">{t('projectWalletTopUpDescDonationP1')}</p>
        <p className="font-medium underline decoration-brand-primary/80 underline-offset-2 whitespace-pre-line">
          {t('projectWalletTopUpDescDonationHighlight')}
        </p>
      </div>
    );
  })();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('projectWalletTopUpTitle')}</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-3 text-left text-brand-text-primary">{descriptionBlocks}</div>
          </DialogDescription>
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
                  {globalLoading ? '…' : formatMerits(Math.max(0, maxMerits - effectiveAmount))}
                </span>
              </div>
            </div>
            {maxMerits < 1 && !globalLoading ? (
              <p className="text-sm text-destructive">{tCommunities('walletTopUpInsufficientGlobal')}</p>
            ) : null}
            <div>
              <Label htmlFor="project-topup-amount">{tCommunities('topUpAmountMeritsLabel')}</Label>
              <div className="mt-2">
                <MeritsIntegerStepper
                  id="project-topup-amount"
                  value={clampAmount(amount)}
                  onChange={(n) => setAmount(n)}
                  min={1}
                  max={Math.max(1, maxMerits)}
                  disabled={
                    topUp.isPending || globalLoading || maxMerits < 1 || (open && projectLoading)
                  }
                  aria-label={tCommunities('topUpAmountMeritsLabel')}
                  decreaseAriaLabel={t('projectWalletTopUpStepperDecrease')}
                  increaseAriaLabel={t('projectWalletTopUpStepperIncrease')}
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
              disabled={topUp.isPending || globalLoading || maxMerits < 1 || (open && projectLoading)}
            >
              {topUp.isPending ? tCommunities('walletTopUpSubmitting') : t('projectWalletTopUpSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
