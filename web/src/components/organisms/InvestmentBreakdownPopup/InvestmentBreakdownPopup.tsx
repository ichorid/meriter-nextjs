'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc/client';
import { InvestorBar } from '@/shared/components/investor-bar';
import { routes } from '@/lib/constants/routes';

interface InvestmentBreakdownPopupProps {
  postId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function formatDate(d: Date | string): string {
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'short',
  }).format(date);
}

export function InvestmentBreakdownPopup({
  postId,
  open,
  onOpenChange,
}: InvestmentBreakdownPopupProps) {
  const t = useTranslations('investing');

  const { data: breakdown, isLoading } = trpc.investments.getInvestmentBreakdown.useQuery(
    { postId: postId ?? '' },
    { enabled: open && !!postId }
  );

  const segments = React.useMemo(() => {
    if (!breakdown?.investors) return [];
    return breakdown.investors.map((inv) => ({
      investorId: inv.userId,
      amount: inv.amount,
      sharePercent: inv.sharePercent,
    }));
  }, [breakdown?.investors]);

  const investorNames = React.useMemo(() => {
    if (!breakdown?.investors) return {};
    return Object.fromEntries(
      breakdown.investors.map((inv) => [inv.userId, inv.username])
    );
  }, [breakdown?.investors]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('breakdownTitle', { defaultValue: 'Investments' })}
            {breakdown != null && (
              <span className="ml-2 text-base font-normal text-base-content/70">
                {t('contractTerms', {
                  percent: breakdown.contractPercent,
                  defaultValue: 'Contract: {percent}% to investors',
                })}
              </span>
            )}
          </DialogTitle>
        </DialogHeader>

        {isLoading && !breakdown ? (
          <div className="py-8 flex items-center justify-center text-base-content/60">
            <Loader2 className="w-8 h-8 animate-spin" />
          </div>
        ) : breakdown ? (
          <div className="space-y-4">
            {/* Segmented bar */}
            <InvestorBar
              investments={segments}
              investmentPool={breakdown.poolBalance}
              investmentPoolTotal={breakdown.poolTotal}
              investorSharePercent={breakdown.contractPercent}
              investorNames={investorNames}
            />

            {/* List: name (link), amount, share %, dates */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-base-content/60 uppercase tracking-wide">
                {t('investorList', { defaultValue: 'Investors' })}
              </p>
              <ul className="space-y-2">
                {breakdown.investors.map((inv) => (
                  <li
                    key={inv.userId}
                    className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-base-300 last:border-0"
                  >
                    <div className="flex flex-col min-w-0">
                      <Link
                        href={routes.userProfile(inv.userId)}
                        className="text-sm font-medium text-primary hover:underline truncate"
                        onClick={() => onOpenChange(false)}
                      >
                        {inv.username}
                      </Link>
                      <span className="text-xs text-base-content/50">
                        {t('firstInvest', { defaultValue: 'First' })}: {formatDate(inv.firstInvestDate)}
                        {' · '}
                        {t('lastInvest', { defaultValue: 'Last' })}: {formatDate(inv.lastInvestDate)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-sm tabular-nums">
                      <span className="text-base-content/80">{inv.amount} merits</span>
                      <span className="text-base-content/60">{inv.sharePercent.toFixed(1)}%</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
