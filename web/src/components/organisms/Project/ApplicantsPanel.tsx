'use client';

import { useTranslations } from 'next-intl';
import { useGetApplicants, useApproveApplicant, useRejectApplicant } from '@/hooks/api/useTickets';
import { useUserProfile } from '@/hooks/api/useUsers';
import { Button } from '@/components/ui/shadcn/button';

interface ApplicantsPanelProps {
  ticketId: string;
}

function ApplicantRow({
  userId,
  ticketId,
  onApprove,
  onReject,
  isApproving,
  isRejecting,
}: {
  userId: string;
  ticketId: string;
  onApprove: (ticketId: string, applicantUserId: string) => void;
  onReject: (ticketId: string, applicantUserId: string) => void;
  isApproving: boolean;
  isRejecting: boolean;
}) {
  const { data: user } = useUserProfile(userId);
  const label = user?.displayName ?? user?.username ?? userId.slice(0, 8);
  const t = useTranslations('projects');

  return (
    <li className="flex items-center justify-between gap-2 rounded border p-2 text-sm">
      <span>{label}</span>
      <div className="flex gap-1">
        <Button
          size="sm"
          variant="default"
          onClick={() => onApprove(ticketId, userId)}
          disabled={isApproving || isRejecting}
        >
          {t('approve', { defaultValue: 'Approve' })}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => onReject(ticketId, userId)}
          disabled={isApproving || isRejecting}
        >
          {t('reject', { defaultValue: 'Reject' })}
        </Button>
      </div>
    </li>
  );
}

export function ApplicantsPanel({ ticketId }: ApplicantsPanelProps) {
  const t = useTranslations('projects');
  const { data: applicantIds = [], isLoading } = useGetApplicants(ticketId);
  const approve = useApproveApplicant();
  const reject = useRejectApplicant();

  if (isLoading) {
    return <p className="text-sm text-muted-foreground">{t('loadingApplicants', { defaultValue: 'Loading applicants…' })}</p>;
  }

  if (applicantIds.length === 0) {
    return <p className="text-sm text-muted-foreground">{t('noApplicants', { defaultValue: 'No applicants yet' })}</p>;
  }

  return (
    <div className="space-y-2">
      <span className="text-sm font-medium">{t('applicants', { defaultValue: 'Applicants' })}</span>
      <ul className="space-y-1">
        {applicantIds.map((userId: string) => (
          <ApplicantRow
            key={userId}
            userId={userId}
            ticketId={ticketId}
            onApprove={(tid, uid) => approve.mutate({ ticketId: tid, applicantUserId: uid })}
            onReject={(tid, uid) => reject.mutate({ ticketId: tid, applicantUserId: uid })}
            isApproving={approve.isPending}
            isRejecting={reject.isPending}
          />
        ))}
      </ul>
    </div>
  );
}
