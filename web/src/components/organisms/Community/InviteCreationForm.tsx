'use client';

import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';
import { Copy, Check } from 'lucide-react';
import type { Invite, Community } from '@/types/api-v1';
import { useToastStore } from '@/shared/stores/toast.store';

interface InviteCreationFormProps {
    isSuperadmin: boolean;
    inviteType: 'superadmin-to-lead' | 'lead-to-participant';
    availableCommunities: Community[];
    selectedCommunityId?: string;
    onCommunityChange?: (communityId: string) => void;
    onCreateInvite: (data: {
        type: 'superadmin-to-lead' | 'lead-to-participant';
        communityId?: string;
        expiresAt?: string;
    }) => Promise<Invite>;
    isCreating: boolean;
    generatedInvite?: Invite | null;
    onInviteGenerated?: (invite: Invite) => void;
}

export const InviteCreationForm: React.FC<InviteCreationFormProps> = ({
    isSuperadmin,
    inviteType,
    availableCommunities,
    selectedCommunityId: initialCommunityId,
    onCommunityChange,
    onCreateInvite,
    isCreating,
    generatedInvite,
    onInviteGenerated,
}) => {
    const t = useTranslations('profile.invites');
    const tInvites = useTranslations('invites.create');
    const tCommon = useTranslations('common');
    const addToast = useToastStore((state) => state.addToast);

    const [inviteExpiresInDays, setInviteExpiresInDays] = useState<number | ''>(30);
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>(initialCommunityId || '');
    const [inviteCopied, setInviteCopied] = useState(false);

    const handleGenerateInvite = async () => {
        if (!isSuperadmin && !selectedCommunityId) {
            addToast(t('selectCommunity'), 'warning');
            return;
        }

        try {
            const expiresAt = inviteExpiresInDays && inviteExpiresInDays > 0
                ? new Date(Date.now() + inviteExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
                : undefined;

            const inviteData: any = {
                type: inviteType,
                ...(selectedCommunityId && { communityId: selectedCommunityId }),
                expiresAt,
            };

            const invite = await onCreateInvite(inviteData);
            setInviteCopied(false);
            setInviteExpiresInDays(30);
            if (onInviteGenerated) {
                onInviteGenerated(invite);
            }
            addToast(t('inviteGenerated'), 'success');
        } catch (error) {
            console.error('Failed to create invite:', error);
            addToast(t('inviteError'), 'error');
        }
    };

    const handleCopyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
        addToast(tCommon('copied'), 'success');
    };

    const handleCommunityChange = (value: string) => {
        setSelectedCommunityId(value);
        if (onCommunityChange) {
            onCommunityChange(value);
        }
    };

    return (
        <div className="space-y-4">
            {isSuperadmin && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 shadow-none dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        {tInvites('superadminToLeadDescription')}
                    </p>
                </div>
            )}

            {!isSuperadmin && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 shadow-none dark:border-blue-800 rounded-lg">
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                        {tInvites('leadToParticipantDescription')}
                    </p>
                </div>
            )}

            {!isSuperadmin && availableCommunities.length > 1 && (
                <BrandFormControl
                    label={t('selectCommunity')}
                >
                    <Select
                        value={selectedCommunityId}
                        onValueChange={handleCommunityChange}
                    >
                        <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {availableCommunities.map(c => (
                                <SelectItem key={c.id} value={c.id}>
                                    {c.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </BrandFormControl>
            )}

                {!isSuperadmin && availableCommunities.length === 1 && selectedCommunityId && (
                    <div className="text-sm text-brand-text-secondary">
                        {t('community')}: <span className="font-medium">{availableCommunities[0]?.name}</span>
                    </div>
                )}

            <BrandFormControl
                label={tInvites('expiresInDays')}
                helperText={tInvites('expiresInDaysHelp')}
            >
                <Input
                    type="number"
                    value={inviteExpiresInDays.toString()}
                    onChange={(e) => {
                        const num = parseInt(e.target.value, 10);
                        setInviteExpiresInDays(isNaN(num) ? '' : num);
                    }}
                    placeholder={tInvites('expiresInDaysPlaceholder') || '30'}
                    className="h-11 rounded-xl w-full"
                />
            </BrandFormControl>

            {generatedInvite && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 shadow-none dark:border-green-800 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                        <p className="font-bold text-green-800 dark:text-green-200">
                            {tInvites('inviteCode')}
                        </p>
                        <button
                            onClick={() => handleCopyInviteCode(generatedInvite.code)}
                            className="p-1 hover:bg-green-100 dark:hover:bg-green-900/40 rounded"
                            title={tCommon('copy')}
                        >
                            {inviteCopied ? (
                                <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                            ) : (
                                <Copy className="w-4 h-4 text-green-600 dark:text-green-400" />
                            )}
                        </button>
                    </div>
                    <p className="font-mono text-sm text-green-900 dark:text-green-100 break-all">
                        {generatedInvite.code}
                    </p>
                    {inviteCopied && (
                        <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                            {tCommon('copied')}
                        </p>
                    )}
                </div>
            )}

            <Button
                variant="default"
                onClick={handleGenerateInvite}
                disabled={(!isSuperadmin && !selectedCommunityId) || isCreating}
                className="rounded-xl active:scale-[0.98] w-full"
            >
                {isCreating && <Loader2 className="h-4 w-4 animate-spin" />}
                {isCreating ? tInvites('creating') : tInvites('create')}
            </Button>
        </div>
    );
};
