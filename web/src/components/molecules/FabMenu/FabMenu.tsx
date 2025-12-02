'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, BarChart2, FolderKanban, FileSpreadsheet, Info } from 'lucide-react';
import { useCanCreatePost } from '@/hooks/useCanCreatePost';
import { useToastStore } from '@/shared/stores/toast.store';

interface FabMenuProps {
    communityId: string;
}

export const FabMenu = ({ communityId }: FabMenuProps) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const { canCreate, isLoading: permissionLoading, reason } = useCanCreatePost(communityId);
    const addToast = useToastStore((state) => state.addToast);
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleCreatePost = () => {
        if (!canCreate) {
            addToast(
                reason || 'Only team leads and organizers can create posts.',
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
                reason || 'Only team leads and organizers can create polls.',
                'info'
            );
            setIsOpen(false);
            return;
        }
        router.push(`/meriter/communities/${communityId}/create-poll`);
        setIsOpen(false);
    };

    // Placeholders for future features
    const handleCreateProject = () => {
        console.log('Create Project clicked');
        setIsOpen(false);
    };

    const handleCreateReport = () => {
        console.log('Create Report clicked');
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

    return (
        <div className="fixed bottom-20 right-6 z-[60] lg:bottom-6" ref={menuRef}>
            {/* Menu Items */}
            {isOpen && !permissionLoading && (
                <div className="absolute bottom-16 right-0 w-56 bg-base-100 rounded-xl shadow-xl border border-brand-border dark:border-base-300/50 overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="py-1">
                        {canCreate ? (
                            <>
                                <button
                                    onClick={handleCreatePost}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                                >
                                    <FileText size={18} className="text-brand-primary" />
                                    <span className="text-sm font-medium text-brand-text-primary dark:text-base-content">{t('createPost')}</span>
                                </button>
                                <button
                                    onClick={handleCreatePoll}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                                >
                                    <BarChart2 size={18} className="text-brand-primary" />
                                    <span className="text-sm font-medium text-brand-text-primary dark:text-base-content">{t('createPoll')}</span>
                                </button>
                            </>
                        ) : (
                            <>
                                {/* Show disabled buttons with notice */}
                                <button
                                    onClick={handleCreatePost}
                                    disabled
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                                >
                                    <FileText size={18} className="text-brand-text-secondary dark:text-base-content/70" />
                                    <span className="text-sm font-medium text-brand-text-secondary dark:text-base-content/70">{t('createPost')}</span>
                                </button>
                                <button
                                    onClick={handleCreatePoll}
                                    disabled
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                                >
                                    <BarChart2 size={18} className="text-brand-text-secondary dark:text-base-content/70" />
                                    <span className="text-sm font-medium text-brand-text-secondary dark:text-base-content/70">{t('createPoll')}</span>
                                </button>
                                {/* Inline notice explaining why action is unavailable */}
                                {reason && (
                                    <div className="px-4 py-3 border-t border-brand-border dark:border-base-300/50 bg-info/10">
                                        <div className="flex items-start gap-2">
                                            <Info size={16} className="text-info flex-shrink-0 mt-0.5" />
                                            <p className="text-xs text-base-content/70 leading-relaxed">
                                                {reason}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <button
                            onClick={handleCreateProject}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                        >
                            <FolderKanban size={18} className="text-brand-text-secondary dark:text-base-content/70" />
                            <span className="text-sm font-medium text-brand-text-secondary dark:text-base-content/70">Project (Coming Soon)</span>
                        </button>
                        <button
                            onClick={handleCreateReport}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                        >
                            <FileSpreadsheet size={18} className="text-brand-text-secondary dark:text-base-content/70" />
                            <span className="text-sm font-medium text-brand-text-secondary dark:text-base-content/70">Report (Coming Soon)</span>
                        </button>
                    </div>
                </div>
            )}

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${isOpen
                        ? 'bg-brand-text-primary text-white rotate-45'
                        : 'bg-brand-primary text-white hover:bg-brand-primary/90 hover:scale-105'
                    }`}
                aria-label={isOpen ? "Close menu" : "Open menu"}
            >
                <Plus size={28} />
            </button>
        </div>
    );
};
