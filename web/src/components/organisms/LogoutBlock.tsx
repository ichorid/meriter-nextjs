'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { LogoutButton } from '@/components/LogoutButton';

export function LogoutBlock() {
    const t = useTranslations('common');

    return (
        <div className="space-y-3">
            <h2 className="text-base font-semibold text-brand-text-primary dark:text-base-content">
                {t('account')}
            </h2>
            <LogoutButton />
        </div>
    );
}
