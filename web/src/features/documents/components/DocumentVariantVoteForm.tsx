'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { canUseWalletForVoting } from '@/components/organisms/VotingPopup/voting-utils';
import {
  MERIT_VOTE_UNIT,
  computeDocumentVariantVoteSplit,
} from '@/features/documents/lib/document-canvas-shared';
import { useDocumentCanvasFocusRequired } from '@/features/documents/context/DocumentCanvasFocusContext';

export interface DocumentVariantVoteFormProps {
  variantId: string;
  blockId: string;
  onSuccess?: () => void;
}

export function DocumentVariantVoteForm({ variantId, blockId, onSuccess }: DocumentVariantVoteFormProps) {
  const focus = useDocumentCanvasFocusRequired();
  const tCanvas = useTranslations('pages.documents.canvas');
  const [voteComment, setVoteComment] = useState('');
  const utils = trpc.useUtils();

  const {
    documentId,
    docAllowDownvotes,
    quotaRemaining,
    walletBalance,
    community,
    addToast,
    t,
  } = focus;

  const voteMutation = trpc.votes.createWithComment.useMutation({
    onSuccess: async () => {
      setVoteComment('');
      await utils.documents.getById.invalidate({ id: documentId });
      await utils.documentVariants.listByBlock.invalidate({ documentId, blockId });
      onSuccess?.();
    },
    onError: (err) => addToast(err.message, 'error'),
  });

  const submitVote = useCallback((direction: 'up' | 'down') => {
    if (!voteComment.trim()) {
      addToast(t('voteCommentRequired'), 'error');
      return;
    }
    const { quotaAmount, walletAmount } = computeDocumentVariantVoteSplit({
      meritAmount: MERIT_VOTE_UNIT,
      direction,
      quotaRemaining,
      community,
    });
    if (walletAmount > 0) {
      if (!canUseWalletForVoting(walletBalance, community) || walletBalance < walletAmount) {
        addToast(t('voteInsufficientWallet'), 'error');
        return;
      }
    }
    voteMutation.mutate({
      targetType: 'document-variant',
      targetId: variantId,
      quotaAmount,
      walletAmount,
      direction,
      comment: voteComment.trim(),
    });
  }, [
    voteComment,
    quotaRemaining,
    walletBalance,
    community,
    variantId,
    documentId,
    blockId,
    addToast,
    t,
    voteMutation,
  ]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault();
        submitVote('up');
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [submitVote]);

  return (
    <div className="space-y-2">
      <p className="text-[10px] text-base-content/40">{tCanvas('voteShortcut')}</p>
      <Textarea
        value={voteComment}
        onChange={(e) => setVoteComment(e.target.value)}
        placeholder={t('voteComment')}
        className="min-h-[72px] rounded-lg border-base-300 bg-base-100 text-sm"
        disabled={voteMutation.isPending}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          className="rounded-lg"
          disabled={voteMutation.isPending}
          onClick={() => submitVote('up')}
        >
          {t('voteUp')}
        </Button>
        {docAllowDownvotes ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={voteMutation.isPending}
            onClick={() => submitVote('down')}
          >
            {t('voteDown')}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
