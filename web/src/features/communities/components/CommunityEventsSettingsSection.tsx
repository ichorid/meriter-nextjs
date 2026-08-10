'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
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

type EventCreationMode = 'admin' | 'members';

interface CommunityEventsSettingsSectionProps {
  community: CommunityWithComputedFields;
  onSave: (data: { settings: { eventCreation: EventCreationMode } }) => Promise<void>;
}

export function CommunityEventsSettingsSection({
  community,
  onSave,
}: CommunityEventsSettingsSectionProps) {
  const t = useTranslations('pages.communitySettings');
  const addToast = useToastStore((state) => state.addToast);

  const settings = community.settings as { eventCreation?: EventCreationMode } | undefined;
  const [eventCreation, setEventCreation] = useState<EventCreationMode>('admin');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setEventCreation(settings?.eventCreation === 'members' ? 'members' : 'admin');
  }, [settings?.eventCreation]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave({ settings: { eventCreation } });
      addToast(t('eventsSettingsSection.saveSuccess'), 'success');
    } catch {
      addToast(t('eventsSettingsSection.saveError'), 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-base-200 rounded-lg p-6 shadow-none">
        <h3 className="text-lg font-semibold text-brand-text-primary mb-2">
          {t('eventCreationSection')}
        </h3>
        <p className="text-sm text-brand-text-secondary mb-6">{t('eventCreationHelp')}</p>

        <BrandFormControl label={t('eventCreationLabel')}>
          <Select
            value={eventCreation}
            onValueChange={(v) => setEventCreation(v as EventCreationMode)}
            disabled={isSaving}
          >
            <SelectTrigger className="h-11 rounded-xl w-full max-w-md">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="admin">{t('eventCreationAdmin')}</SelectItem>
              <SelectItem value="members">{t('eventCreationMembers')}</SelectItem>
            </SelectContent>
          </Select>
        </BrandFormControl>
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
