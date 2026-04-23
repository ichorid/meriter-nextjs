'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { TicketStatusBadge } from '@/components/molecules/TicketStatusBadge';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { Button } from '@/components/ui/shadcn/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { useCommentsByPublication, useCreateComment } from '@/hooks/api/useComments';
import { usePublication } from '@/hooks/api/usePublications';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { trpc } from '@/lib/trpc/client';
import { PilotThreadCommentRow } from '@/components/organisms/Project/PilotThreadCommentRow';
import { plainTextExcerpt } from '@/lib/utils/plain-text-excerpt';
import { useToastStore } from '@/shared/stores/toast.store';
import type { TicketStatus } from '@meriter/shared-types';

const COMMENT_PAGE_SIZE = 50;

export interface PilotTicketDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  publicationId: string;
  fallbackTitle?: string;
  fallbackContent: string;
  /** `ticket` (default): status badge and task chrome. `discussion`: discussion header only. */
  threadVariant?: 'ticket' | 'discussion';
  /** Required for `threadVariant` `ticket` (default). */
  ticketStatus?: TicketStatus;
}

export function PilotTicketDetailDialog({
  open,
  onOpenChange,
  projectId,
  publicationId,
  fallbackTitle,
  fallbackContent,
  threadVariant = 'ticket',
  ticketStatus,
}: PilotTicketDetailDialogProps) {
  const t = useTranslations('multiObraz');
  const tCommon = useTranslations('common');
  const utils = trpc.useUtils();
  const addToast = useToastStore((s) => s.addToast);
  const createComment = useCreateComment();
  const [commentBody, setCommentBody] = useState('');

  const pubId = open ? publicationId : '';
  const { data: publication, isLoading: pubLoading, isError: pubError } = usePublication(pubId);
  const { data: commentsPayload, isFetching: commentsLoading } = useCommentsByPublication(pubId, {
    page: 1,
    pageSize: COMMENT_PAGE_SIZE,
  });

  const commentsData = commentsPayload as
    | {
        data?: Array<{
          id: string;
          content?: string | null;
          authorId?: string;
          createdAt?: string;
          meta?: { author?: { name?: string; username?: string } | null };
        }>;
        total?: number;
      }
    | undefined;
  const comments = commentsData?.data ?? [];
  const totalComments = commentsData?.total ?? comments.length;

  const isDiscussion = threadVariant === 'discussion';
  const displayTitle =
    (publication as { title?: string } | undefined)?.title?.trim() ||
    fallbackTitle?.trim() ||
    (isDiscussion ? t('discussionUntitled') : t('pilotTicketUntitled'));

  const submitComment = () => {
    const body = commentBody.trim();
    if (!body) return;
    createComment.mutate(
      { targetType: 'publication', targetId: publicationId, content: body },
      {
        onSuccess: async () => {
          setCommentBody('');
          await utils.comments.getByPublicationId.invalidate({ publicationId });
          void utils.ticket.getByProject.invalidate({ projectId });
          addToast(t('pilotCommentSaved'), 'success');
        },
        onError: (err) => addToast(resolveApiErrorToastMessage(err.message), 'error'),
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[85vh] max-w-lg flex-col gap-0 overflow-hidden border-[#334155] bg-[#1e293b] p-0 text-[#f1f5f9] sm:max-w-lg"
        onCloseAutoFocus={() => setCommentBody('')}
      >
        <DialogHeader className="shrink-0 border-b border-[#334155] px-4 pb-4 pt-4 text-left sm:px-6">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
            {isDiscussion ? t('pilotDiscussionDetailDialogTitle') : t('pilotTicketDetailDialogTitle')}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {!isDiscussion && ticketStatus ? (
              <TicketStatusBadge status={ticketStatus} className="border-white/10 bg-white/10" />
            ) : null}
            <DialogTitle className="text-base font-semibold leading-snug tracking-tight text-white">
              {displayTitle}
            </DialogTitle>
          </div>
        </DialogHeader>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
          <div>
            {pubLoading ? (
              <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
            ) : publication ? (
              <PublicationContent publication={publication as never} hideTitle className="text-[#e2e8f0]" />
            ) : (
              <div className="space-y-1 text-sm text-[#e2e8f0]">
                {pubError ? (
                  <p className="text-xs text-[#94a3b8]">{t('pilotTicketPublicationLoadHint')}</p>
                ) : null}
                <p>{plainTextExcerpt(fallbackContent)}</p>
              </div>
            )}
          </div>

          <div className="mt-6 border-t border-[#334155] pt-4">
            <h3 className="mb-3 text-sm font-semibold text-[#f1f5f9]">{t('pilotTicketCommentsHeading')}</h3>
            {commentsLoading ? (
              <p className="text-sm text-[#94a3b8]">{tCommon('loading')}</p>
            ) : comments.length === 0 ? (
              <p className="text-sm text-[#94a3b8]">{t('noRepliesYet')}</p>
            ) : (
              <ul className="mb-3 space-y-2">
                {comments.map((c) => (
                  <PilotThreadCommentRow key={c.id} comment={c} />
                ))}
              </ul>
            )}
            {totalComments > COMMENT_PAGE_SIZE ? (
              <p className="mb-3 text-xs text-[#94a3b8]">{t('pilotTicketCommentsTruncated')}</p>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`pilot-ticket-comment-${publicationId}`}>{t('pilotCommentDialogLabel')}</Label>
              <Textarea
                id={`pilot-ticket-comment-${publicationId}`}
                value={commentBody}
                onChange={(e) => setCommentBody(e.target.value)}
                className="min-h-[100px] border-[#334155] bg-[#0f172a] text-[#f1f5f9]"
                maxLength={5000}
                placeholder={t('pilotCommentDialogPlaceholder')}
              />
              <Button
                type="button"
                className="bg-[#A855F7] text-white hover:bg-[#9333ea]"
                disabled={!commentBody.trim() || createComment.isPending}
                onClick={submitComment}
              >
                {createComment.isPending ? '…' : t('pilotCommentDialogSubmit')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
