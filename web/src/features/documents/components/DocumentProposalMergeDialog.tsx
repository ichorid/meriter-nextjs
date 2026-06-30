'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';

type DocumentProposalMergeDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function DocumentProposalMergeDialog({
  open,
  onOpenChange,
}: DocumentProposalMergeDialogProps) {
  const t = useTranslations('pages.documents.gdocs');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('mergedIntoVotingTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">{t('mergedIntoVotingBody')}</p>
        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            {t('mergedIntoVotingOk')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
