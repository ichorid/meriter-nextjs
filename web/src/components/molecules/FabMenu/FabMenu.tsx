'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, BarChart2, Info } from 'lucide-react';
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

    // Calculate available actions
    // "Create Post" is available when canCreate === true
    // "Create Poll" is available when canCreate === true AND community is not future-vision
    const hasAvailableActions = canCreate === true; // At least "Create Post" is available if canCreate is true

    // Check if any popup is active using UI store
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    const handleCreatePost = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(
                reason || t('noPermission'),
                'info'
            );
            setIsOpen(false);
            return;
        }
        // Navigate immediately, then close menu
        router.push(`/meriter/communities/${communityId}/create`);
        setIsOpen(false);
    };

    const handleCreatePoll = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(
                reason || t('noPermission'),
                'info'
            );
            setIsOpen(false);
            return;
        }
        // Navigate immediately, then close menu
        router.push(`/meriter/communities/${communityId}/create-poll`);
        setIsOpen(false);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            // Don't close if clicking inside the menu (including buttons)
            if (menuRef.current && menuRef.current.contains(target)) {
                return;
            }
            // Close if clicking outside
            setIsOpen(false);
        };

        if (isOpen) {
            // Use mousedown with a delay to allow button clicks to process first
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 200);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        // Explicit return for the case when isOpen is false
        return undefined;
    }, [isOpen]);

    // Hide FAB when any popup is active (unless the FAB menu itself is open)
    if (hasActivePopup && !isOpen) {
        return null;
    }

    // Wait for permission loading to complete, then hide FAB if no actions are available
    if (!permissionLoading && !hasAvailableActions) {
        return null;
    }

    return (
        <div className="fabSlot" ref={menuRef}>
            {/* Menu Items */}
            {isOpen && !permissionLoading && (
                <div className="absolute bottom-16 right-0 w-56 bg-base-100 rounded-2xl shadow-2xl border border-base-content/10 overflow-hidden z-50 pointer-events-auto">
                    <div className="py-2">
                        {canCreate ? (
                            <>
                                <button
                                    type="button"
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
                                        type="button"
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
                                    type="button"
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
                                        type="button"
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
                    </div>
                </div>
            )}

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`fab
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
