'use client';

import React, { useState } from 'react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/shadcn/button';
import { Settings, FileText } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { CategoryManagement } from '@/components/settings/CategoryManagement';
import { AboutContent } from '@/components/organisms/About/AboutContent';
import { AboutAdminPanel } from '@/components/organisms/About/AboutAdminPanel';

const AboutPage = () => {
    const t = useTranslations('common');
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
                        О проекте
                    </h2>
                    {isSuperadmin && (
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowAboutAdmin(true)}
                                className="p-2 rounded-full"
                                aria-label="Manage About Content"
                                title="Управление контентом"
                            >
                                <FileText className="w-5 h-5 text-base-content/70" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowSettings(true)}
                                className="p-2 rounded-full"
                                aria-label="Settings"
                                title="Настройки"
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
                        Version Information
                    </h3>
                    <VersionDisplay className="justify-start" />
                </div>
            </div>

            {/* Superadmin About Admin Dialog */}
            {isSuperadmin && (
                <Dialog open={showAboutAdmin} onOpenChange={setShowAboutAdmin}>
                    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                        <DialogHeader>
                            <DialogTitle>Управление контентом "О платформе"</DialogTitle>
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
                        <div className="pt-4">
                            <CategoryManagement />
                        </div>
                    </DialogContent>
                </Dialog>
            )}
        </AdaptiveLayout>
    );
};

export default AboutPage;

