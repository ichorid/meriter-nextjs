'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, BarChart2, FolderKanban, FileSpreadsheet } from 'lucide-react';

interface FabMenuProps {
    communityId: string;
}

export const FabMenu = ({ communityId }: FabMenuProps) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    const handleCreatePost = () => {
        router.push(`/meriter/communities/${communityId}/create`);
        setIsOpen(false);
    };

    const handleCreatePoll = () => {
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
        <div className="fixed bottom-6 right-6 z-50" ref={menuRef}>
            {/* Menu Items */}
            {isOpen && (
                <div className="absolute bottom-16 right-0 w-56 bg-base-100 rounded-xl shadow-xl border border-brand-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="py-1">
                        <button
                            onClick={handleCreatePost}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                        >
                            <FileText size={18} className="text-brand-primary" />
                            <span className="text-sm font-medium text-brand-text-primary">{t('createPost')}</span>
                        </button>
                        <button
                            onClick={handleCreatePoll}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                        >
                            <BarChart2 size={18} className="text-brand-primary" />
                            <span className="text-sm font-medium text-brand-text-primary">{t('createPoll')}</span>
                        </button>
                        <button
                            onClick={handleCreateProject}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                        >
                            <FolderKanban size={18} className="text-brand-text-secondary" />
                            <span className="text-sm font-medium text-brand-text-secondary">Project (Coming Soon)</span>
                        </button>
                        <button
                            onClick={handleCreateReport}
                            className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left opacity-50 cursor-not-allowed"
                        >
                            <FileSpreadsheet size={18} className="text-brand-text-secondary" />
                            <span className="text-sm font-medium text-brand-text-secondary">Report (Coming Soon)</span>
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
