'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useLeadCommunities } from '@/hooks/api/useProfile';
import { useInvites, useCommunityInvites, useCreateInvite } from '@/hooks/api/useInvites';
import { useCommunities, useCommunity } from '@/hooks/api/useCommunities';
import { BottomActionSheet } from '@/components/ui/BottomActionSheet';
import { InviteCreationForm } from './InviteCreationForm';
import { InviteList } from './InviteList';
import { ChevronDown, ChevronUp, UserPlus } from 'lucide-react';
import type { Invite } from '@/types/api-v1';

interface InviteCreationPopupProps {
    isOpen: boolean;
    onClose: () => void;
    communityId?: string;
}

export const InviteCreationPopup = React.forwardRef<HTMLDivElement, InviteCreationPopupProps>(({
    isOpen,
    onClose,
    communityId,
}, ref) => {
    const t = useTranslations('profile.invites');
    const tInvites = useTranslations('invites.create');
    const { user } = useAuth();

    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const { data: leadCommunities = [] } = useLeadCommunities(user?.id || '');
    const { data: communitiesData } = useCommunities();
    
    // Fetch community data if communityId is provided to check if it's a special community
    const { data: currentCommunity } = useCommunity(communityId || '');
    
    // Determine user role and permissions early to conditionally enable hooks
    const isSuperadmin = user?.globalRole === 'superadmin';
    const isLead = useMemo(() => {
        return userRoles.some(r => r.role === 'lead') || leadCommunities.length > 0;
    }, [userRoles, leadCommunities]);
    const hasPermission = isSuperadmin || isLead;

    // Check if user has permission to view invites for the SPECIFIC community (admin/lead of that community)
    const canViewCurrentCommunityInvites = useMemo(() => {
        if (!communityId) return false;
        if (isSuperadmin) return true;
        // Check if user is lead in this specific community
        return leadCommunities.some(c => c.id === communityId);
    }, [communityId, isSuperadmin, leadCommunities]);
    
    // Use community-specific invites if communityId is provided, otherwise use all invites
    // Only fetch community invites if user has permission (admin/lead of THAT community)
    const { data: allInvitesResponse, isLoading: allInvitesLoading } = useInvites();
    const { data: communityInvitesData, isLoading: communityInvitesLoading } = useCommunityInvites(
        communityId || '',
        { enabled: canViewCurrentCommunityInvites }
    );
    
    // Extract array from paginated response or use array directly
    // getAll returns { data: T[], total, skip, limit }, getByCommunity returns T[] directly
    const allInvites = Array.isArray(allInvitesResponse) 
        ? allInvitesResponse 
        : (allInvitesResponse?.data ?? []);
    const communityInvites = Array.isArray(communityInvitesData) 
        ? communityInvitesData 
        : [];
    
    // If communityId is provided and valid, use community-specific invites, otherwise use all invites
    const invites = (communityId && communityInvitesData) ? communityInvites : allInvites;
    const invitesLoading = (communityId && communityInvitesData !== undefined) ? communityInvitesLoading : allInvitesLoading;
    
    const createInvite = useCreateInvite();

    const [generatedInvite, setGeneratedInvite] = useState<Invite | null>(null);
    const [inviteCopied, setInviteCopied] = useState(false);
    const [showInviteList, setShowInviteList] = useState(false);

    // Determine invite type
    // If superadmin is creating from a special community (marathon-of-good or future-vision),
    // always use superadmin-to-lead type
    const isSpecialCommunity = useMemo(() => {
        if (!communityId || !currentCommunity) return false;
        return currentCommunity.typeTag === 'marathon-of-good' || currentCommunity.typeTag === 'future-vision';
    }, [communityId, currentCommunity]);

    const inviteType = useMemo(() => {
        if (isSuperadmin && isSpecialCommunity) {
            return 'superadmin-to-lead';
        }
        return isSuperadmin ? 'superadmin-to-lead' : 'lead-to-participant';
    }, [isSuperadmin, isSpecialCommunity]);

    // Get available communities for selection (only for lead - superadmin doesn't need selection)
    const availableCommunities = useMemo(() => {
        if (isSuperadmin) {
            return [];
        } else {
            // For lead, show their team communities
            const teams = leadCommunities.filter(c => c.typeTag === 'team');
            // If communityId is provided and it's in the list, pre-select it
            return teams.length > 0 ? teams : leadCommunities;
        }
    }, [isSuperadmin, leadCommunities]);

    // Pre-select community if provided
    const [selectedCommunityId, setSelectedCommunityId] = useState<string>(communityId || '');
    
    useEffect(() => {
        if (communityId && availableCommunities.some(c => c.id === communityId)) {
            setSelectedCommunityId(communityId);
        } else if (!communityId && availableCommunities.length > 0 && !selectedCommunityId) {
            // Auto-select first team community if no communityId provided
            const teamCommunities = availableCommunities.filter(c => c.typeTag === 'team');
            if (teamCommunities.length > 0) {
                setSelectedCommunityId(teamCommunities[0]?.id ?? '');
            } else if (availableCommunities.length > 0) {
                setSelectedCommunityId(availableCommunities[0]?.id ?? '');
            }
        }
    }, [communityId, availableCommunities, selectedCommunityId]);

    const handleCreateInvite = async (data: {
        type: 'superadmin-to-lead' | 'lead-to-participant';
        communityId?: string;
        expiresAt?: string;
    }) => {
        const inviteData: any = {
            type: data.type,
            ...(data.communityId || (!isSuperadmin && selectedCommunityId) ? { communityId: data.communityId || selectedCommunityId } : {}),
            expiresAt: data.expiresAt,
        };
        
        const invite = await createInvite.mutateAsync(inviteData);
        setGeneratedInvite(invite);
        return invite;
    };

    const handleCopyInviteCode = (code: string) => {
        navigator.clipboard.writeText(code);
        setInviteCopied(true);
        setTimeout(() => setInviteCopied(false), 2000);
    };

    // Format date for display
    const formatDate = (dateString?: string) => {
        if (!dateString) return t('noExpiration');
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    };

    // Check if invite is expired
    const isInviteExpired = (invite: Invite) => {
        if (!invite.expiresAt) return false;
        return new Date(invite.expiresAt) < new Date();
    };

    // Get community name by ID
    const getCommunityName = (inviteCommunityId?: string) => {
        if (!inviteCommunityId) {
            return inviteType === 'superadmin-to-lead'
                ? t('autoAssigned')
                : t('notSet');
        }
        if (isSuperadmin && communitiesData?.data) {
            const comm = communitiesData.data.find(c => c.id === inviteCommunityId);
            return comm?.name || inviteCommunityId;
        } else {
            const comm = leadCommunities.find(c => c.id === inviteCommunityId);
            return comm?.name || inviteCommunityId;
        }
    };

    // Filter invites by community if communityId is provided
    const filteredInvites = useMemo(() => {
        // Ensure invites is always an array
        const invitesArray = Array.isArray(invites) ? invites : [];
        if (communityId) {
            return invitesArray.filter((invite: Invite) => invite.communityId === communityId);
        }
        return invitesArray;
    }, [invites, communityId]);
    
    // Don't render the sheet if not open or no permission
    if (!hasPermission || !isOpen) {
        return null;
    }

    return (
        <BottomActionSheet
            ref={ref}
            isOpen={isOpen}
            onClose={onClose}
            title={t('title')}
        >
            <div className="space-y-4">
                <div className="flex items-center space-x-3 mb-4">
                    <div className="text-brand-primary bg-brand-primary/10 p-2 rounded-lg">
                        <UserPlus size={20} />
                    </div>
                    <h2 className="text-lg font-bold text-brand-text-primary">
                        {t('title')}
                    </h2>
                </div>

                <InviteCreationForm
                    isSuperadmin={isSuperadmin}
                    inviteType={inviteType}
                    availableCommunities={availableCommunities}
                    selectedCommunityId={selectedCommunityId}
                    onCommunityChange={setSelectedCommunityId}
                    onCreateInvite={handleCreateInvite}
                    isCreating={createInvite.isPending}
                    generatedInvite={generatedInvite}
                    onInviteGenerated={(invite) => {
                        setGeneratedInvite(invite);
                        setShowInviteList(true);
                    }}
                />

                {/* Invite List Dropdown */}
                {filteredInvites.length > 0 && (
                    <div className="border-t border-brand-secondary/10 pt-4">
                        <button
                            onClick={() => setShowInviteList(!showInviteList)}
                            className="flex items-center justify-between w-full p-3 bg-brand-surface border border-brand-secondary/10 rounded-lg hover:bg-brand-secondary/5 transition-colors"
                        >
                            <span className="font-medium text-brand-text-primary">
                                {t('generatedInvites')} ({filteredInvites.length})
                            </span>
                            {showInviteList ? (
                                <ChevronUp className="w-5 h-5 text-brand-text-secondary" />
                            ) : (
                                <ChevronDown className="w-5 h-5 text-brand-text-secondary" />
                            )}
                        </button>

                        {showInviteList && (
                            <div className="mt-2 max-h-96 overflow-y-auto">
                                <InviteList
                                    invites={filteredInvites}
                                    isLoading={invitesLoading}
                                    onCopyInvite={handleCopyInviteCode}
                                    inviteCopied={inviteCopied}
                                    getCommunityName={getCommunityName}
                                    formatDate={formatDate}
                                    isInviteExpired={isInviteExpired}
                                    showHeader={false}
                                />
                            </div>
                        )}
                    </div>
                )}
            </div>
        </BottomActionSheet>
    );
});

InviteCreationPopup.displayName = 'InviteCreationPopup';
