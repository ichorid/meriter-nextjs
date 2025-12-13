'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useInvite } from '@/hooks/api/useInvites';
import { BrandButton, BrandInput, BrandFormControl } from '@/components/ui';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

interface InviteInputProps {
    className?: string;
    hideLabel?: boolean;
}

export function InviteInput({ className = '', hideLabel = false }: InviteInputProps) {
    const router = useRouter();
    const t = useTranslations('registration');
    const addToast = useToastStore((state) => state.addToast);
    const [inviteCode, setInviteCode] = useState('');
    const [inviteError, setInviteError] = useState('');

    const useInviteMutation = useInvite();

    const handleSubmit = async () => {
        if (!inviteCode.trim()) {
            const message = t('errors.inviteCodeRequired');
            setInviteError(message);
            addToast(message, 'warning');
            return;
        }

        setInviteError('');

        try {
            const response = await useInviteMutation.mutateAsync(inviteCode.trim());
            addToast(t('inviteUsedSuccess'), 'success');

            // Check for teamGroupId in response and redirect if present
            if ((response as any)?.teamGroupId) {
                router.push(`/meriter/communities/${(response as any).teamGroupId}/settings`);
                return;
            }

            // Clear the input on success
            setInviteCode('');
        } catch (error: any) {
            console.error('Failed to use invite:', error);
            const errorMessage = extractErrorMessage(
                error,
                t('errors.invalidInviteCode')
            );
            setInviteError(errorMessage);
            addToast(errorMessage, 'error');
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && inviteCode.trim() && !useInviteMutation.isPending) {
            handleSubmit();
        }
    };

    return (
        <div className={`space-y-3 ${className}`}>
            <BrandFormControl
                label={hideLabel ? undefined : t('inviteCodeLabel')}
                error={inviteError}
            >
                <div className="flex gap-2">
                    <BrandInput
                        value={inviteCode}
                        onChange={(e) => {
                            setInviteCode(e.target.value);
                            setInviteError('');
                        }}
                        onKeyPress={handleKeyPress}
                        placeholder={t('inviteCodePlaceholder')}
                        autoCapitalize="none"
                        autoComplete="off"
                        disabled={useInviteMutation.isPending}
                        className="flex-1"
                    />
                    <BrandButton
                        onClick={handleSubmit}
                        disabled={!inviteCode.trim() || useInviteMutation.isPending}
                        isLoading={useInviteMutation.isPending}
                        size="md"
                    >
                        {useInviteMutation.isPending ? t('checkingInvite') : t('continue')}
                    </BrandButton>
                </div>
            </BrandFormControl>
        </div>
    );
}



