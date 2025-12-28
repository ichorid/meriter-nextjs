'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useInvite } from '@/hooks/api/useInvites';
import { BrandFormControl } from '@/components/ui';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Loader2 } from 'lucide-react';
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
            const response = await useInviteMutation.mutateAsync({ code: inviteCode.trim() });
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
                    <Input
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
                        className="h-11 rounded-xl flex-1"
                    />
                    <Button
                        onClick={handleSubmit}
                        disabled={!inviteCode.trim() || useInviteMutation.isPending}
                        size="md"
                        className="rounded-xl active:scale-[0.98] px-6 shrink-0 whitespace-nowrap"
                    >
                        {useInviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        {useInviteMutation.isPending ? t('checkingInvite') : t('continue')}
                    </Button>
                </div>
            </BrandFormControl>
        </div>
    );
}



