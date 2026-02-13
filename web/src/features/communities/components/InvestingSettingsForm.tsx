'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Switch } from '@/components/ui/shadcn/switch';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';
import type { CommunityWithComputedFields } from '@/types/api-v1';

interface InvestingSettingsFormProps {
  community: CommunityWithComputedFields;
  onSave: (settings: {
    settings?: {
      investingEnabled?: boolean;
      investorShareMin?: number;
      investorShareMax?: number;
    };
  }) => Promise<void>;
}

export const InvestingSettingsForm: React.FC<InvestingSettingsFormProps> = ({
  community,
  onSave,
}) => {
  const t = useTranslations('communities.investing');
  const addToast = useToastStore((state) => state.addToast);

  const currentSettings = community.settings || {};
  const [investingEnabled, setInvestingEnabled] = useState<boolean>(
    currentSettings.investingEnabled ?? false
  );
  const [investorShareMin, setInvestorShareMin] = useState<string>(
    String(currentSettings.investorShareMin ?? 1)
  );
  const [investorShareMax, setInvestorShareMax] = useState<string>(
    String(currentSettings.investorShareMax ?? 99)
  );

  const [isSaving, setIsSaving] = useState(false);
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const s = community.settings || {};
    setInvestingEnabled(s.investingEnabled ?? false);
    setInvestorShareMin(String(s.investorShareMin ?? 1));
    setInvestorShareMax(String(s.investorShareMax ?? 99));
  }, [community.settings]);

  const validate = (): boolean => {
    const errors: Record<string, string> = {};
    const minNum = parseInt(investorShareMin, 10);
    const maxNum = parseInt(investorShareMax, 10);
    if (isNaN(minNum) || minNum < 1 || minNum > 99) {
      errors.investorShareMin = t('validation.shareRange') || 'Must be between 1 and 99';
    }
    if (isNaN(maxNum) || maxNum < 1 || maxNum > 99) {
      errors.investorShareMax = t('validation.shareRange') || 'Must be between 1 and 99';
    }
    if (!errors.investorShareMin && !errors.investorShareMax && minNum > maxNum) {
      errors.investorShareMax = t('validation.minLessMax') || 'Min must be less than or equal to Max';
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
      await onSave({
        settings: {
          investingEnabled,
          investorShareMin: parseInt(investorShareMin, 10),
          investorShareMax: parseInt(investorShareMax, 10),
        },
      });
      addToast(t('saveSuccess') || 'Investing settings saved', 'success');
    } catch (error) {
      console.error('Failed to save investing settings:', error);
      addToast(t('saveError') || 'Failed to save investing settings', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-base-200 rounded-lg p-6 shadow-none">
        <h3 className="text-lg font-semibold text-brand-text-primary mb-4">
          {t('title') || 'Investing Settings'}
        </h3>
        <p className="text-sm text-brand-text-secondary mb-6">
          {t('description') ||
            'Allow post authors to enable merit investment. Investors receive a share of withdrawals.'}
        </p>

        <div className="space-y-6">
          <BrandFormControl
            label={t('fields.investingEnabled') || 'Enable investing'}
            helperText={
              t('fields.investingEnabledHelp') ||
              'Allow authors to enable investment on their posts'
            }
          >
            <div className="flex items-center gap-3">
              <Switch checked={investingEnabled} onCheckedChange={setInvestingEnabled} />
              <Label className="text-sm font-medium">
                {investingEnabled ? (t('fields.enabled') || 'Enabled') : (t('fields.disabled') || 'Disabled')}
              </Label>
            </div>
          </BrandFormControl>

          {investingEnabled && (
            <>
              <BrandFormControl
                label={t('fields.investorShareRange') || 'Investor share range (%)'}
                helperText={
                  t('fields.investorShareRangeHelp') ||
                  'Min and max allowed for post authors when setting investor share'
                }
                error={validationErrors.investorShareMin || validationErrors.investorShareMax}
              >
                <div className="flex items-center gap-4">
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={investorShareMin}
                    onChange={(e) => setInvestorShareMin(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-base-content/60">—</span>
                  <Input
                    type="number"
                    min={1}
                    max={99}
                    value={investorShareMax}
                    onChange={(e) => setInvestorShareMax(e.target.value)}
                    className="w-24"
                  />
                </div>
              </BrandFormControl>
            </>
          )}

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={isSaving} className="min-w-[120px]">
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
