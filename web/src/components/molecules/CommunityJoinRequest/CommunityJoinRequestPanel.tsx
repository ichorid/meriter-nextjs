'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { useCommunity } from '@/hooks/api';
import { useTeamRequestStatus, useSubmitTeamRequest } from '@/hooks/api/useTeamRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { isLocalMembershipHubCommunity } from '@/lib/constants/birzha-source';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Label } from '@/components/ui/shadcn/label';
import { cn } from '@/lib/utils';

export type CommunityJoinRequestLayout = 'hero' | 'inline' | 'block';

interface CommunityJoinRequestPanelProps {
  communityId: string;
  layout: CommunityJoinRequestLayout;
  className?: string;
}

export function CommunityJoinRequestPanel({
  communityId,
  layout,
  className,
}: CommunityJoinRequestPanelProps) {
  const { user } = useAuth();
  const t = useTranslations('pages.communities.joinCommunity');
  const tProfile = useTranslations('profile');
  const { data: community } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: requestStatus } = useTeamRequestStatus(communityId);
  const { mutate: submitRequest, isPending } = useSubmitTeamRequest();
  const addToast = useToastStore((state) => state.addToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState('');

  const allowsJoin = community ? isLocalMembershipHubCommunity(community) : false;
  const isMember = userRoles.some(
    (role) =>
      role.communityId === communityId &&
      (role.role === 'lead' || role.role === 'participant'),
  );

  if (!allowsJoin || isMember || !user) {
    return null;
  }

  const hasPendingRequest = requestStatus?.status === 'pending';

  const handleSubmit = () => {
    const trimmed = note.trim().slice(0, 500);
    submitRequest(
      {
        communityId,
        applicantMessage: trimmed.length > 0 ? trimmed : undefined,
      },
      {
        onSuccess: () => {
          addToast(tProfile('joinTeam.requestSubmitted'), 'success');
          setDialogOpen(false);
          setNote('');
        },
        onError: (error: unknown) => {
          const raw = error instanceof Error ? error.message : undefined;
          addToast(
            raw?.trim() ? resolveApiErrorToastMessage(raw) : tProfile('joinTeam.requestFailed'),
            'error',
          );
        },
      },
    );
  };

  const openDialog = () => {
    if (hasPendingRequest) return;
    setDialogOpen(true);
  };

  const triggerButton = (
    <Button
      type="button"
      variant={layout === 'hero' ? 'default' : 'outline'}
      size={layout === 'hero' ? 'default' : 'sm'}
      onClick={openDialog}
      disabled={hasPendingRequest || isPending}
      className={cn(layout === 'hero' && 'w-full sm:w-auto', layout === 'block' && 'w-full')}
      title={hasPendingRequest ? tProfile('joinTeam.requestPendingTooltip') : undefined}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          {t('submitting')}
        </>
      ) : hasPendingRequest ? (
        t('pending')
      ) : (
        t('ctaOpen')
      )}
    </Button>
  );

  return (
    <>
      {layout === 'hero' ? (
        <div
          className={cn(
            'flex w-full min-w-0 flex-col gap-2 rounded-xl border border-base-300 bg-base-200/40 p-3 sm:max-w-md sm:items-end',
            className,
          )}
        >
          <div className="w-full text-left sm:text-right">
            <p className="text-sm font-medium text-brand-text-primary">{t('heroTitle')}</p>
            <p className="mt-0.5 text-xs text-brand-text-secondary">{t('heroSubtitle')}</p>
          </div>
          {triggerButton}
        </div>
      ) : layout === 'block' ? (
        <div className={cn('rounded-xl border border-base-300 bg-base-200/30 p-4', className)}>
          <p className="mb-1 text-sm font-medium text-brand-text-primary">{t('heroTitle')}</p>
          <p className="mb-3 text-xs text-brand-text-secondary">{t('heroSubtitle')}</p>
          {triggerButton}
        </div>
      ) : (
        <div className={cn('flex items-center', className)}>{triggerButton}</div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('dialogTitle')}</DialogTitle>
            <DialogDescription>{t('dialogDescription')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="join-request-note">{t('messageLabel')}</Label>
            <Textarea
              id="join-request-note"
              value={note}
              onChange={(e) => setNote(e.target.value.slice(0, 500))}
              placeholder={t('messagePlaceholder')}
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-base-content/50">{note.length}/500</p>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
              {t('cancel')}
            </Button>
            <Button type="button" onClick={handleSubmit} disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('submitting')}
                </>
              ) : (
                t('submit')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
