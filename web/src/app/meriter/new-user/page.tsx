'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { useAuth } from '@/contexts/AuthContext';
import { useUpdateUser } from '@/hooks/api/useProfile';
import { UserForm, UserFormData } from '@/components/organisms/UserForm';
import { PageHeader } from '@/components/ui/PageHeader';
import { Loader2 } from 'lucide-react';
import { useToastStore } from '@/shared/stores/toast.store';

export default function NewUserPage() {
    const t = useTranslations('profile');
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
    const addToast = useToastStore((state) => state.addToast);

    const initialData: Partial<UserFormData> = useMemo(() => {
        if (!user) return {};
        return {
            displayName: user.displayName || '',
            avatarUrl: user.avatarUrl || '',
            bio: user.profile?.bio || '',
            location: {
                region: user.profile?.location?.region || '',
                city: user.profile?.location?.city || '',
            },
            website: user.profile?.website || '',
            values: user.profile?.values || '',
            about: user.profile?.about || '',
            contacts: {
                email: user.profile?.contacts?.email || '',
                other: user.profile?.contacts?.messenger || '',
            },
            educationalInstitution: user.profile?.educationalInstitution || '',
        };
    }, [user]);

    const handleSubmit = async (data: UserFormData) => {
        try {
            await updateUser({
                displayName: data.displayName,
                avatarUrl: data.avatarUrl,
                profile: {
                    bio: data.bio || null,
                    location: data.location ? {
                        region: data.location.region,
                        city: data.location.city,
                    } : null,
                    website: data.website || null,
                    values: data.values || null,
                    about: data.about || null,
                    contacts: {
                        email: data.contacts?.email || '',
                        messenger: data.contacts?.other || '',
                    },
                    educationalInstitution: data.educationalInstitution || null,
                },
            });

            addToast(t('saved'), 'success');
            router.push('/meriter/home');
        } catch (error: any) {
            addToast(error?.message || t('error'), 'error');
        }
    };

    if (authLoading) {
        return (
            <AdaptiveLayout>
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    if (!user) {
        router.push('/login');
        return null;
    }

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title={t('newUserTitle', { defaultMessage: 'New User Registration' })}
                    showBack={false}
                />

                <div className="p-4 space-y-6">
                    <div className="bg-brand-surface border border-brand-secondary/10 rounded-xl p-6">
                        <p className="mb-6 text-brand-text-secondary">
                            {t('newUserDescription', { defaultMessage: 'Please complete your profile to continue.' })}
                        </p>
                        <UserForm
                            initialData={initialData}
                            onSubmit={handleSubmit}
                            isSubmitting={isUpdating}
                            submitLabel={t('completeRegistration', { defaultMessage: 'Complete Registration' })}
                            showContacts={true}
                            showEducation={true}
                        />
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
}
