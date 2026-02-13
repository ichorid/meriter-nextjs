'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import type { CommunityWithComputedFields } from '@/types/api-v1';

export type CommentMode = 'all' | 'neutralOnly' | 'weightedOnly';

interface CommentSettingsSectionProps {
  community: CommunityWithComputedFields;
  onSave: (data: { settings?: { commentMode?: CommentMode } }) => Promise<void>;
}

const COMMENT_MODES: CommentMode[] = ['all', 'neutralOnly', 'weightedOnly'];

export const CommentSettingsSection: React.FC<CommentSettingsSectionProps> = ({
  community,
  onSave,
}) => {
  const t = useTranslations('pages.communitySettings.commentsSection');
  const addToast = useToastStore((state) => state.addToast);

  const settings = community.settings as
    | { commentMode?: CommentMode; tappalkaOnlyMode?: boolean }
    | undefined;
  const initialMode: CommentMode =
    settings?.commentMode ??
    (settings?.tappalkaOnlyMode ? 'neutralOnly' : 'all');

  const [commentMode, setCommentMode] = useState<CommentMode>(initialMode);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const next =
      settings?.commentMode ??
      (settings?.tappalkaOnlyMode ? 'neutralOnly' : 'all');
    setCommentMode(next);
  }, [settings?.commentMode, settings?.tappalkaOnlyMode]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ settings: { commentMode } });
      addToast(t('saveSuccess'), 'success');
    } catch (error) {
      console.error('Failed to save comment settings:', error);
      addToast(t('saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-base-200 rounded-lg p-6 shadow-none">
        <h3 className="text-lg font-semibold text-brand-text-primary mb-4">
          {t('title')}
        </h3>
        <p className="text-sm text-brand-text-secondary mb-6">
          {t('description')}
        </p>

        <div className="space-y-4">
          {COMMENT_MODES.map((mode) => (
            <BrandFormControl
              key={mode}
              label={
                mode === 'all'
                  ? t('modeAll')
                  : mode === 'neutralOnly'
                    ? t('modeNeutralOnly')
                    : t('modeWeightedOnly')
              }
              helperText={
                mode === 'all'
                  ? t('modeAllHelp')
                  : mode === 'neutralOnly'
                    ? t('modeNeutralOnlyHelp')
                    : t('modeWeightedOnlyHelp')
              }
            >
              <div className="flex items-center gap-3">
                <input
                  type="radio"
                  id={`commentMode-${mode}`}
                  name="commentMode"
                  value={mode}
                  checked={commentMode === mode}
                  onChange={() => setCommentMode(mode)}
                  className="h-4 w-4 border-base-300 text-brand-primary focus:ring-brand-primary"
                />
                <Label
                  htmlFor={`commentMode-${mode}`}
                  className="text-sm font-medium cursor-pointer"
                >
                  {mode === 'all'
                    ? t('modeAll')
                    : mode === 'neutralOnly'
                      ? t('modeNeutralOnly')
                      : t('modeWeightedOnly')}
                </Label>
              </div>
            </BrandFormControl>
          ))}

          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('saving')}
                </>
              ) : (
                t('save')
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
