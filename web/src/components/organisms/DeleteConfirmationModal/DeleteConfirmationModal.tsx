'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DeleteConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  message?: string;
  itemType?: 'post' | 'poll' | 'comment';
  isLoading?: boolean;
}

export const DeleteConfirmationModal: React.FC<DeleteConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  itemType = 'post',
  isLoading = false,
}) => {
  const t = useTranslations('common');

  const defaultTitle = title || t('deleteConfirmation.title', { defaultValue: 'Confirm Delete' });
  const defaultMessage = message || t('deleteConfirmation.message', {
    defaultValue: `Are you sure you want to delete this ${itemType}? This action cannot be undone.`,
    itemType: itemType === 'post' ? 'post' : itemType === 'poll' ? 'poll' : 'comment',
  });

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{defaultTitle}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <AlertTriangle className="w-6 h-6 text-error" />
            </div>
            <p className="text-base-content/80">{defaultMessage}</p>
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.98]"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="default"
            onClick={handleConfirm}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.98] bg-error hover:bg-error/90 text-error-content"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('delete', { defaultValue: 'Delete' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

