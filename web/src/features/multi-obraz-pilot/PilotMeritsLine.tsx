'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

/** Shared quota/wallet explainer dialog (trigger lives in `PilotMinimalNav`). */
export function MeritsHintDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="border-[#334155] bg-[#1e293b] text-[#f1f5f9]">
        <DialogHeader>
          <DialogTitle>{t('meritsHintTitle')}</DialogTitle>
          <DialogDescription className="text-[#94a3b8]">{t('meritsHintBody')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-sm leading-relaxed text-[#cbd5e1]">
          <p>{t('meritsHintQuota')}</p>
          <p>{t('meritsHintWallet')}</p>
          <p>{t('meritsHintHowToEarn')}</p>
        </div>

        <div className="mt-4 flex justify-center">
          <Button
            asChild
            className="h-11 min-w-[220px] rounded-lg bg-[#A855F7] px-6 text-base font-semibold text-white hover:bg-[#9333ea]"
          >
            <Link href="/mining" onClick={() => onOpenChange(false)}>
              {tCommon('earnMerits')}
            </Link>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
