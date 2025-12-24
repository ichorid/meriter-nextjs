'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { _useInviteByCode, useInvite } from '@/hooks/api/useInvites';
import { LoadingState } from '@/components/atoms/LoadingState';
import { BrandFormControl } from '@/components/ui';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

interface InviteEntryFormProps {
    className?: string;
    inviteCode?: string; // Optional prop to override searchParams
}

export function InviteEntryForm({ _className = '', inviteCode: inviteCodeProp }: InviteEntryFormProps) {
    const router = useRouter();
    const searchParams = useSearchParams();
    const t = useTranslations('registration');
    const tCommon = useTranslations('common');

    const { logout, isLoading: authLoading } = useAuth();
    const addToast = useToastStore((state) => state.addToast);
    const [inviteCode, setInviteCode] = useState(inviteCodeProp || searchParams?.get('invite') || '');
    const [inviteError, setInviteError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const useInviteMutation = useInvite();

    const handleSubmit = async () => {
        // If no invite code provided, allow user to proceed without it
        if (!inviteCode.trim()) {
            router.push('/meriter/profile');
            return;
        }

        setInviteError('');
        setIsSubmitting(true);

        try {
            await useInviteMutation.mutateAsync(inviteCode.trim());
            addToast(t('success'), 'success');
            router.push('/meriter/profile');
        } catch {
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
            <div className="bg-base-100 rounded-xl shadow-md border border-base-300">
                <div className="p-6 border-b border-base-300">
                    <div className="flex justify-center">
                        <h2 className="text-2xl font-bold text-center">
                            {t('title')}
                        </h2>
                    </div>
                </div>

                <div className="p-6">
                    <div className="space-y-4">
                        <p className="text-sm text-base-content/70 text-center">
                            {t('inviteDescription')}
                        </p>

                        <BrandFormControl
                            label={t('inviteCodeLabel')}
                            error={inviteError}
                        >
                            <Input
                                value={inviteCode}
                                onChange={(e) => setInviteCode(e.target.value)}
                                placeholder={t('inviteCodePlaceholder')}
                                autoCapitalize="none"
                                autoComplete="off"
                                className="h-11 rounded-xl w-full"
                            />
                        </BrandFormControl>

                        {(isSubmitting || authLoading) && (
                            <div className="flex justify-center">
                                <LoadingState text={t('checkingInvite')} />
                            </div>
                        )}

                        <Button
                            onClick={handleSubmit}
                            disabled={isSubmitting || authLoading}
                            className="rounded-xl active:scale-[0.98] w-full"
                        >
                            {inviteCode.trim() ? t('continue') : tCommon('skip') || 'Skip'}
                        </Button>
                    </div>
                </div>

                <div className="p-6 border-t border-base-300">
                    <div className="flex justify-center w-full">
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={handleLogout}
                            className="rounded-xl active:scale-[0.98]"
                        >
                            {tCommon('logout')}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}