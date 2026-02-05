'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Switch } from '@/components/ui/shadcn/switch';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { CategorySelector } from '@/shared/components/category-selector';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import type { TappalkaSettings } from '@meriter/shared-types';
import type { CommunityWithComputedFields } from '@/types/api-v1';

interface TappalkaSettingsFormProps {
  community: CommunityWithComputedFields;
  onSave: (settings: { tappalkaSettings?: Partial<TappalkaSettings> }) => Promise<void>;
}

export const TappalkaSettingsForm: React.FC<TappalkaSettingsFormProps> = ({
  community,
  onSave,
}) => {
  const t = useTranslations('communities.tappalka');
  const addToast = useToastStore((state) => state.addToast);

  // Get current settings with defaults
  const currentSettings = useMemo(() => {
    return community.tappalkaSettings || {
      enabled: false,
      categories: [],
      winReward: 1,
      userReward: 1,
      comparisonsRequired: 10,
      showCost: 0.1,
      minRating: 1,
      onboardingText: undefined,
    };
  }, [community.tappalkaSettings]);

  // Form state
  const [enabled, setEnabled] = useState<boolean>(currentSettings.enabled);
  const [categories, setCategories] = useState<string[]>(currentSettings.categories || []);
  const [winReward, setWinReward] = useState<string>(String(currentSettings.winReward ?? 1));
  const [userReward, setUserReward] = useState<string>(String(currentSettings.userReward ?? 1));
  const [comparisonsRequired, setComparisonsRequired] = useState<string>(
    String(currentSettings.comparisonsRequired ?? 10)
  );
  const [showCost, setShowCost] = useState<string>(String(currentSettings.showCost ?? 0.1));
  const [minRating, setMinRating] = useState<string>(String(currentSettings.minRating ?? 1));
  const [onboardingText, setOnboardingText] = useState<string>(
    currentSettings.onboardingText || ''
  );

  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  // Update form when community changes
  useEffect(() => {
    const settings = community.tappalkaSettings || {
      enabled: false,
      categories: [],
      winReward: 1,
      userReward: 1,
      comparisonsRequired: 10,
      showCost: 0.1,
      minRating: 1,
      onboardingText: undefined,
    };

    setEnabled(settings.enabled);
    setCategories(settings.categories || []);
    setWinReward(String(settings.winReward ?? 1));
    setUserReward(String(settings.userReward ?? 1));
    setComparisonsRequired(String(settings.comparisonsRequired ?? 10));
    setShowCost(String(settings.showCost ?? 0.1));
    setMinRating(String(settings.minRating ?? 1));
    setOnboardingText(settings.onboardingText || '');
  }, [community.tappalkaSettings]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};

    const winRewardNum = parseFloat(winReward);
    if (isNaN(winRewardNum) || winRewardNum <= 0) {
      errors.winReward = t('validation.winRewardInvalid') || 'Win reward must be a positive number';
    }

    const userRewardNum = parseFloat(userReward);
    if (isNaN(userRewardNum) || userRewardNum <= 0) {
      errors.userReward = t('validation.userRewardInvalid') || 'User reward must be a positive number';
    }

    const comparisonsRequiredNum = parseInt(comparisonsRequired, 10);
    if (isNaN(comparisonsRequiredNum) || comparisonsRequiredNum < 1) {
      errors.comparisonsRequired =
        t('validation.comparisonsRequiredInvalid') || 'Comparisons required must be at least 1';
    }

    const showCostNum = parseFloat(showCost);
    if (isNaN(showCostNum) || showCostNum < 0) {
      errors.showCost = t('validation.showCostInvalid') || 'Show cost must be a non-negative number';
    }

    const minRatingNum = parseFloat(minRating);
    if (isNaN(minRatingNum) || minRatingNum < 0) {
      errors.minRating = t('validation.minRatingInvalid') || 'Minimum rating must be a non-negative number';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) {
      addToast(t('validation.errors') || 'Please fix validation errors', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const settingsToSave: Partial<TappalkaSettings> = {
        enabled,
        categories,
        winReward: parseFloat(winReward),
        userReward: parseFloat(userReward),
        comparisonsRequired: parseInt(comparisonsRequired, 10),
        showCost: parseFloat(showCost),
        minRating: parseFloat(minRating),
        onboardingText: onboardingText.trim() || undefined,
      };

      await onSave({ tappalkaSettings: settingsToSave });
      addToast(t('saveSuccess') || 'Tappalka settings saved successfully', 'success');
    } catch (error) {
      console.error('Failed to save tappalka settings:', error);
      addToast(
        t('saveError') || 'Failed to save tappalka settings',
        'error'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-base-200 rounded-lg p-6 shadow-none">
        <h3 className="text-lg font-semibold text-brand-text-primary mb-4">
          {t('title') || 'Tappalka Settings'}
        </h3>
        <p className="text-sm text-brand-text-secondary mb-6">
          {t('description') ||
            'Configure the post comparison mechanic (Tappalka) for this community.'}
        </p>

        <div className="space-y-6">
          {/* Enabled Switch */}
          <BrandFormControl
            label={t('fields.enabled') || 'Enable Tappalka'}
            helperText={
              t('fields.enabledHelp') ||
              'Enable the post comparison mechanic for this community'
            }
          >
            <div className="flex items-center gap-3">
              <Switch checked={enabled} onCheckedChange={setEnabled} />
              <Label className="text-sm font-medium">
                {enabled ? (t('fields.enabledOn') || 'Enabled') : (t('fields.enabledOff') || 'Disabled')}
              </Label>
            </div>
          </BrandFormControl>

          {/* Categories */}
          <CategorySelector
            value={categories}
            onChange={setCategories}
            label={t('fields.categories') || 'Categories'}
            helperText={
              t('fields.categoriesHelp') ||
              'Select categories to include in Tappalka. Leave empty to include all categories.'
            }
          />

          {/* Win Reward */}
          <BrandFormControl
            label={t('fields.winReward') || 'Win Reward'}
            helperText={
              t('fields.winRewardHelp') ||
              'Merits awarded to the winning post (emission). Default: 1'
            }
            error={validationErrors.winReward}
          >
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={winReward}
              onChange={(e) => setWinReward(e.target.value)}
              className={validationErrors.winReward ? 'border-error' : ''}
            />
          </BrandFormControl>

          {/* User Reward */}
          <BrandFormControl
            label={t('fields.userReward') || 'User Reward'}
            helperText={
              t('fields.userRewardHelp') ||
              'Merits awarded to user for completing comparisons. Default: 1'
            }
            error={validationErrors.userReward}
          >
            <Input
              type="number"
              step="0.1"
              min="0.1"
              value={userReward}
              onChange={(e) => setUserReward(e.target.value)}
              className={validationErrors.userReward ? 'border-error' : ''}
            />
          </BrandFormControl>

          {/* Comparisons Required */}
          <BrandFormControl
            label={t('fields.comparisonsRequired') || 'Comparisons Required'}
            helperText={
              t('fields.comparisonsRequiredHelp') ||
              'Number of comparisons required to earn user reward. Default: 10'
            }
            error={validationErrors.comparisonsRequired}
          >
            <Input
              type="number"
              step="1"
              min="1"
              value={comparisonsRequired}
              onChange={(e) => setComparisonsRequired(e.target.value)}
              className={validationErrors.comparisonsRequired ? 'border-error' : ''}
            />
          </BrandFormControl>

          {/* Show Cost */}
          <BrandFormControl
            label={t('fields.showCost') || 'Show Cost'}
            helperText={
              t('fields.showCostHelp') ||
              'Cost per post show (deducted from both posts). Default: 0.1'
            }
            error={validationErrors.showCost}
          >
            <Input
              type="number"
              step="0.1"
              min="0"
              value={showCost}
              onChange={(e) => setShowCost(e.target.value)}
              className={validationErrors.showCost ? 'border-error' : ''}
            />
          </BrandFormControl>

          {/* Min Rating */}
          <BrandFormControl
            label={t('fields.minRating') || 'Minimum Rating'}
            helperText={
              t('fields.minRatingHelp') ||
              'Minimum post rating to participate in Tappalka. Default: 1'
            }
            error={validationErrors.minRating}
          >
            <Input
              type="number"
              step="0.1"
              min="0"
              value={minRating}
              onChange={(e) => setMinRating(e.target.value)}
              className={validationErrors.minRating ? 'border-error' : ''}
            />
          </BrandFormControl>

          {/* Onboarding Text */}
          <BrandFormControl
            label={t('fields.onboardingText') || 'Onboarding Text'}
            helperText={
              t('fields.onboardingTextHelp') ||
              'Custom text shown to users when they first open Tappalka. Leave empty to use default text.'
            }
          >
            <Textarea
              value={onboardingText}
              onChange={(e) => setOnboardingText(e.target.value)}
              placeholder={t('fields.onboardingTextPlaceholder') || 'Enter custom onboarding text...'}
              rows={4}
              className="resize-none"
            />
          </BrandFormControl>

          {/* Save Button */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="min-w-[120px]"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {t('saving') || 'Saving...'}
                </>
              ) : (
                t('save') || 'Save Settings'
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

