'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, BarChart2, FolderKanban, FileSpreadsheet, Info, X } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useToastStore } from '@/shared/stores/toast.store';
import { useUIStore } from '@/stores/ui.store';
import { useCommunity } from '@/hooks/api/useCommunities';

interface FabMenuProps {
    communityId: string;
}

export const FabMenu = ({ communityId }: FabMenuProps) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const { canCreate, isLoading: permissionLoading, reason } = useCanCreatePost(communityId);
    const { data: community } = useCommunity(communityId);
    const addToast = useToastStore((state) => state.addToast);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Check if community is future-vision (polls disabled)
    const isFutureVision = community?.typeTag === 'future-vision';

    // Check if any popup is active using UI store
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    const handleCreatePost = () => {
        if (!canCreate) {
            addToast(
                reason || t('noPermission'),
                'info'
            );
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create`);
        setIsOpen(false);
    };

    const handleCreatePoll = () => {
        if (!canCreate) {
            addToast(
                reason || t('noPermission'),
                'info'
            );
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create-poll`);
        setIsOpen(false);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Hide FAB when any popup is active (unless the FAB menu itself is open)
    if (hasActivePopup && !isOpen) {
        return null;
    }

    return (
        <div className="fixed bottom-20 right-4 z-[60] lg:bottom-6 lg:right-6" ref={menuRef}>
            {/* Menu Items */}
            {isOpen && !permissionLoading && (
                <div className="absolute bottom-16 right-0 w-56 bg-base-100 rounded-2xl shadow-2xl border border-base-content/10 overflow-hidden">
                    <div className="py-2">
                        {canCreate ? (
                            <>
                                <button
                                    onClick={handleCreatePost}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                                >
                                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                        <FileText size={16} className="text-primary" />
                                    </div>
                                    <span className="text-sm font-medium text-base-content">{t('createPost')}</span>
                                </button>
                                {!isFutureVision && (
                                    <button
                                        onClick={handleCreatePoll}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
                                            <BarChart2 size={16} className="text-secondary" />
                                        </div>
                                        <span className="text-sm font-medium text-base-content">{t('createPoll')}</span>
                                    </button>
                                )}
                            </>
                        ) : (
                            <>
                                <button
                                    disabled
                                    className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                                >
                                    <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                        <FileText size={16} className="text-base-content/50" />
                                    </div>
                                    <span className="text-sm font-medium text-base-content/50">{t('createPost')}</span>
                                </button>
                                {!isFutureVision && (
                                    <button
                                        disabled
                                        className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                            <BarChart2 size={16} className="text-base-content/50" />
                                        </div>
                                        <span className="text-sm font-medium text-base-content/50">{t('createPoll')}</span>
                                    </button>
                                )}
                                {reason && (
                                    <div className="mx-3 mt-2 p-3 rounded-xl bg-base-200/50">
                                        <div className="flex items-start gap-2">
                                            <Info size={14} className="text-base-content/50 flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-base-content/60 leading-relaxed">
                                                {reason}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}

                        {/* Divider */}
                        <div className="my-2 mx-4 border-t border-base-content/5" />

                        {/* Coming soon items */}
                        <button
                            disabled
                            className="w-full px-4 py-2.5 flex items-center gap-3 text-left opacity-30 cursor-not-allowed"
                        >
                            <FolderKanban size={16} className="text-base-content/50" />
                            <span className="text-xs text-base-content/50">{tCommon('comingSoon')}</span>
                        </button>
                    </div>
                </div>
            )}

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center justify-center w-14 h-14 rounded-full shadow-lg 
                    transition-all duration-200 
                    ${isOpen
                        ? 'bg-base-content text-base-100 rotate-45'
                        : 'bg-base-content text-base-100 hover:scale-105 active:scale-95'
                    }
                `}
                aria-label={isOpen ? tCommon('close') : tCommon('open')}
            >
                <Plus size={24} strokeWidth={2.5} />
            </button>
        </div>
    );
};
