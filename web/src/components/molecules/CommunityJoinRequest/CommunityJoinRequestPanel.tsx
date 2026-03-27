'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { useCommunity } from '@/hooks/api';
import {
  useTeamRequestStatus,
  useSubmitTeamRequest,
  useCancelMyTeamJoinRequest,
} from '@/hooks/api/useTeamRequests';
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

export type CommunityJoinRequestLayout = 'hero' | 'inline' | 'block' | 'compact';

interface CommunityJoinRequestPanelProps {
  communityId: string;
  layout: CommunityJoinRequestLayout;
  className?: string;
  /** Project pages: copy says "project"; membership also uses community.members / isAdmin. */
  entityKind?: 'community' | 'project';
}

export function CommunityJoinRequestPanel({
  communityId,
  layout,
  className,
  entityKind = 'community',
}: CommunityJoinRequestPanelProps) {
  const { user } = useAuth();
  const t = useTranslations('pages.communities.joinCommunity');
  const tProfile = useTranslations('profile');
  const { data: community } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: requestStatus } = useTeamRequestStatus(communityId);
  const { mutate: submitRequest, isPending } = useSubmitTeamRequest();
  const { mutate: cancelRequest, isPending: isCancelling } = useCancelMyTeamJoinRequest();
  const addToast = useToastStore((state) => state.addToast);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [note, setNote] = useState('');

  const allowsJoin = community ? isLocalMembershipHubCommunity(community) : false;
  const isRoleMember = userRoles.some(
    (role) =>
      role.communityId === communityId &&
      (role.role === 'lead' || role.role === 'participant'),
  );
  const isOnMembersList = Boolean(user && community?.members?.includes(user.id));
  // Do not treat platform/community admin flag as membership — superadmin may manage settings
  // without being a member; they should still be able to submit a join request.
  const isMember = isRoleMember || isOnMembersList;

  if (!allowsJoin || isMember || !user) {
    return null;
  }

  const hasPendingRequest = requestStatus?.status === 'pending';

  if (layout === 'compact' && !hasPendingRequest) {
    return null;
  }

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

  const handleCancel = () => {
    cancelRequest(
      { communityId },
      {
        onSuccess: () => {
          addToast(tProfile('joinTeam.requestCancelled'), 'success');
        },
        onError: (error: unknown) => {
          const raw = error instanceof Error ? error.message : undefined;
          addToast(
            raw?.trim() ? resolveApiErrorToastMessage(raw) : tProfile('joinTeam.requestCancelFailed'),
            'error',
          );
        },
      },
    );
  };

  const openDialog = () => {
    setDialogOpen(true);
  };

  const isProject = entityKind === 'project';
  const heroTitle = isProject ? t('heroTitleProject') : t('heroTitle');
  const heroSubtitle = isProject ? t('heroSubtitleProject') : t('heroSubtitle');
  const ctaOpen = isProject ? t('ctaOpenProject') : t('ctaOpen');
  const dialogTitle = isProject ? t('dialogTitleProject') : t('dialogTitle');
  const dialogDescription = isProject ? t('dialogDescriptionProject') : t('dialogDescription');

  const heroBtnClass =
    'h-8 min-h-8 px-3 text-xs font-medium sm:text-sm [&_svg]:size-3.5 sm:[&_svg]:size-4';

  const compactBtnClass =
    'h-9 min-h-9 w-full shrink-0 rounded-xl px-3 text-sm font-medium';

  const joinButton = (
    <Button
      type="button"
      variant={layout === 'hero' ? 'default' : 'outline'}
      size="sm"
      onClick={openDialog}
      disabled={isPending}
      className={cn(
        layout === 'hero' && cn('w-full sm:w-auto', heroBtnClass),
        layout === 'block' && 'w-full',
      )}
    >
      {isPending ? (
        <>
          <Loader2 className="mr-1.5 shrink-0 animate-spin" />
          {t('submitting')}
        </>
      ) : (
        ctaOpen
      )}
    </Button>
  );

  const cancelButtonCompact = (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleCancel}
      disabled={isCancelling}
      className={compactBtnClass}
    >
      {isCancelling ? (
        <>
          <Loader2 className="mr-1.5 shrink-0 animate-spin" />
          {t('cancelling')}
        </>
      ) : (
        t('cancelRequest')
      )}
    </Button>
  );

  const cancelButton = (
    <Button
      type="button"
      variant={layout === 'hero' ? 'default' : 'outline'}
      size="sm"
      onClick={handleCancel}
      disabled={isCancelling}
      className={cn(
        layout === 'hero' && cn('w-full sm:w-auto', heroBtnClass),
        layout === 'block' && 'w-full',
      )}
    >
      {isCancelling ? (
        <>
          <Loader2 className="mr-1.5 shrink-0 animate-spin" />
          {t('cancelling')}
        </>
      ) : (
        t('cancelRequest')
      )}
    </Button>
  );

  return (
    <>
      {layout === 'compact' ? (
        <div className={cn('w-full', className)}>{cancelButtonCompact}</div>
      ) : layout === 'hero' ? (
        <div
          className={cn(
            'flex min-w-0 justify-end translate-y-1 sm:translate-y-1.5',
            className,
          )}
        >
          {hasPendingRequest ? cancelButton : joinButton}
        </div>
      ) : layout === 'block' ? (
        <div className={cn('rounded-xl border border-base-300 bg-base-200/30 p-4', className)}>
          <p className="mb-1 text-sm font-medium text-brand-text-primary">{heroTitle}</p>
          <p className="mb-3 text-xs text-brand-text-secondary">{heroSubtitle}</p>
          {hasPendingRequest ? cancelButton : joinButton}
        </div>
      ) : (
        <div className={cn('flex items-center', className)}>
          {hasPendingRequest ? cancelButton : joinButton}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
            <DialogDescription>{dialogDescription}</DialogDescription>
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
