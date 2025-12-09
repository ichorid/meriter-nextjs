'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/atoms/Modal';
import { BrandButton } from '@/components/ui/BrandButton';
import { AlertTriangle } from 'lucide-react';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={defaultTitle}
      size="md"
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <AlertTriangle className="w-6 h-6 text-error" />
          </div>
          <p className="text-base-content/80">{defaultMessage}</p>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <BrandButton
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </BrandButton>
          <BrandButton
            variant="primary"
            onClick={handleConfirm}
            isLoading={isLoading}
            className="bg-error hover:bg-error/90 text-error-content"
          >
            {t('delete', { defaultValue: 'Delete' })}
          </BrandButton>
        </div>
      </div>
    </Modal>
  );
};

