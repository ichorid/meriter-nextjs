'use client';

import React, { useState, useEffect } from 'react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Settings, FileText, Loader2, RotateCcw } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { PlatformDevDangerSection } from '@/components/settings/PlatformDevDangerSection';
import { AboutContent } from '@/components/organisms/About/AboutContent';
import { AboutAdminPanel } from '@/components/organisms/About/AboutAdminPanel';
import { useResetAboutToDemoData } from '@/hooks/api/useAbout';
import { resolveApiErrorToastMessage, toastUiText } from '@/lib/i18n/api-error-toast';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';
import { Switch } from '@/components/ui/shadcn/switch';

function WelcomeMeritsPlatformRow() {
  const t = useTranslations('settings');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.platformSettings.get.useQuery(undefined, { retry: false });
  const updateMutation = trpc.platformSettings.update.useMutation({
    onSuccess: () => {
      void utils.platformSettings.get.invalidate();
      addToast(toastUiText('aboutSaved'), 'success');
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });
  const [value, setValue] = useState<string>('0');
  useEffect(() => {
    if (data?.welcomeMeritsGlobal !== undefined) {
      setValue(String(data.welcomeMeritsGlobal));
    }
  }, [data?.welcomeMeritsGlobal]);
  const handleSave = () => {
    const n = parseInt(value, 10);
    if (Number.isNaN(n) || n < 0) {
      addToast(toastUiText('aboutInvalidNumber'), 'error');
      return;
    }
    updateMutation.mutate({ welcomeMeritsGlobal: n });
  };
  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-base-content/60">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <Label htmlFor="welcome-merits-global">{t('welcomeMeritsGlobal')}</Label>
      <p className="text-xs text-base-content/60">{t('welcomeMeritsGlobalHelp')}</p>
      <div className="flex gap-2 items-center">
        <Input
          id="welcome-merits-global"
          type="number"
          min={0}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-24"
        />
        <Button
          size="sm"
          onClick={handleSave}
          disabled={updateMutation.isPending || Number.isNaN(parseInt(value, 10)) || parseInt(value, 10) < 0}
        >
          {updateMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            'Save'
          )}
        </Button>
      </div>
    </div>
  );
}

function mergeTagsDedupe(existing: string[], addition: string): string[] {
  const lower = new Set(existing.map((x) => x.toLowerCase()));
  const t = addition.trim();
  if (!t || lower.has(t.toLowerCase())) return existing;
  return [...existing, t].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
}

