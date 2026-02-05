'use client';

import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2, Check, X } from 'lucide-react';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useTranslations } from 'next-intl';
import type { TeamJoinRequest } from '@/hooks/api/useTeamRequests';

interface TeamRequestCardProps {
  request: TeamJoinRequest;
  onApprove: (requestId: string) => void;
  onReject: (requestId: string) => void;
  isApproving?: boolean;
  isRejecting?: boolean;
}

export const TeamRequestCard: React.FC<TeamRequestCardProps> = ({
  request,
  onApprove,
  onReject,
  isApproving = false,
  isRejecting = false,
}) => {
  const t = useTranslations('pages.communities');
  const { data: user } = useUserProfile(request.userId);

  const displayName = user?.displayName || user?.username || 'Unknown User';
  const avatarUrl = user?.avatarUrl;

  return (
    <div className="bg-base-100 border border-base-300 rounded-lg p-3 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar className="w-10 h-10 text-sm flex-shrink-0">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={displayName} />
          )}
          <AvatarFallback userId={request.userId} className="font-medium uppercase">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-base-content truncate">
            {displayName}
          </p>
          {user?.username && (
            <p className="text-xs text-base-content/60 truncate">
              @{user.username}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onApprove(request.id)}
          disabled={isApproving || isRejecting}
          className="text-xs"
        >
          {isApproving ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {t('teamRequests.approving')}
            </>
          ) : (
            <>
              <Check className="w-3 h-3 mr-1" />
              {t('teamRequests.approve')}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReject(request.id)}
          disabled={isApproving || isRejecting}
          className="text-xs text-red-500 hover:text-red-600 hover:bg-red-50"
        >
          {isRejecting ? (
            <>
              <Loader2 className="w-3 h-3 mr-1 animate-spin" />
              {t('teamRequests.rejecting')}
            </>
          ) : (
            <>
              <X className="w-3 h-3 mr-1" />
              {t('teamRequests.reject')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

