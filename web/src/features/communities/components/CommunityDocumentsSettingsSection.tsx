'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { useToastStore } from '@/shared/stores/toast.store';
import type { CommunityWithComputedFields } from '@/types/api-v1';

type DocumentsMode = 'off' | 'visionOrDescriptionOnly' | 'all';
type DocumentCreators = 'admins' | 'members';
type DocumentDefaultMode = 'manual' | 'auto';

interface CommunityDocumentsSettingsSectionProps {
  community: CommunityWithComputedFields;
  onSave: (data: { settings?: Record<string, unknown> }) => Promise<void>;
}

export function CommunityDocumentsSettingsSection({
  community,
  onSave,
}: CommunityDocumentsSettingsSectionProps) {
  const t = useTranslations('pages.communitySettings');
  const addToast = useToastStore((state) => state.addToast);

  const settings = community.settings as
    | {
        documentsMode?: DocumentsMode;
        documentCreators?: DocumentCreators;
        documentVariantCost?: number | null;
        documentVotingDurationHours?: number;
        documentDefaultMode?: DocumentDefaultMode;
      }
    | undefined;

  const [documentsMode, setDocumentsMode] = useState<DocumentsMode>(
    settings?.documentsMode ?? 'visionOrDescriptionOnly',
  );
  const [documentCreators, setDocumentCreators] = useState<DocumentCreators>(
    settings?.documentCreators === 'members' ? 'members' : 'admins',
  );
  const [documentVariantCost, setDocumentVariantCost] = useState('');
  const [documentVotingDurationHours, setDocumentVotingDurationHours] = useState('48');
  const [documentDefaultMode, setDocumentDefaultMode] = useState<DocumentDefaultMode>('manual');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const dm = settings?.documentsMode;
    setDocumentsMode(
      dm === 'off' || dm === 'visionOrDescriptionOnly' || dm === 'all'
        ? dm
        : 'visionOrDescriptionOnly',
    );
    setDocumentCreators(settings?.documentCreators === 'members' ? 'members' : 'admins');
    const dvc = settings?.documentVariantCost;
    setDocumentVariantCost(dvc === null || dvc === undefined ? '' : String(dvc));
    setDocumentVotingDurationHours(String(settings?.documentVotingDurationHours ?? 48));
    setDocumentDefaultMode(settings?.documentDefaultMode === 'auto' ? 'auto' : 'manual');
  }, [
    settings?.documentsMode,
    settings?.documentCreators,
    settings?.documentVariantCost,
    settings?.documentVotingDurationHours,
    settings?.documentDefaultMode,
  ]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({
        settings: {
          documentsMode,
          documentCreators,
          ...(documentsMode !== 'off'
            ? {
                documentVariantCost:
                  documentVariantCost.trim() === ''
                    ? null
                    : Math.max(0, parseInt(documentVariantCost, 10) || 0),
                documentVotingDurationHours: Math.max(
                  1,
                  parseInt(documentVotingDurationHours, 10) || 48,
                ),
                documentDefaultMode,
              }
            : {}),
        },
      });
      addToast(t('documentsSettingsSection.saveSuccess'), 'success');
    } catch {
      addToast(t('documentsSettingsSection.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-base-200 rounded-lg p-6 shadow-none">
        <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
          {t('documentsSection')}
        </h3>
        <p className="text-sm text-brand-text-secondary mb-6">{t('documentsSectionHelp')}</p>

        <div className="space-y-4">
          <BrandFormControl label={t('documentsModeLabel')}>
            <Select
              value={documentsMode}
              onValueChange={(v) => setDocumentsMode(v as DocumentsMode)}
              disabled={isSaving}
            >
              <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">{t('documentsModeOff')}</SelectItem>
                <SelectItem value="visionOrDescriptionOnly">
                  {t('documentsModeVisionOnly')}
                </SelectItem>
                <SelectItem value="all">{t('documentsModeAll')}</SelectItem>
              </SelectContent>
            </Select>
          </BrandFormControl>

          {documentsMode !== 'off' ? (
            <>
              <BrandFormControl label={t('documentCreatorsLabel')}>
                <Select
                  value={documentCreators}
                  onValueChange={(v) => setDocumentCreators(v as DocumentCreators)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admins">{t('documentCreatorsAdmins')}</SelectItem>
                    <SelectItem value="members">{t('documentCreatorsMembers')}</SelectItem>
                  </SelectContent>
                </Select>
              </BrandFormControl>
              <BrandFormControl
                label={t('documentVariantCostLabel')}
                helperText={t('documentVariantCostHelp')}
              >
                <Input
                  type="number"
                  min={0}
                  className="h-11 max-w-md rounded-xl"
                  value={documentVariantCost}
                  onChange={(e) => setDocumentVariantCost(e.target.value)}
                  disabled={isSaving}
                  placeholder="1"
                />
              </BrandFormControl>
              <BrandFormControl label={t('documentVotingDurationLabel')}>
                <Input
                  type="number"
                  min={1}
                  className="h-11 max-w-md rounded-xl"
                  value={documentVotingDurationHours}
                  onChange={(e) => setDocumentVotingDurationHours(e.target.value)}
                  disabled={isSaving}
                />
              </BrandFormControl>
              <BrandFormControl label={t('documentDefaultModeLabel')}>
                <Select
                  value={documentDefaultMode}
                  onValueChange={(v) => setDocumentDefaultMode(v as DocumentDefaultMode)}
                  disabled={isSaving}
                >
                  <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">{t('documentDefaultModeManual')}</SelectItem>
                    <SelectItem value="auto">{t('documentDefaultModeAuto')}</SelectItem>
                  </SelectContent>
                </Select>
              </BrandFormControl>
            </>
          ) : null}
        </div>
      </div>

      <div className="flex justify-end">
        <Button
          variant="default"
          size="lg"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl active:scale-[0.98]"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          {isSaving ? t('saving') : t('saveChanges')}
        </Button>
      </div>
    </div>
  );
}
