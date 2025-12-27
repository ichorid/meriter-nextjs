'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { InviteCreationPopup } from '@/components/organisms/Community/InviteCreationPopup';
import { useUIStore } from '@/stores/ui.store';
import { UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';

interface InviteMenuProps {
    communityId: string;
    trigger?: React.ReactNode;
}

export const InviteMenu: React.FC<InviteMenuProps> = ({ communityId, trigger }) => {
    const tCommon = useTranslations('common');
    const { user } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
    const { activeVotingTarget, activeWithdrawTarget, activeModal } = useUIStore();
    const [isOpen, setIsOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    const popupRef = useRef<HTMLDivElement>(null);

    // Check if any popup is active
    const hasActivePopup = activeVotingTarget !== null || activeWithdrawTarget !== null || activeModal !== null;

    // Check if user has invite creation permissions
    const isSuperadmin = user?.globalRole === 'superadmin';
    const isLead = userRoles.some(r => r.communityId === communityId && r.role === 'lead') || 
                   leadCommunities.some(c => c.id === communityId);
    const hasPermission = isSuperadmin || isLead;

    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (menuRef.current?.contains(target) || popupRef.current?.contains(target)) {
                return;
            }
            setIsOpen(false);
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    // Hide when any popup is active (unless the menu itself is open)
    if (hasActivePopup && !isOpen) {
        return null;
    }

    // Don't show if user doesn't have permission
    if (!hasPermission) {
        return null;
    }

    const defaultTrigger = (
        <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded-xl active:scale-[0.98] px-2"
            aria-label={tCommon('createInvite')}
        >
            <UserPlus size={18} className="text-base-content/70" />
        </Button>
    );

    return (
        <>
            <div className="relative" ref={menuRef}>
                {trigger || defaultTrigger}
            </div>

            <InviteCreationPopup
                ref={popupRef}
                isOpen={isOpen}
                onClose={() => setIsOpen(false)}
                communityId={communityId}
            />
        </>
    );
};

