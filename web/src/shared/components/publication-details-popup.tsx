'use client';

import React from 'react';
import { BottomPortal } from '@/shared/components/bottom-portal';
import { useTranslations } from 'next-intl';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { CommunityAvatar } from './community-avatar';
import { formatDate } from '@/shared/lib/date';
import type { EditHistoryEntry } from '@/types/api-responses';

interface PublicationDetailsPopupProps {
    isOpen: boolean;
    onClose: () => void;
    authorName?: string;
    authorId?: string;
    authorAvatar?: string;
    communityName?: string;
    communityId?: string;
    communityAvatar?: string;
    beneficiaryName?: string;
    beneficiaryId?: string;
    beneficiaryAvatar?: string;
    createdAt?: string;
    editHistory?: EditHistoryEntry[];
}

export const PublicationDetailsPopup: React.FC<PublicationDetailsPopupProps> = ({
    isOpen,
    onClose,
    authorName,
    authorId,
    authorAvatar,
    communityName,
    communityId,
    communityAvatar,
    beneficiaryName,
    beneficiaryId,
    beneficiaryAvatar,
    createdAt,
    editHistory = [],
}) => {
    const t = useTranslations('publications');

    if (!isOpen) {
        return null;
    }

    const stopPropagation = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    };

    // Format timestamp
    const formattedTimestamp = createdAt 
        ? formatDate(createdAt, 'relative')
        : '';

    return (
        <BottomPortal>
            <div
                className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto"
                onClick={stopPropagation}
                onPointerDown={stopPropagation}
            >
                {/* Backdrop */}
                <div
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm"
                    onClick={handleBackdropClick}
                    onMouseDown={handleBackdropClick}
                    onPointerDown={handleBackdropClick}
                />
                {/* Popup Container */}
                <div
                    className="relative z-10 w-full max-w-md bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto"
                    onClick={stopPropagation}
                    onPointerDown={stopPropagation}
                >
                    <div className="p-6">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold">
                                {t('publicationDetails', { defaultValue: 'Publication Details' })}
                            </h3>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onClose();
                                }}
                                className="btn btn-sm btn-circle btn-ghost"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Author Information */}
                        {authorName && (
                            <div className="mb-4">
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-10 h-10">
                                      <AvatarImage src={authorAvatar} alt={authorName} />
                                      <AvatarFallback userId={authorId || authorName} className="font-medium text-sm">
                                        {authorName ? authorName.charAt(0).toUpperCase() : '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1">
                                        <div className="text-sm font-medium">{authorName}</div>
                                        {formattedTimestamp && (
                                            <div className="text-xs opacity-60">{formattedTimestamp}</div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Community Information */}
                        {communityName && (
                            <div className="mb-4">
                                <div className="flex items-center gap-3">
                                    <CommunityAvatar
                                        avatarUrl={communityAvatar}
                                        communityName={communityName}
                                        communityId={communityId}
                                        size={32}
                                    />
                                    <div className="text-sm font-medium">{communityName}</div>
                                </div>
                            </div>
                        )}

                        {/* Divider */}
                        {(authorName || communityName) && (
                            <div className="border-t border-base-300 my-4"></div>
                        )}

                        {/* Beneficiary Information */}
                        {beneficiaryName && beneficiaryName !== authorName && (
                            <div className="mb-4">
                                <div className="text-xs opacity-70 mb-2">
                                    {t('beneficiary', { defaultValue: 'Beneficiary' })}
                                </div>
                                <div className="flex items-center gap-3">
                                    <Avatar className="w-8 h-8">
                                      <AvatarImage src={beneficiaryAvatar} alt={beneficiaryName} />
                                      <AvatarFallback userId={beneficiaryId || beneficiaryName} className="font-medium text-xs">
                                        {beneficiaryName ? beneficiaryName.charAt(0).toUpperCase() : '?'}
                                      </AvatarFallback>
                                    </Avatar>
                                    <div className="text-sm font-medium">{beneficiaryName}</div>
                                </div>
                            </div>
                        )}

                        {/* Edit History */}
                        <>
                            {(authorName || communityName || beneficiaryName) && (
                                <div className="border-t border-base-300 my-4"></div>
                            )}
                            <div className="mb-6">
                                <div className="text-sm opacity-70 mb-3">
                                    {t('editHistory', { defaultValue: 'Edit History' })}
                                </div>

                                {editHistory && editHistory.length > 0 ? (
                                    <div className="space-y-3">
                                        {editHistory.map((entry, index) => {
                                            const editorName = entry.editor?.name || 'Unknown';
                                            const editorAvatar = entry.editor?.photoUrl;
                                            const editorId = entry.editor?.id || entry.editedBy;
                                            const formattedEditTime = formatDate(entry.editedAt, 'relative');

                                            return (
                                                <div key={`${entry.editedBy}-${entry.editedAt}-${index}`} className="flex items-center gap-3">
                                                    <Avatar className="w-8 h-8">
                                                      <AvatarImage src={editorAvatar} alt={editorName} />
                                                      <AvatarFallback userId={editorId} className="font-medium text-xs">
                                                        {editorName ? editorName.charAt(0).toUpperCase() : '?'}
                                                      </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1">
                                                        <div className="text-sm font-medium">{editorName}</div>
                                                        <div className="text-xs opacity-60">{formattedEditTime}</div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-sm opacity-60">
                                        {t('noEditsYet', { defaultValue: 'No edits yet' })}
                                    </div>
                                )}
                            </div>
                        </>
                    </div>
                </div>
            </div>
        </BottomPortal>
    );
};

