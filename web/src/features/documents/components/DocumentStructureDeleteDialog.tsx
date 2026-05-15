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

export interface DocumentStructureDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export function DocumentStructureDeleteDialog({
  open,
  onOpenChange,
  onConfirm,
}: DocumentStructureDeleteDialogProps) {
  const t = useTranslations('pages.documents.structure');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t('confirmDeleteTitle')}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-base-content/70">{t('confirmDeleteOfficial')}</p>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="rounded-lg"
            onClick={() => onOpenChange(false)}
          >
            {t('confirmCancel')}
          </Button>
          <Button type="button" variant="destructive" className="rounded-lg" onClick={onConfirm}>
            {t('confirmProceed')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
