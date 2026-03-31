'use client';

import React from 'react';
import Link from 'next/link';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2, Check, X } from 'lucide-react';
import { useUserProfile } from '@/hooks/api/useUsers';
import { useTranslations } from 'next-intl';
import type { TeamJoinRequest } from '@/hooks/api/useTeamRequests';
import { routes } from '@/lib/constants/routes';

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
  const tCommon = useTranslations('common');
  const { data: user } = useUserProfile(request.userId);

  const displayName = user?.displayName || user?.username || tCommon('unknownUser');
  const avatarUrl = user?.avatarUrl;
  const note =
    typeof request.applicantMessage === 'string' ? request.applicantMessage.trim() : '';

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-base-300 bg-base-100 p-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 flex-1 gap-3">
        <Link
          href={routes.userProfile(request.userId)}
          title={t('teamRequests.openProfile')}
          className="shrink-0 self-start rounded-full ring-offset-2 ring-offset-base-100 hover:ring-2 hover:ring-primary/40"
        >
          <Avatar className="h-10 w-10 text-sm">
            {avatarUrl && <AvatarImage src={avatarUrl} alt={displayName} />}
            <AvatarFallback userId={request.userId} className="font-medium uppercase">
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={routes.userProfile(request.userId)}
            title={t('teamRequests.openProfile')}
            className="truncate text-sm font-medium text-primary hover:underline"
          >
            {displayName}
          </Link>
          {user?.username ? (
            <p className="truncate text-xs text-base-content/60">@{user.username}</p>
          ) : null}
          {note ? (
            <div className="mt-2 rounded-md bg-base-200/80 px-2 py-1.5 text-xs text-base-content/90">
              <p className="font-medium text-base-content/70">{t('teamRequests.applicantMessageLabel')}</p>
              <p className="mt-0.5 whitespace-pre-wrap break-words">{note}</p>
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex shrink-0 flex-row items-center gap-2 sm:flex-col sm:items-stretch">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onApprove(request.id)}
          disabled={isApproving || isRejecting}
          className="flex-1 text-xs sm:flex-none"
        >
          {isApproving ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t('teamRequests.approving')}
            </>
          ) : (
            <>
              <Check className="mr-1 h-3 w-3" />
              {t('teamRequests.approve')}
            </>
          )}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onReject(request.id)}
          disabled={isApproving || isRejecting}
          className="flex-1 text-xs text-red-500 hover:bg-red-50 hover:text-red-600 sm:flex-none"
        >
          {isRejecting ? (
            <>
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              {t('teamRequests.rejecting')}
            </>
          ) : (
            <>
              <X className="mr-1 h-3 w-3" />
              {t('teamRequests.reject')}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};
