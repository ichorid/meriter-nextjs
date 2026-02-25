'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useCommunityMembers, useRemoveCommunityMember } from '@/hooks/api/useCommunityMembers';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/shadcn/avatar';
import { User } from 'lucide-react';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SearchInput } from '@/components/molecules/SearchInput';
import { Loader2, Users, UserX, Coins } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { MemberInfoCard } from './MemberInfoCard';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { AddMeritsDialog } from './AddMeritsDialog';

interface MembersTabProps {
    communityId: string;
}

export const MembersTab: React.FC<MembersTabProps> = ({ communityId }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tCommon = useTranslations('common');
    const tSearch = useTranslations('search');
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId);
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(communityId);
    const [searchQuery, setSearchQuery] = useState('');
    const [addMeritsDialogOpen, setAddMeritsDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
    const { canView: canViewMerits } = useCanViewUserMerits(communityId);
    const { user } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Check if user is superadmin or lead
    const isSuperadmin = user?.globalRole === 'superadmin';
    const isUserLead = useMemo(() => {
        if (!communityId || !user?.id || !userRoles) return false;
        const role = userRoles.find((r) => r.communityId === communityId);
        return role?.role === 'lead';
    }, [communityId, user?.id, userRoles]);
    const canRemoveMembers = isSuperadmin || isUserLead;

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }) || `Remove ${userName} from community?`)) {
            removeMember({ id: communityId, userId });
        }
    };

    const members = useMemo(() => {
        const data = membersData?.data;
        // Ensure we always return an array, even if data is not an array
        return Array.isArray(data) ? data : [];
    }, [membersData]);

    // Filter members based on search query
    const filteredMembers = useMemo(() => {
        // Ensure members is an array before filtering
        if (!Array.isArray(members)) {
            return [];
        }
        
        if (!searchQuery.trim()) {
            return members;
        }
        
        const query = searchQuery.toLowerCase();
        return members.filter((member) => {
            const displayName = (member.displayName || '').toLowerCase();
            const username = (member.username || '').toLowerCase();
            
            return displayName.includes(query) || username.includes(query);
        });
    }, [members, searchQuery]);

    if (membersLoading) {
        return (
            <div className="space-y-3 mt-4">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
            </div>
        );
    }

    if (!members || members.length === 0) {
        return (
            <div className="text-center py-12 text-base-content/60 mt-4">
                <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                <p className="font-medium">
                    {t('members.empty')}
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-3 mt-4">
            {members.length > 0 && (
                <div className="mb-4">
                    <SearchInput
                        placeholder={tSearch('results.searchMembersPlaceholder')}
                        value={searchQuery}
                        onSearch={setSearchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full"
                    />
                </div>
            )}

            {filteredMembers.length > 0 ? (
                filteredMembers.map((member) => {
                    // Determine display role: superadmin from globalRole, otherwise community role
                    // Ensure both are strings and handle fake mode edge cases
                    const globalRoleStr = typeof member.globalRole === 'string' ? member.globalRole : '';
                    const communityRoleStr = typeof member.role === 'string' ? member.role : '';
                    
                    const displayRole = globalRoleStr === 'superadmin' 
                        ? 'superadmin' 
                        : communityRoleStr;
                    
                    // Get translated role label if role exists and is a valid role type
                    const validRoles = ['superadmin', 'lead', 'participant'] as const;
                    const roleBadge = displayRole && validRoles.includes(displayRole as typeof validRoles[number])
                        ? tCommon(displayRole as 'superadmin' | 'lead' | 'participant')
                        : undefined;
                    
                    return (
                        <div key={member.id} className="relative group">
                            <MemberInfoCard
                                memberId={member.id}
                                title={member.displayName || member.username || tCommon('unknownUser')}
                                subtitle={member.username ? `@${member.username}` : undefined}
                                icon={
                                    <Avatar className="w-8 h-8 text-xs bg-transparent">
                                        {member.avatarUrl && (
                                            <AvatarImage src={member.avatarUrl} alt={member.displayName || member.username || tCommon('user')} />
                                        )}
                                        <AvatarFallback userId={member.id} className="font-medium uppercase">
                                            {(member.displayName || member.username) ? (member.displayName || member.username).slice(0, 2).toUpperCase() : <User size={14} />}
                                        </AvatarFallback>
                                    </Avatar>
                                }
                                badges={roleBadge ? [roleBadge] : undefined}
                                communityId={communityId}
                                canViewMerits={canViewMerits}
                                walletBalance={member.walletBalance}
                                quota={member.quota}
                                onClick={() => router.push(routes.userProfile(member.id))}
                            />
                            {canRemoveMembers && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setSelectedMember({ id: member.id, name: member.displayName || member.username || tCommon('unknownUser') });
                                        setAddMeritsDialogOpen(true);
                                    }}
                                    className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title={t('members.addMerits')}
                                >
                                    <Coins className="w-4 h-4" />
                                </button>
                            )}
                            {canRemoveMembers && member.id !== user?.id && (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemoveMember(member.id, member.displayName || member.username || tCommon('unknownUser'));
                                    }}
                                    disabled={isRemoving}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                    title={t('members.remove')}
                                >
                                    {isRemoving ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <UserX className="w-4 h-4" />
                                    )}
                                </button>
                            )}
                        </div>
                    );
                })
            ) : searchQuery ? (
                <div className="text-center py-12 text-base-content/60">
                    <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                    <p className="font-medium">
                        No members found matching your search
                    </p>
                    <p className="text-sm mt-1">
                        Try a different search term
                    </p>
                </div>
            ) : null}
            {selectedMember && (
                <AddMeritsDialog
                    open={addMeritsDialogOpen}
                    onOpenChange={setAddMeritsDialogOpen}
                    userId={selectedMember.id}
                    userName={selectedMember.name}
                    communityId={communityId}
                    onSuccess={() => {
                        // Refetch members data if needed
                    }}
                />
            )}
        </div>
    );
};
