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
        return (
            <div className="text-sm text-base-content/50 text-center py-4">
                {t('noActiveInvites') || 'No active invites'}
            </div>
        );
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
                                ? 'bg-base-200/50 dark:bg-base-200/20 border-base-300 dark:border-base-700'
                                : expired
                                ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                                : 'bg-base-100 border-base-300 dark:border-base-700'
                        }`}
                    >
                        <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="font-mono text-sm font-semibold text-base-content break-all">
                                        {invite.code}
                                    </span>
                                    {used && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-base-200 dark:bg-base-800 text-base-content/70 dark:text-base-content/60 rounded">
                                            {t('used')}
                                        </span>
                                    )}
                                    {!used && expired && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded">
                                            {t('expired')}
                                        </span>
                                    )}
                                    {!used && !expired && (
                                        <span className="px-2 py-0.5 text-xs font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded">
                                            {t('active')}
                                        </span>
                                    )}
                                </div>
                                <div className="text-xs text-base-content/70 space-y-1 mt-2">
                                    <div>
                                        <span className="font-medium text-base-content/80">{t('type')}:</span>{' '}
                                        <span className="text-base-content/70">
                                            {invite.type === 'superadmin-to-lead'
                                                ? t('superadminToLead')
                                                : t('leadToParticipant')}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-base-content/80">{t('community')}:</span>{' '}
                                        <span className="text-base-content/70">
                                            {getCommunityName(invite.communityId)}
                                        </span>
                                    </div>
                                    <div>
                                        <span className="font-medium text-base-content/80">{t('expires')}:</span>{' '}
                                        <span className="text-base-content/70">
                                            {formatDate(invite.expiresAt)}
                                        </span>
                                    </div>
                                    {used && invite.usedAt && (
                                        <div>
                                            <span className="font-medium text-base-content/80">{t('usedAt')}:</span>{' '}
                                            <span className="text-base-content/70">
                                                {formatDate(invite.usedAt)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {!used && (
                                <button
                                    onClick={() => onCopyInvite(invite.code)}
                                    className="p-1.5 hover:bg-base-200 dark:hover:bg-base-800 rounded transition-colors flex-shrink-0"
                                    title={tCommon('copy')}
                                >
                                    {inviteCopied ? (
                                        <Check className="w-4 h-4 text-success" />
                                    ) : (
                                        <Copy className="w-4 h-4 text-base-content/50 hover:text-base-content/70" />
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
