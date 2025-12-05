'use client';

import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useTranslations } from 'next-intl';

const AboutPage = () => {
    const t = useTranslations('common');

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader title={t('about')} showBack={true} />

                <div className="p-4 space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-brand-text-primary dark:text-base-content">
                            About Meriter
                        </h2>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            Meriter is a platform designed to facilitate community engagement and merit-based recognition.
                            This application enables users to participate in communities, create publications, engage in discussions,
                            and recognize valuable contributions through a merit system.
                        </p>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            The platform supports various features including community management, publication creation,
                            comment threads, polling, and a wallet system for tracking merits and contributions.
                        </p>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            For more information about using Meriter, please refer to the community documentation
                            or contact your community administrator.
                        </p>
                    </div>

                    <div className="pt-6 border-t border-base-300">
                        <h3 className="text-lg font-semibold text-brand-text-primary dark:text-base-content mb-4">
                            Version Information
                        </h3>
                        <VersionDisplay className="justify-start" />
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default AboutPage;

