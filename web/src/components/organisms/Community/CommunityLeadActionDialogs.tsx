'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';
import {
  usePromoteMemberToLead,
  useDemoteSelfFromLead,
} from '@/hooks/api/useCommunityMembers';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';

interface PromoteLeadDialogProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetUserId: string | null;
  targetName: string;
}

export function CommunityPromoteLeadDialog({
  communityId,
  open,
  onOpenChange,
  targetUserId,
  targetName,
}: PromoteLeadDialogProps) {
  const t = useTranslations('pages.communities.members.leadActions');
  const addToast = useToastStore((s) => s.addToast);
  const promote = usePromoteMemberToLead(communityId);

  const handleConfirm = () => {
    if (!targetUserId) return;
    promote.mutate(
      { communityId, userId: targetUserId },
      {
        onSuccess: () => {
          addToast(t('promoteSuccess'), 'success');
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          const raw = e instanceof Error ? e.message : String(e);
          addToast(resolveApiErrorToastMessage(raw), 'error');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('promoteDialogTitle')}</DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-1">
            <span className="block font-medium text-base-content">{targetName}</span>
            <span className="block text-sm leading-relaxed">{t('promoteDialogBody')}</span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={promote.isPending}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            className="gap-2"
            onClick={handleConfirm}
            disabled={promote.isPending || !targetUserId}
          >
            {promote.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            {t('promoteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface DemoteSelfLeadDialogProps {
  communityId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommunityDemoteSelfLeadDialog({
  communityId,
  open,
  onOpenChange,
}: DemoteSelfLeadDialogProps) {
  const t = useTranslations('pages.communities.members.leadActions');
  const addToast = useToastStore((s) => s.addToast);
  const demote = useDemoteSelfFromLead(communityId);

  const handleConfirm = () => {
    demote.mutate(
      { communityId },
      {
        onSuccess: () => {
          addToast(t('demoteSuccess'), 'success');
          onOpenChange(false);
        },
        onError: (e: unknown) => {
          const raw = e instanceof Error ? e.message : String(e);
          addToast(resolveApiErrorToastMessage(raw), 'error');
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('demoteDialogTitle')}</DialogTitle>
          <DialogDescription className="text-left text-sm leading-relaxed pt-1">
            {t('demoteDialogBody')}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={demote.isPending}>
            {t('cancel')}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="gap-2"
            onClick={handleConfirm}
            disabled={demote.isPending}
          >
            {demote.isPending ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : null}
            {t('demoteConfirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
