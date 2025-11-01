'use client';

import { LoginForm } from '@/components/LoginForm';
import { useTranslations } from 'next-intl';
import { VersionDisplay } from '@/components/organisms';

const PageMeriterLogin = () => {
    const t = useTranslations('login');
    
    return (
        <div className="min-h-screen flex items-center justify-center bg-base-100 px-4 py-8">
            <div className="w-full max-w-md">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-base-content mb-2">
                        {t('welcome')}
                    </h1>
                    <p className="text-base-content/70">
                        {t('subtitle')}
                    </p>
                </div>
                
                <LoginForm />
                
                <div className="mt-8 flex justify-center">
                    <VersionDisplay />
                </div>
            </div>
        </div>
    );
};

export default PageMeriterLogin;