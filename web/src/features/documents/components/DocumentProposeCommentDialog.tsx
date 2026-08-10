'use client';

import { useEffect, useState } from 'react';
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
import { Textarea } from '@/components/ui/shadcn/textarea';

const MAX_COMMENT_LENGTH = 500;

export type DocumentProposeCommentDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (comment: string | undefined) => void;
  isPending?: boolean;
};

export function DocumentProposeCommentDialog({
  open,
  onOpenChange,
  onConfirm,
  isPending = false,
}: DocumentProposeCommentDialogProps) {
  const tGdocs = useTranslations('pages.documents.gdocs');
  const [comment, setComment] = useState('');

  useEffect(() => {
    if (!open) {
      setComment('');
    }
  }, [open]);

  const trimmed = comment.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md rounded-xl border-stitch-border bg-stitch-surface">
        <DialogHeader>
          <DialogTitle>{tGdocs('proposeCommentDialogTitle')}</DialogTitle>
          <DialogDescription>{tGdocs('proposeCommentDialogDescription')}</DialogDescription>
        </DialogHeader>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value.slice(0, MAX_COMMENT_LENGTH))}
          placeholder={tGdocs('proposeCommentPlaceholder')}
          className="min-h-[88px] resize-y rounded-lg border-stitch-border bg-stitch-canvas text-sm"
          maxLength={MAX_COMMENT_LENGTH}
        />
        <p className="text-right text-[11px] text-base-content/45">
          {trimmed.length}/{MAX_COMMENT_LENGTH}
        </p>
        <DialogFooter>
          <Button
            type="button"
            className="rounded-lg"
            disabled={isPending}
            onClick={() => {
              onConfirm(trimmed.length > 0 ? trimmed : undefined);
            }}
          >
            {tGdocs('proposeCommentSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
