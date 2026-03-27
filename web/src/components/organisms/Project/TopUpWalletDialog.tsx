'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import {
  useTopUpWallet,
  useProject,
  useProjectInvestmentsList,
  type ProjectGetByIdPlaceholder,
} from '@/hooks/api/useProjects';
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
import type { Community } from '@meriter/shared-types';

interface TopUpWalletDialogProps {
  projectId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * When opening from a list/card that already fetched Community, pass it so the modal
   * is not blocked on project.getById while the tRPC batch is saturated.
   */
  placeholderProject?: Community;
  /**
   * Member opens the investor ledger flow (same UI as non-member investors).
   * Member wallet top-up uses the default (false).
   */
  investorFlow?: boolean;
}

export function TopUpWalletDialog({
  projectId,
  open,
  onOpenChange,
  placeholderProject,
  investorFlow = false,
}: TopUpWalletDialogProps) {
  const t = useTranslations('projects');
  const tInvesting = useTranslations('investing');
  const tCommunities = useTranslations('pages.communities');
  const tCommon = useTranslations('common');
  const tShared = useTranslations('shared');
  const { user } = useAuth();
  const myId = user?.id ?? null;
  const placeholderProjectPayload = useMemo((): ProjectGetByIdPlaceholder | undefined => {
    if (!placeholderProject) return undefined;
    return {
      project: placeholderProject,
      walletBalance: 0,
      parentCommunity: null,
      pendingParentLink: null,
    };
  }, [placeholderProject]);
  const { data: projectPayload, isLoading: projectQueryLoading } = useProject(open ? projectId : null, {
    placeholderProjectPayload,
  });
  const project = projectPayload?.project;
  /** No project shape yet and query still loading (placeholderData counts as data — avoids infinite "Loading") */
  const projectLoading = !project?.id && projectQueryLoading;
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: globalBalRaw, isLoading: globalLoading } = useWalletBalance(GLOBAL_COMMUNITY_ID);
  const { data: investments, isLoading: investmentsLoading } = useProjectInvestmentsList(
    projectId,
    { enabled: open && (project?.settings?.investingEnabled === true) },
  );
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
  const effectiveMemberTopUp = isProjectMember && !investorFlow;
  const effectiveInvestorUi = investingEnabled && (!isProjectMember || investorFlow);
  const investorSharePercent = project?.investorSharePercent ?? 0;

  const globalFloor = Math.max(0, Math.floor(globalBalRaw ?? 0));
  const maxMerits = globalFloor;

  const poolTotal = useMemo(
    () => (investments ?? []).reduce((s, r) => s + (r.amount ?? 0), 0),
    [investments],
  );
  const investorCount = investments?.length ?? 0;
  const myExistingAmount = useMemo(() => {
    if (!myId || !investments?.length) return 0;
    return investments.find((r) => r.userId === myId)?.amount ?? 0;
  }, [investments, myId]);

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

  const newPoolTotal = poolTotal + effectiveAmount;
  const myNewTotal = myExistingAmount + effectiveAmount;
  const mySharePercentAmongInvestors = useMemo(() => {
    if (newPoolTotal <= 0) return 0;
    return (myNewTotal / newPoolTotal) * 100;
  }, [myNewTotal, newPoolTotal]);

  const myCurrentSharePercent = useMemo(() => {
    if (poolTotal <= 0) return 0;
    return (myExistingAmount / poolTotal) * 100;
  }, [myExistingAmount, poolTotal]);

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

  const loadingInvestContext = projectLoading || (investingEnabled && investmentsLoading);
  const showInvestStyleBlock = investingEnabled && !loadingInvestContext;

  const dialogTitle = (() => {
    if (open && projectLoading) return t('projectWalletTopUpTitle');
    if (effectiveInvestorUi) {
      return t('projectInvestDialogTitle');
    }
    return t('projectWalletTopUpTitle');
  })();

  const headerDescription = (() => {
    if (open && projectLoading) {
      return <p className="text-sm text-base-content/60">{tCommon('loading')}</p>;
    }
    if (effectiveInvestorUi) {
      return null;
    }
    if (effectiveMemberTopUp) {
      return (
        <div className="space-y-3">
          <p className="text-sm text-brand-text-primary whitespace-pre-line">
            {t('projectMemberInvestContextWarning')}
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
            <p className="whitespace-pre-line text-sm text-base-content/80">
              {t('projectMemberTopUpDonationWarning')}
            </p>
          </div>
          {investingEnabled && showInvestStyleBlock ? (
            <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 p-3">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-warning" />
              <p className="whitespace-pre-line text-sm text-base-content/80">
                {t('projectWalletTopUpDescMember')}
              </p>
            </div>
          ) : null}
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

  const formDisabled =
    topUp.isPending || globalLoading || maxMerits < 1 || (open && projectLoading);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          {effectiveInvestorUi ? (
            <DialogDescription className="sr-only">{t('projectInvestDialogTitle')}</DialogDescription>
          ) : (
            <DialogDescription asChild>
              <div className="space-y-3 text-left text-brand-text-primary">{headerDescription}</div>
            </DialogDescription>
          )}
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="grid gap-4 py-4">
            {effectiveInvestorUi && (projectLoading || investmentsLoading) ? (
              <div className="flex justify-center py-8 text-base-content/60">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : null}

            {effectiveInvestorUi && showInvestStyleBlock ? (
              <div className="space-y-4">
                <p className="text-sm font-medium text-base-content/90">
                  {tInvesting('contractTerms', {
                    percent: investorSharePercent,
                    defaultValue: 'Contract: {percent}% to investors',
                  })}
                </p>
                <div className="text-sm text-base-content/70">
                  <span
                    className="inline-flex items-center gap-1.5 text-base-content/60"
                    title={tInvesting('totalInvestedTooltip', {
                      defaultValue: 'Total merits ever invested in this post by all investors.',
                    })}
                  >
                    {tInvesting('totalInvestedLabel', { defaultValue: 'Total invested' })}
                    <Info
                      className="w-4 h-4 text-base-content/50 shrink-0"
                      aria-hidden
                    />
                  </span>{' '}
                  {tInvesting('poolValueFromInvestors', {
                    amount: formatMerits(poolTotal),
                    count: investorCount,
                    defaultValue: '{amount} merits from {count} investor(s)',
                  })}
                </div>
              </div>
            ) : null}

            {investingEnabled && effectiveMemberTopUp && showInvestStyleBlock ? (
              <div className="space-y-2 rounded-lg border border-base-300 bg-base-200/40 p-3 text-sm">
                <p className="font-medium text-base-content/90">
                  {tInvesting('contractTerms', {
                    percent: investorSharePercent,
                    defaultValue: 'Contract: {percent}% to investors',
                  })}
                </p>
                <p className="text-base-content/70">
                  {tInvesting('poolValueFromInvestors', {
                    amount: formatMerits(poolTotal),
                    count: investorCount,
                    defaultValue: '{amount} merits from {count} investor(s)',
                  })}
                </p>
              </div>
            ) : null}

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
                  disabled={formDisabled}
                  aria-label={tCommunities('topUpAmountMeritsLabel')}
                  decreaseAriaLabel={t('projectWalletTopUpStepperDecrease')}
                  increaseAriaLabel={t('projectWalletTopUpStepperIncrease')}
                />
              </div>
            </div>

            {effectiveInvestorUi && effectiveAmount > 0 && showInvestStyleBlock ? (
              <div className="space-y-1">
                <p className="text-sm font-medium text-primary">
                  {tInvesting('yourShareProject', {
                    percent: mySharePercentAmongInvestors.toFixed(1),
                  })}
                </p>
                <p className="text-xs text-base-content/60 italic">
                  {tInvesting('yourShareFootnoteProject')}
                </p>
              </div>
            ) : null}

            {effectiveInvestorUi && myExistingAmount > 0 && showInvestStyleBlock ? (
              <div className="text-sm text-base-content/80 space-y-0.5">
                <p>
                  {tInvesting('repeatInvestmentCurrent', {
                    existing: myExistingAmount,
                    currentPercent: myCurrentSharePercent.toFixed(1),
                    defaultValue:
                      'You already invested: {existing} merits, share {currentPercent}%.',
                  })}
                </p>
                <p>
                  {tInvesting('repeatInvestmentAfter', {
                    total: myNewTotal,
                    percent: mySharePercentAmongInvestors.toFixed(1),
                    defaultValue: 'After this: {total} merits, share {percent}%.',
                  })}
                </p>
              </div>
            ) : null}

            {effectiveInvestorUi && showInvestStyleBlock ? (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/30">
                <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
                <p className="text-sm text-base-content/80 whitespace-pre-line">
                  {t('projectInvestWarningFull')}
                </p>
              </div>
            ) : null}

          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={formDisabled}>
              {topUp.isPending
                ? tCommunities('walletTopUpSubmitting')
                : effectiveInvestorUi
                  ? t('projectInvestSubmit')
                  : t('projectWalletTopUpSubmit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
