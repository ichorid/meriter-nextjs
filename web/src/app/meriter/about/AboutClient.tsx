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
import { AboutContent } from '@/components/organisms/About/AboutContent';
import { AboutAdminPanel } from '@/components/organisms/About/AboutAdminPanel';
import { useResetAboutToDemoData } from '@/hooks/api/useAbout';
import { trpc } from '@/lib/trpc/client';
import { useToastStore } from '@/shared/stores/toast.store';

function WelcomeMeritsPlatformRow() {
  const t = useTranslations('settings');
  const addToast = useToastStore((s) => s.addToast);
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.platformSettings.get.useQuery(undefined, { retry: false });
  const updateMutation = trpc.platformSettings.update.useMutation({
    onSuccess: () => {
      void utils.platformSettings.get.invalidate();
      addToast('Saved', 'success');
    },
    onError: (e) => addToast(e.message || 'Failed to save', 'error'),
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
      addToast('Enter a number >= 0', 'error');
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
        addToast(e.message || t('resetError'), 'error');
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
                            <ResetAboutToDemoRow />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </AdaptiveLayout>
    );
};

export default AboutPage;

