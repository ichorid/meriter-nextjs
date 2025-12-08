'use client';

import React from 'react';
import { Copy, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { Invite } from '@/types/api-v1';

interface InviteListProps {
    invites: Invite[];
    isLoading?: boolean;
    onCopyInvite: (code: string) => void;
    inviteCopied?: boolean;
    getCommunityName: (communityId?: string) => string;
    formatDate: (dateString?: string) => string;
    isInviteExpired: (invite: Invite) => boolean;
    showHeader?: boolean;
}

export const InviteList: React.FC<InviteListProps> = ({
    invites,
    isLoading = false,
    onCopyInvite,
    inviteCopied = false,
    getCommunityName,
    formatDate,
    isInviteExpired,
    showHeader = true,
}) => {
    const t = useTranslations('profile.invites');
    const tCommon = useTranslations('common');

    if (isLoading) {
        return (
            <div className="flex justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            </div>
        );
    }

    if (invites.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            {showHeader && (
                <h3 className="font-medium text-brand-text-primary mb-2">
                    {t('generatedInvites')} ({invites.length})
                </h3>
            )}
            {invites.map((invite) => {
                const expired = isInviteExpired(invite);
                const used = invite.isUsed;

                return (
                    <div
                        key={invite.id}
                        className={`p-3 rounded-lg border ${
                            used
                                ? 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800'
                                : expired
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-base-100 border-brand-secondary/10'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-xs text-brand-text-secondary break-all">
                                        {invite.code}
                                    </span>
                                    {used && (
                                        <span className="px-2 py-0.5 text-xs bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded">
                                            {t('used')}
                                        </span>
                                    )}
                                    {!used && expired && (
                                        <span className="px-2 py-0.5 text-xs bg-yellow-200 dark:bg-yellow-800 text-yellow-700 dark:text-yellow-300 rounded">
                                            {t('expired')}
                                        </span>
                                    )}
                                    {!used && !expired && (
                                        <span className="px-2 py-0.5 text-xs bg-green-200 dark:bg-green-800 text-green-700 dark:text-green-300 rounded">
                                            {t('active')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-brand-text-secondary space-y-0.5">
                                    <div>
                                        <span className="font-medium">{t('type')}:</span>{' '}
                                        {invite.type === 'superadmin-to-lead'
                                            ? t('superadminToLead')
                                            : t('leadToParticipant')}
                                    </div>
                                    <div>
                                        <span className="font-medium">{t('community')}:</span>{' '}
                                        {getCommunityName(invite.communityId)}
                                    </div>
                                    <div>
                                            <span className="font-medium">{t('expires')}:</span>{' '}
                                        {formatDate(invite.expiresAt)}
                                    </div>
                                    {used && invite.usedAt && (
                                        <div>
                                            <span className="font-medium">{t('usedAt')}:</span>{' '}
                                            {formatDate(invite.usedAt)}
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!used && (
                                <button
                                    onClick={() => onCopyInvite(invite.code)}
                                    className="p-1.5 hover:bg-brand-secondary/10 rounded transition-colors flex-shrink-0"
                                    title={tCommon('copy')}
                                >
                                    {inviteCopied ? (
                                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-brand-text-secondary" />
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
