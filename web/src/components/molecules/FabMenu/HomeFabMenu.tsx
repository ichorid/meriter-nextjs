'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Plus, FileText, BarChart2, Users } from 'lucide-react';
import { useWallets } from '@/hooks/api';

export const HomeFabMenu: React.FC = () => {
    const router = useRouter();
    const t = useTranslations('home');
    const tCommunities = useTranslations('pages.communities');
    const { data: wallets = [] } = useWallets();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // Get first community ID from wallets
    const firstCommunityId = wallets.length > 0 ? wallets[0]?.communityId : null;
    const hasCommunities = wallets.length > 0;

    const handleCreateCommunity = () => {
        router.push('/meriter/communities/create');
        setIsOpen(false);
    };

    const handleCreatePost = () => {
        if (firstCommunityId) {
            router.push(`/meriter/communities/${firstCommunityId}/create`);
        } else {
            router.push('/meriter/communities/create');
        }
        setIsOpen(false);
    };

    const handleCreatePoll = () => {
        if (firstCommunityId) {
            router.push(`/meriter/communities/${firstCommunityId}/create-poll`);
        } else {
            router.push('/meriter/communities/create');
        }
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
                <div className="absolute bottom-16 right-0 w-56 bg-white rounded-xl shadow-xl border border-brand-border overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
                    <div className="py-1">
                        {!hasCommunities ? (
                            // No communities - show create community option
                            <button
                                onClick={handleCreateCommunity}
                                className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                            >
                                <Users size={18} className="text-brand-primary" />
                                <span className="text-sm font-medium text-brand-text-primary">
                                    {t('hero.actions.createCommunity') || 'Create Community'}
                                </span>
                            </button>
                        ) : (
                            // Has communities - show create post and poll options
                            <>
                                <button
                                    onClick={handleCreatePost}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                                >
                                    <FileText size={18} className="text-brand-primary" />
                                    <span className="text-sm font-medium text-brand-text-primary">
                                        {tCommunities('createPost') || 'Create Post'}
                                    </span>
                                </button>
                                <button
                                    onClick={handleCreatePoll}
                                    className="w-full px-4 py-3 flex items-center gap-3 hover:bg-brand-surface transition-colors text-left"
                                >
                                    <BarChart2 size={18} className="text-brand-primary" />
                                    <span className="text-sm font-medium text-brand-text-primary">
                                        {tCommunities('createPoll') || 'Create Poll'}
                                    </span>
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* FAB Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all duration-200 ${
                    isOpen
                        ? 'bg-brand-text-primary text-white rotate-45'
                        : 'bg-brand-primary text-white hover:bg-brand-primary/90 hover:scale-105'
                }`}
                aria-label={isOpen ? 'Close menu' : 'Open menu'}
            >
                <Plus size={28} />
            </button>
        </div>
    );
};

