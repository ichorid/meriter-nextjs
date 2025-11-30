'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useInviteByCode, useInvite } from '@/hooks/api/useInvites';
import { LoadingState } from '@/components/atoms/LoadingState';
import { BrandButton, BrandInput, BrandFormControl } from '@/components/ui';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

interface InviteEntryFormProps {
    className?: string;
}

export function InviteEntryForm({ className = '' }: InviteEntryFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('registration');
    const tCommon = useTranslations('common');

    const { logout, isLoading: authLoading } = useAuth();
    const addToast = useToastStore((state) => state.addToast);
    const [inviteCode, setInviteCode] = useState(searchParams?.get('invite') || '');
    const [inviteError, setInviteError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const useInviteMutation = useInvite();

    const handleSubmit = async () => {
        if (!inviteCode.trim()) {
            const message = t('errors.inviteCodeRequired');
            setInviteError(message);
            addToast(message, 'warning');
            return;
        }

        setInviteError('');
        setIsSubmitting(true);

        try {
            await useInviteMutation.mutateAsync(inviteCode.trim());
            addToast(t('success'), 'success');
            router.push('/meriter/home');
        } catch (error: any) {
            console.error('Failed to use invite:', error);
            const errorMessage = extractErrorMessage(error, t('errors.invalidInviteCode'));
            setInviteError(errorMessage);
            addToast(errorMessage, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleLogout = async () => {
        await logout();
        router.push('/meriter/login');
    };

    return (
        <div className="w-full max-w-md mx-auto">
            <div className="bg-white rounded-xl shadow-md border border-gray-200">
                <div className="p-6 border-b border-gray-200">
                    <div className="flex justify-center">
                        <h2 className="text-2xl font-bold text-center">
                            {t('title')}
                        </h2>
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600 text-center">
                            {t('inviteDescription')}
                        </p>

                        <BrandFormControl
                            label={t('inviteCodeLabel')}
                            error={inviteError}
                        >
                            <BrandInput
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder={t('inviteCodePlaceholder')}
                                autoCapitalize="none"
                                autoComplete="off"
                            />
                        </BrandFormControl>

                        {(isSubmitting || authLoading) && (
                            <div className="flex justify-center">
                                <LoadingState text={t('checkingInvite')} />
                            </div>
                        )}

                        <BrandButton
                            onClick={handleSubmit}
                            disabled={!inviteCode.trim() || isSubmitting || authLoading}
                            fullWidth
                        >
                            {t('continue')}
                        </BrandButton>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200">
                    <div className="flex justify-center w-full">
                        <BrandButton
                            variant="link"
                            size="sm"
                            onClick={handleLogout}
                        >
                            {tCommon('logout')}
                        </BrandButton>
                    </div>
                </div>
            </div>
        </div>
    );
}
