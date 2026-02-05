'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/shadcn/button';
import { useCommunity } from '@/hooks/api';
import { useTeamRequestStatus, useSubmitTeamRequest } from '@/hooks/api/useTeamRequests';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

interface JoinTeamButtonProps {
  communityId: string;
  communityName?: string;
}

export const JoinTeamButton: React.FC<JoinTeamButtonProps> = ({
  communityId,
  communityName,
}) => {
  const { user } = useAuth();
  const t = useTranslations('profile');
  const { data: community } = useCommunity(communityId);
  const { data: userRoles = [] } = useUserRoles(user?.id || '');
  const { data: requestStatus } = useTeamRequestStatus(communityId);
  const { mutate: submitRequest, isPending } = useSubmitTeamRequest();
  const addToast = useToastStore((state) => state.addToast);

  // Check if this is a team community
  const isTeam = community?.typeTag === 'team';

  // Check if user is already a member
  const isMember = userRoles.some(
    (role) => role.communityId === communityId && (role.role === 'lead' || role.role === 'participant')
  );

  // Don't show button if not a team, user is already a member, or user is not logged in
  if (!isTeam || isMember || !user) {
    return null;
  }

  const hasPendingRequest = requestStatus?.status === 'pending';

  const handleClick = () => {
    if (hasPendingRequest) {
      return;
    }

    submitRequest(
      { communityId },
      {
        onSuccess: () => {
          addToast(t('joinTeam.requestSubmitted'), 'success');
        },
        onError: (error: any) => {
          addToast(error.message || t('joinTeam.requestFailed'), 'error');
        },
      }
    );
  };

  return (
    <div className="flex items-center ml-auto">
      <Button
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={hasPendingRequest || isPending}
        className="text-xs"
        title={hasPendingRequest ? t('joinTeam.requestPendingTooltip') : undefined}
      >
        {isPending ? (
          <>
            <Loader2 className="w-3 h-3 mr-1 animate-spin" />
            {t('joinTeam.submitting')}
          </>
        ) : hasPendingRequest ? (
          t('joinTeam.requestPending')
        ) : (
          t('joinTeam.button')
        )}
      </Button>
    </div>
  );
};

