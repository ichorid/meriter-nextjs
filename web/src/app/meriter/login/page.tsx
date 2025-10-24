'use client';

import Page from '@shared/components/page';
import { LoginForm } from '@/components/LoginForm';
import { useTranslations } from 'next-intl';

const PageMeriterLogin = () => {
    const t = useTranslations('login');
    
    return (
        <Page className="login">
            <div className="container mx-auto px-4 py-8">
                <div className="max-w-md mx-auto">
                    <div className="text-center mb-8">
                        <h1 className="text-3xl font-bold text-base-content mb-2">
                            {t('welcome')}
                        </h1>
                        <p className="text-base-content/70">
                            {t('subtitle')}
                        </p>
                    </div>
                    
                    <LoginForm />
                </div>
            </div>
        </Page>
    );
};

export default PageMeriterLogin;