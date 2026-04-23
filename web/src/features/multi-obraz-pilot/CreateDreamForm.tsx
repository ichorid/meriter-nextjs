'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Label } from '@/components/ui/shadcn/label';
import { ImageUploader } from '@/components/ui/ImageUploader/ImageUploader';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { trackPilotProductEvent } from '@/features/multi-obraz-pilot/pilot-telemetry';
import { pilotHomeHref } from '@/lib/constants/pilot-routes';

export function CreateDreamForm() {
  const t = useTranslations('multiObraz');
  const router = useRouter();
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState<string | undefined>(undefined);

  const create = trpc.project.create.useMutation({
    onSuccess: (project) => {
      void utils.project.getGlobalList.invalidate();
      void utils.project.list.invalidate();
      addToast(t('createSuccess'), 'success');
      trackPilotProductEvent('pilot_dream_created', {
        projectId: project.id,
        pilotContext: 'multi-obraz',
      });
      router.push(`/meriter/projects/${project.id}`);
    },
    onError: (err) => {
      addToast(resolveApiErrorToastMessage(err.message), 'error');
    },
  });

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const title = name.trim();
    const body = description.trim();
    if (!title || !body) {
      addToast(t('validationRequired'), 'error');
      return;
    }
    create.mutate({
      name: title,
      description: body,
      pilotContext: 'multi-obraz',
      ...(coverImageUrl?.trim() ? { coverImageUrl: coverImageUrl.trim() } : {}),
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5 rounded-xl border border-[#334155] bg-[#1e293b] p-5">
      <div className="space-y-2">
        <Label htmlFor="dream-title" className="text-[#f1f5f9]">
          {t('fieldTitle')}
        </Label>
        <Input
          id="dream-title"
          maxLength={200}
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="min-h-11 border-[#334155] bg-[#0f172a] text-[#f1f5f9]"
          autoComplete="off"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="dream-desc" className="text-[#f1f5f9]">
          {t('fieldDescription')}
        </Label>
        <Textarea
          id="dream-desc"
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={6}
          className="min-h-[132px] border-[#334155] bg-[#0f172a] text-[#f1f5f9]"
        />
      </div>
      <div className="space-y-2">
        <Label className="text-[#f1f5f9]">{t('fieldDreamImage')}</Label>
        <ImageUploader
          value={coverImageUrl}
          onUpload={(url) => setCoverImageUrl(url || undefined)}
          onRemove={() => setCoverImageUrl(undefined)}
          compact
          maxWidth={1920}
          maxHeight={1080}
          className="border-[#334155] bg-[#0f172a]"
          labels={{
            placeholder: t('dreamImagePlaceholder'),
            formats: t('dreamImageFormats'),
            maxSize: t('dreamImageMaxSize'),
            uploading: t('dreamImageUploading'),
            invalidType: t('dreamImageInvalidType'),
            tooLarge: t('dreamImageTooLarge'),
            uploadFailed: t('dreamImageUploadFailed'),
          }}
        />
      </div>
      <div className="flex flex-wrap gap-3 pt-1">
        <Button
          type="submit"
          disabled={create.isPending}
          className="min-h-11 min-w-[140px] rounded-lg bg-[#A855F7] text-white hover:bg-[#9333ea]"
        >
          {t('submit')}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="min-h-11 text-[#94a3b8]"
          onClick={() => router.push(pilotHomeHref())}
        >
          {t('cancel')}
        </Button>
      </div>
    </form>
  );
}
