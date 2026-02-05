'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { routes } from '@/lib/constants/routes';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { useCommunity, useCommunityMembers, useRemoveCommunityMember } from '@/hooks/api';
import { useUserRoles } from '@/hooks/api/useProfile';
import { Loader2, UserX, Users } from 'lucide-react';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { MemberCardWithMerits } from './MemberCardWithMerits';
import { SearchInput } from '@/components/molecules/SearchInput';
import { useDebounce } from '@/hooks/useDebounce';
import { AddMeritsDialog } from '@/components/organisms/Community/AddMeritsDialog';
import { Coins } from 'lucide-react';

interface CommunityMembersPageClientProps {
  communityId: string;
}

export function CommunityMembersPageClient({ communityId }: CommunityMembersPageClientProps) {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tSearch = useTranslations('search');
    const { user } = useAuth();

    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [addMeritsDialogOpen, setAddMeritsDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId, {
        search: debouncedSearchQuery.trim() || undefined,
    });
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(communityId);
    const { data: _userRoles = [] } = useUserRoles(user?.id || '');

    // Check if user is admin (superadmin or lead of this community)
    const isAdmin = community?.isAdmin;

    // Check if current user can view merits/quota for other users
    const { canView: canViewMerits } = useCanViewUserMerits(communityId);

    // Determine if we should show role chip and hide team info
    const isMarathonOrFutureVision = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';
    const isTeam = community?.typeTag === 'team';
    const showRoleChip = isMarathonOrFutureVision || isTeam;
    const hideTeamInfo = isTeam;

    // Get members array (already filtered server-side)
    const members = Array.isArray(membersData?.data) ? membersData.data : [];

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }))) {
            removeMember({ id: communityId, userId });
        }
    };

    const pageHeader = (
        <SimpleStickyHeader
            title={t('members.title')}
            showBack={true}
            onBack={() => router.push(routes.community(communityId))}
            asStickyHeader={true}
            showScrollToTop={true}
        />
    );

    if (communityLoading) {
        return (
            <AdaptiveLayout
                className="members"
                communityId={communityId}
                myId={user?.id}
                stickyHeader={pageHeader}
            >
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            </AdaptiveLayout>
        );
    }

    return (
        <AdaptiveLayout
            className="members"
            communityId={communityId}
            myId={user?.id}
            stickyHeader={pageHeader}
        >
            <div className="space-y-4">
                {membersLoading ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                    </div>
                ) : (
                    <>
                        <div className="mb-4">
                            <SearchInput
                                placeholder={tSearch('results.searchMembersPlaceholder')}
                                value={searchQuery}
                                onSearch={setSearchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full"
                            />
                        </div>
                        {members.length > 0 ? (
                            <div className="bg-base-100 rounded-lg shadow-none overflow-hidden">
                                {members.map((member) => (
                                    <div key={member.id} className="relative group">
                                        <MemberCardWithMerits
                                            memberId={member.id}
                                            displayName={member.displayName || member.username}
                                            username={member.username}
                                            avatarUrl={member.avatarUrl}
                                            role={member.role}
                                            communityId={communityId}
                                            showRoleChip={showRoleChip}
                                            hideTeamInfo={hideTeamInfo}
                                            canViewMerits={canViewMerits}
                                            onClick={() => router.push(routes.userProfile(member.id))}
                                            hideChevron={isAdmin}
                                        />
                                        {isAdmin && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedMember({ id: member.id, name: member.displayName || member.username });
                                                    setAddMeritsDialogOpen(true);
                                                }}
                                                className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-primary hover:bg-primary/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                                                title={t('members.addMerits')}
                                            >
                                                <Coins className="w-4 h-4" />
                                            </button>
                                        )}
                                        {isAdmin && member.id !== user?.id && (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRemoveMember(member.id, member.displayName || member.username);
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
                                ))}
                            </div>
                        ) : debouncedSearchQuery ? (
                            <div className="text-center py-12 text-brand-text-secondary">
                                <Users className="w-12 h-12 mx-auto mb-3 text-brand-text-secondary/40" />
                                <p className="font-medium">
                                    No members found matching your search
                                </p>
                                <p className="text-sm mt-1">
                                    Try a different search term
                                </p>
                            </div>
                        ) : (
                            <div className="text-center py-12 text-brand-text-secondary">
                                {t('members.empty')}
                            </div>
                        )}
                    </>
                )}
            </div>
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
        </AdaptiveLayout>
    );
}

