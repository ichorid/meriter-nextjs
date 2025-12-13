'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/atoms/Modal';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';

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
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('editComment', { defaultValue: 'Edit Comment' })}
      size="md"
    >
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

        <div className="flex justify-end gap-3 pt-4 border-t border-base-content/10">
          <BrandButton
            variant="outline"
            onClick={onClose}
            disabled={isLoading}
          >
            {t('cancel', { defaultValue: 'Cancel' })}
          </BrandButton>
          <BrandButton
            variant="primary"
            onClick={handleSave}
            isLoading={isLoading}
            disabled={!content.trim()}
          >
            {t('save', { defaultValue: 'Save' })}
          </BrandButton>
        </div>
      </div>
    </Modal>
  );
};

