'use client';

import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Sparkles } from 'lucide-react';
import { Input } from '@/components/ui/shadcn/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { Badge } from '@/components/ui/shadcn/badge';
import {
  MVP_COMMUNITY_DOCUMENT_SETTINGS,
  communityShowsDocumentsHub,
  type DocumentsMode,
} from '@/features/documents/lib/mvp-document-settings';
import { DocumentsSettingsLockedField } from '@/features/communities/components/DocumentsSettingsLockedField';
import type { CommunityWithComputedFields } from '@/types/api-v1';

interface CommunityDocumentsSettingsSectionProps {
  community: CommunityWithComputedFields;
  onSave: (data: { settings?: Record<string, unknown> }) => Promise<void>;
}

function resolveDocumentsMode(raw?: string): DocumentsMode {
  if (raw === 'off' || raw === 'visionOrDescriptionOnly' || raw === 'all') {
    return raw;
  }
  return MVP_COMMUNITY_DOCUMENT_SETTINGS.documentsMode;
}

export function CommunityDocumentsSettingsSection({
  community,
  onSave,
}: CommunityDocumentsSettingsSectionProps) {
  const t = useTranslations('pages.communitySettings');
  const migratedCreatorsRef = useRef(false);

  const settings = community.settings as
    | {
        documentsMode?: DocumentsMode;
        documentCreators?: 'admins' | 'members';
        documentVariantCost?: number | null;
        documentVotingDurationHours?: number;
        documentDefaultMode?: 'manual' | 'auto';
      }
    | undefined;

  const documentsMode = resolveDocumentsMode(settings?.documentsMode);
  const documentCreators =
    settings?.documentCreators === 'admins' ? 'admins' : 'members';
  const hubTileVisible = communityShowsDocumentsHub(documentsMode);
  const lockedTooltip = t('documentsMvpLockedTooltip');

  const displayVariantCost =
    settings?.documentVariantCost === null || settings?.documentVariantCost === undefined
      ? ''
      : String(settings?.documentVariantCost);
  const displayVotingHours = String(
    settings?.documentVotingDurationHours ??
      MVP_COMMUNITY_DOCUMENT_SETTINGS.documentVotingDurationHours,
  );
  const displayDefaultMode =
    settings?.documentDefaultMode === 'auto' ? 'auto' : 'manual';

  useEffect(() => {
    if (migratedCreatorsRef.current || documentCreators === 'members') {
      return;
    }
    migratedCreatorsRef.current = true;
    void onSave({
      settings: {
        documentCreators: MVP_COMMUNITY_DOCUMENT_SETTINGS.documentCreators,
      },
    });
  }, [documentCreators, onSave]);

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-none dark:bg-primary/10">
        <div className="flex gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden />
          <p className="text-sm leading-relaxed text-base-content/85">{t('documentsMvpBanner')}</p>
        </div>
      </div>

      <div className="rounded-lg bg-base-200 p-6 shadow-none">
        <h3 className="mb-2 text-lg font-semibold text-brand-text-primary">
          {t('documentsSection')}
        </h3>
        <p className="mb-6 text-sm text-brand-text-secondary">{t('documentsSectionHelp')}</p>

        <div className="space-y-6">
          <DocumentsSettingsLockedField
            label={t('documentsModeLabel')}
            tooltip={lockedTooltip}
          >
            <Select value={MVP_COMMUNITY_DOCUMENT_SETTINGS.documentsMode} disabled>
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
          </DocumentsSettingsLockedField>

          <DocumentsSettingsLockedField
            label={t('documentsHubTileLabel')}
            helperText={t('documentsHubTileHint')}
            tooltip={lockedTooltip}
          >
            <div className="flex h-11 max-w-md items-center gap-2 rounded-xl border border-input bg-muted/40 px-3">
              <Badge
                variant={hubTileVisible ? 'default' : 'outline'}
                className="rounded-md font-normal"
              >
                {hubTileVisible ? t('documentsHubTileOn') : t('documentsHubTileOff')}
              </Badge>
              <span className="text-xs text-base-content/55">{t('documentsHubTileDependsOnMode')}</span>
            </div>
          </DocumentsSettingsLockedField>

          <DocumentsSettingsLockedField
            label={t('documentCreatorsLabel')}
            tooltip={lockedTooltip}
          >
            <Select value={MVP_COMMUNITY_DOCUMENT_SETTINGS.documentCreators} disabled>
              <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="admins">{t('documentCreatorsAdmins')}</SelectItem>
                <SelectItem value="members">{t('documentCreatorsMembers')}</SelectItem>
              </SelectContent>
            </Select>
          </DocumentsSettingsLockedField>

          <DocumentsSettingsLockedField
            label={t('documentVariantCostLabel')}
            helperText={t('documentVariantCostHelp')}
            tooltip={lockedTooltip}
          >
            <Input
              type="number"
              min={0}
              className="h-11 max-w-md rounded-xl"
              value={displayVariantCost}
              disabled
              placeholder="1"
            />
          </DocumentsSettingsLockedField>

          <DocumentsSettingsLockedField
            label={t('documentVotingDurationLabel')}
            tooltip={lockedTooltip}
          >
            <Input
              type="number"
              min={1}
              className="h-11 max-w-md rounded-xl"
              value={displayVotingHours}
              disabled
            />
          </DocumentsSettingsLockedField>

          <DocumentsSettingsLockedField
            label={t('documentDefaultModeLabel')}
            tooltip={lockedTooltip}
          >
            <Select value={displayDefaultMode} disabled>
              <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">{t('documentDefaultModeManual')}</SelectItem>
                <SelectItem value="auto">{t('documentDefaultModeAuto')}</SelectItem>
              </SelectContent>
            </Select>
          </DocumentsSettingsLockedField>
        </div>
      </div>
    </div>
  );
}
