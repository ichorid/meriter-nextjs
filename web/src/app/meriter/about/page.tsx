'use client';

import React from 'react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useTranslations } from 'next-intl';

const AboutPage = () => {
    const t = useTranslations('common');

    return (
        <AdaptiveLayout
            stickyHeader={<SimpleStickyHeader title={t('aboutProject')} showBack={false} asStickyHeader={true} />}
        >
            <div className="space-y-6">
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-brand-text-primary dark:text-base-content">
                        About
                    </h2>
                    <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                        Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.
                        Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.
                        Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                    </p>
                    <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                        Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
                        Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium,
                        totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                    </p>
                    <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                        Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos
                        qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet,
                        consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
                    </p>
                </div>

                <div className="pt-6 border-t border-base-300">
                    <h3 className="text-lg font-semibold text-brand-text-primary dark:text-base-content mb-4">
                        Version Information
                    </h3>
                    <VersionDisplay className="justify-start" />
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default AboutPage;

