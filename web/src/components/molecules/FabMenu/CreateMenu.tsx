'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { FileText, BarChart2, Info, FolderKanban } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useToastStore } from '@/shared/stores/toast.store';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUIStore } from '@/stores/ui.store';
import { Button } from '@/components/ui/shadcn/button';
import { Plus } from 'lucide-react';

interface CreateMenuProps {
    communityId: string;
    trigger?: React.ReactNode;
}

export const CreateMenu: React.FC<CreateMenuProps> = ({ communityId, trigger }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const { canCreate, isLoading: permissionLoading, reason } = useCanCreatePost(communityId);
    const { data: community } = useCommunity(communityId);
    const addToast = useToastStore((state) => state.addToast);
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Check if any popup is active
    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    // Check if community is future-vision (polls disabled)
    const isFutureVision = community?.typeTag === 'future-vision';
    
    // Check if community supports project creation (marathon-of-good or team)
    const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';
    const isTeamCommunity = community?.typeTag === 'team';
    const canCreateProjects = isGoodDeedsMarathon || isTeamCommunity;

    // Calculate available actions
    const hasAvailableActions = canCreate === true;

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
        router.push(`/meriter/communities/${communityId}/create-poll`);
        setIsOpen(false);
    };

    const handleCreateProject = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!canCreate) {
            addToast(
                reason || t('noPermission'),
                'info'
            );
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create?postType=project`);
        setIsOpen(false);
    };

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current && menuRef.current.contains(target)) {
                return;
            }
            setIsOpen(false);
        };

        if (isOpen) {
            const timeoutId = setTimeout(() => {
                document.addEventListener('mousedown', handleClickOutside);
            }, 200);

            return () => {
                clearTimeout(timeoutId);
                document.removeEventListener('mousedown', handleClickOutside);
            };
        }

        return undefined;
    }, [isOpen]);

    // Hide when any popup is active (unless the menu itself is open)
    if (hasActivePopup && !isOpen) {
        return null;
    }

    // Don't show if no actions available (after loading)
    if (!permissionLoading && !hasAvailableActions) {
        return null;
    }

    const defaultTrigger = (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-full active:scale-[0.98] p-0 w-[45px] h-[45px] flex items-center justify-center bg-base-100 shadow-lg hover:bg-base-200"
            aria-label={isOpen ? tCommon('close') : tCommon('open')}
        >
            <Plus size={27} className="text-base-content/70" />
        </Button>
    );

    return (
        <div className="relative" ref={menuRef}>
            {trigger || defaultTrigger}

            {/* Menu Dropdown */}
            {isOpen && !permissionLoading && (
                <div className="absolute right-0 bottom-full mb-2 w-56 bg-base-100 rounded-xl shadow-2xl shadow-none overflow-hidden z-50">
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
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <BarChart2 size={16} className="text-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-base-content">{t('createPoll')}</span>
                                    </button>
                                )}
                                {canCreateProjects && (
                                    <button
                                        type="button"
                                        onClick={handleCreateProject}
                                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-base-content/5 transition-colors text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                                            <FolderKanban size={16} className="text-primary" />
                                        </div>
                                        <span className="text-sm font-medium text-base-content">{t('createProject') || 'Create Project'}</span>
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
                                {canCreateProjects && (
                                    <button
                                        type="button"
                                        disabled
                                        className="w-full px-4 py-3 flex items-center gap-3 text-left opacity-40 cursor-not-allowed"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-base-content/5 flex items-center justify-center">
                                            <FolderKanban size={16} className="text-base-content/50" />
                                        </div>
                                        <span className="text-sm font-medium text-base-content/50">{t('createProject') || 'Create Project'}</span>
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
        </div>
    );
};

