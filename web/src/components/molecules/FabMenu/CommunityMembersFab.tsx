'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { InviteCreationPopup } from '@/components/organisms/Community/InviteCreationPopup';
import { UserPlus, X } from 'lucide-react';
import { useUIStore } from '@/stores/ui.store';

interface CommunityMembersFabProps {
    communityId: string;
}

export const CommunityMembersFab: React.FC<CommunityMembersFabProps> = ({ communityId }) => {
    const tCommon = useTranslations('common');
    const { user } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
    
    const [isOpen, setIsOpen] = useState(false);
    const fabRef = useRef<HTMLDivElement>(null);

    // Check if user has invite creation permissions
    const isSuperadmin = user?.globalRole === 'superadmin';
    const isLead = userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
    const hasPermission = isSuperadmin || isLead;

    // Check if any popup is active using UI store
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (fabRef.current && !fabRef.current.contains(event.target as Node)) {
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

    // Don't show FAB if user doesn't have permission
    if (!hasPermission) {
        return null;
    }

    return (
        <>
            <div className="fixed bottom-20 right-4 z-[60] lg:bottom-6 lg:right-6" ref={fabRef}>
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
                    aria-label={isOpen ? tCommon('close') : tCommon('createInvite')}
                >
                    {isOpen ? (
                        <X size={24} strokeWidth={2.5} />
                    ) : (
                        <UserPlus size={24} strokeWidth={2.5} />
                    )}
                </button>
            </div>

            <InviteCreationPopup
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                communityId={communityId}
            />
        </>
    );
};