function FutureVisionRubricatorRow() {
  const t = useTranslations('settings');
  const tRv = useTranslations('valuesRubricator');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.platformSettings.get.useQuery(undefined, { retry: false });
  const threshold = data?.popularValueTagsThreshold ?? 5;

  const { data: suggested = [], isLoading: suggestedLoading } =
    trpc.platformSettings.getSuggestedValueTags.useQuery(
      { threshold },
      { enabled: !isLoading && !!data, retry: false },
    );

  const updateMutation = trpc.platformSettings.updateFutureVisionTags.useMutation({
    onSuccess: () => {
      void utils.platformSettings.get.invalidate();
      void utils.platformSettings.getSuggestedValueTags.invalidate();
      addToast(toastUiText('aboutSaved'), 'success');
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const decreeMutation = trpc.platformSettings.updateDecree809Enabled.useMutation({
    onSuccess: () => {
      void utils.platformSettings.get.invalidate();
      addToast(toastUiText('aboutSaved'), 'success');
    },
    onError: (e) => addToast(resolveApiErrorToastMessage(e.message), 'error'),
  });

  const [localTags, setLocalTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    if (data?.availableFutureVisionTags) {
      setLocalTags(data.availableFutureVisionTags);
    } else {
      setLocalTags([]);
    }
  }, [data?.availableFutureVisionTags]);

  const handleAddTag = () => {
    const trimmed = newTag.trim();
    if (!trimmed) return;
    setLocalTags((prev) => mergeTagsDedupe(prev, trimmed));
    setNewTag('');
  };

  const handleRemoveTag = (tag: string) => {
    setLocalTags((prev) => prev.filter((x) => x !== tag));
  };

  const handleSave = () => {
    updateMutation.mutate({ tags: localTags });
  };

  const handleAddSuggested = (tag: string) => {
    const merged = mergeTagsDedupe(localTags, tag);
    if (merged.length === localTags.length) return;
    updateMutation.mutate({ tags: merged });
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-base-content/60">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Loading...</span>
      </div>
    );
  }

  const decreeTags = data?.decree809Tags ?? [];

  return (
    <div className="space-y-6 border-t border-base-300 pt-6">
      <div className="space-y-3">
        <div className="font-medium text-base-content">{tRv('decree809AdminTitle')}</div>
        <p className="text-xs text-base-content/60">{tRv('decree809AdminHelp')}</p>
        <div className="flex items-center gap-3">
          <Switch
            id="decree-809-enabled"
            checked={!!data?.decree809Enabled}
            disabled={decreeMutation.isPending}
            onCheckedChange={(enabled) => decreeMutation.mutate({ enabled })}
          />
          <Label htmlFor="decree-809-enabled" className="cursor-pointer">
            {data?.decree809Enabled ? tRv('decree809SwitchOn') : tRv('decree809SwitchOff')}
          </Label>
        </div>
        {decreeTags.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-base-content/80">{tRv('decree809PreviewLabel')}</summary>
            <ul className="mt-2 max-h-40 overflow-y-auto list-disc pl-5 text-base-content/70 space-y-0.5">
              {decreeTags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="space-y-2">
        <div className="font-medium text-base-content">{t('futureVisionRubricatorTitle')}</div>
        <Label htmlFor="future-vision-tags">{t('futureVisionRubricatorLabel')}</Label>
        <p className="text-xs text-base-content/60">{t('futureVisionRubricatorHelp')}</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {localTags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-base-300 text-sm"
            >
              {tag}
              <button
                type="button"
                onClick={() => handleRemoveTag(tag)}
                className="hover:text-error rounded p-0.5"
                aria-label={`Remove ${tag}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Input
            id="future-vision-tags"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddTag())}
            placeholder={t('futureVisionRubricatorPlaceholder')}
            className="w-40"
          />
          <Button type="button" size="sm" variant="outline" onClick={handleAddTag} disabled={!newTag.trim()}>
            {t('futureVisionRubricatorAdd')}
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <div className="font-medium text-base-content">{tRv('suggestedTitle')}</div>
        <p className="text-xs text-base-content/60">{tRv('suggestedHelp', { threshold })}</p>
        {suggestedLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-base-content/50" />
        ) : suggested.length === 0 ? (
          <p className="text-sm text-base-content/60">{tRv('suggestedEmpty')}</p>
        ) : (
          <ul className="space-y-2">
            {suggested.map((row) => (
              <li
                key={row.tag}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base-300 px-3 py-2"
              >
                <span className="text-sm">
                  <span className="font-medium">{row.tag}</span>{' '}
                  <span className="text-base-content/60">({tRv('suggestedCount', { count: row.count })})</span>
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  disabled={updateMutation.isPending}
                  onClick={() => handleAddSuggested(row.tag)}
                >
                  {tRv('suggestedAdd')}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function ResetAboutToDemoRow() {
  const t = useTranslations('about');
  const addToast = useToastStore((s) => s.addToast);
  const resetToDemo = useResetAboutToDemoData();

  const handleReset = () => {
    if (!confirm(t('resetConfirm'))) {
      return;
    }
    resetToDemo.mutate(undefined, {
      onSuccess: () => {
        addToast(t('resetSuccess'), 'success');
      },
      onError: (e) => {
        addToast(resolveApiErrorToastMessage(e.message), 'error');
      },
    });
  };

  return (
    <div className="space-y-2 border-t border-base-300 pt-6">
      <div className="flex items-center gap-2 text-base-content">
        <FileText className="w-4 h-4" />
        <span className="font-medium">{t('resetSectionTitle')}</span>
      </div>
      <p className="text-xs text-base-content/60">
        {t('resetDescription')}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleReset}
        disabled={resetToDemo.isPending}
      >
        {resetToDemo.isPending ? (
          <Loader2 className="w-4 h-4 animate-spin mr-2" />
        ) : (
          <RotateCcw className="w-4 h-4 mr-2" />
        )}
        {t('resetButton')}
      </Button>
    </div>
  );
}

const AboutPage = () => {
    const t = useTranslations('common');
    const tAbout = useTranslations('about');
    const tSettings = useTranslations('settings');
    const { user } = useAuth();
    const [showSettings, setShowSettings] = useState(false);
    const [showAboutAdmin, setShowAboutAdmin] = useState(false);
    
    const isSuperadmin = user?.globalRole === 'superadmin';

    return (
        <AdaptiveLayout>
            <div className="space-y-6">
                {/* Header with title and admin buttons */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-brand-text-primary dark:text-base-content">
                        {tAbout('pageTitle')}
                    </h2>
                    {isSuperadmin && (
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAboutAdmin(true)}
                                className="p-2 rounded-full"
                                aria-label={tAbout('manageContentAria')}
                                title={tAbout('manageContentTitle')}
                            >
                                <FileText className="w-5 h-5 text-base-content/70" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSettings(true)}
                                className="p-2 rounded-full"
                                aria-label={tAbout('settingsAria')}
                                title={tAbout('settingsTitle')}
                            >
                                <Settings className="w-5 h-5 text-base-content/70" />
                            </Button>
                        </div>
                    )}
                </div>

                {/* About Content */}
                <AboutContent />

                <div className="pt-6 border-t border-base-300">
                    <h3 className="text-lg font-semibold text-brand-text-primary dark:text-base-content mb-4">
                        {tAbout('versionInfo')}
                    </h3>
                    <VersionDisplay className="justify-start" />
                </div>
            </div>

            {/* Superadmin About Admin Dialog */}
            {isSuperadmin && (
                <Dialog open={showAboutAdmin} onOpenChange={setShowAboutAdmin}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{tAbout('adminDialogTitle')}</DialogTitle>
                        </DialogHeader>
                        <div className="pt-4">
                            <AboutAdminPanel />
                        </div>
                    </DialogContent>
                </Dialog>
            )}

            {/* Superadmin Settings Dialog */}
            {isSuperadmin && (
                <Dialog open={showSettings} onOpenChange={setShowSettings}>
                    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>{tSettings('platformTitle')}</DialogTitle>
                        </DialogHeader>
                        <div className="pt-4 space-y-6">
                            <WelcomeMeritsPlatformRow />
                            <CategoryManagement />
                            <FutureVisionRubricatorRow />
                            <PlatformDevDangerSection />
                            <ResetAboutToDemoRow />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </AdaptiveLayout>
    );
};

export default AboutPage;

