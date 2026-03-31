'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useCommunity } from '@/hooks/api';
import { useForward, useRejectForward } from '@/hooks/api/usePublications';
import { resolveApiErrorToastMessage, toastUiText } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { useUserProfile } from '@/hooks/api/useUsers';

interface ReviewForwardPopupProps {
  publicationId: string;
  proposedBy: string;
  targetCommunityId: string;
  onClose: () => void;
}

export const ReviewForwardPopup: React.FC<ReviewForwardPopupProps> = ({
  publicationId,
  proposedBy,
  targetCommunityId,
  onClose,
}) => {
  const t = useTranslations('feed');
  const tCommon = useTranslations('common');
  const addToast = useToastStore((state) => state.addToast);
  const forward = useForward();
  const rejectForward = useRejectForward();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get proposer user info
  const { data: proposer } = useUserProfile(proposedBy);
  const proposerName = proposer?.displayName || proposer?.username || tCommon('someone');

  // Get target community info
  const { data: targetCommunity } = useCommunity(targetCommunityId);
  const targetCommunityName = targetCommunity?.name || targetCommunityId;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await forward.mutateAsync({
        publicationId,
        targetCommunityId,
      });
      addToast(toastUiText('forwardPostSuccess'), 'success');
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : undefined;
      addToast(resolveApiErrorToastMessage(msg), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await rejectForward.mutateAsync({
        publicationId,
      });
      addToast(toastUiText('forwardProposalRejected'), 'success');
      onClose();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : undefined;
      addToast(resolveApiErrorToastMessage(msg), 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl p-6 w-full max-w-md mx-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">{t('reviewForwardTitle')}</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('reviewForwardProposedBy')}</p>
            <p className="font-medium">{proposerName}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground mb-1">{t('reviewForwardTarget')}</p>
            <p className="font-medium">{targetCommunityName}</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={handleReject}
            disabled={isSubmitting}
            className="text-error hover:text-error"
          >
            {isSubmitting ? tCommon('processing') : tCommon('reject')}
          </Button>
          <Button onClick={handleConfirm} disabled={isSubmitting}>
            {isSubmitting ? tCommon('processing') : tCommon('confirm')}
          </Button>
        </div>
      </div>
    </div>
  );
};

