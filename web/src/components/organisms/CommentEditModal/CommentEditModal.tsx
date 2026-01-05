'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/shadcn/dialog';
import { Button } from '@/components/ui/shadcn/button';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommentEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (content: string) => Promise<void>;
  initialContent: string;
  isLoading?: boolean;
}

export const CommentEditModal: React.FC<CommentEditModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialContent,
  isLoading = false,
}) => {
  const t = useTranslations('comments');
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (isOpen) {
      setContent(initialContent);
    }
  }, [isOpen, initialContent]);

  const handleSave = async () => {
    if (!content.trim()) {
      return;
    }
    await onSave(content.trim());
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className={cn('max-w-lg')}>
        <DialogHeader>
          <DialogTitle>{t('editComment', { defaultValue: 'Edit Comment' })}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="label">
              <span className="label-text">{t('comment', { defaultValue: 'Comment' })}</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t('writeComment', { defaultValue: 'Write your comment...' })}
              className="textarea textarea-bordered w-full min-h-[120px] resize-none"
              rows={5}
              disabled={isLoading}
            />
          </div>
        </div>
        <DialogFooter className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
            className="rounded-xl active:scale-[0.98]"
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </Button>
          <Button
            variant="default"
            onClick={handleSave}
            disabled={isLoading || !content.trim()}
            className="rounded-xl active:scale-[0.98]"
          >
            {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('save', { defaultValue: 'Save' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

