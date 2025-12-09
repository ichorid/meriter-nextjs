'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { useCommunity, useCommunityMembers, useRemoveCommunityMember } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { Loader2, UserX } from 'lucide-react';
import { routes } from '@/lib/constants/routes';
import { LeadCard } from '@/components/molecules/LeadCard/LeadCard';

const CommunityMembersPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const resolvedParams = use(params);
    const communityId = resolvedParams.id;
    const { user } = useAuth();

    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId);
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(communityId);
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    // Check if user is admin (superadmin or lead of this community)
    const isAdmin = community?.isAdmin;

    // Determine if we should show role chip and hide team info
    const isMarathonOrFutureVision = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';
    const isTeam = community?.typeTag === 'team';
    const showRoleChip = isMarathonOrFutureVision || isTeam;
    const hideTeamInfo = isTeam;

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }))) {
            removeMember(userId);
        }
    };

    if (communityLoading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    return (
        <AdaptiveLayout
            className="members"
            communityId={communityId}
            myId={user?.id}
        >
            <div className="flex flex-col h-full bg-base-100 overflow-hidden">
                <PageHeader
                    title={t('members.title')}
                    showBack={true}
                    onBack={() => router.push(routes.community(communityId))}
                />

                <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4">
                    {membersLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                        </div>
                    ) : membersData?.data && membersData.data.length > 0 ? (
                        <div className="bg-base-100 rounded-lg border border-base-300 overflow-hidden">
                            {membersData.data.map((member) => (
                                <div key={member.id} className="relative group">
                                    <LeadCard
                                        id={member.id}
                                        displayName={member.displayName || member.username}
                                        username={member.username}
                                        avatarUrl={member.avatarUrl}
                                        role={member.role}
                                        showRoleChip={showRoleChip}
                                        hideTeamInfo={hideTeamInfo}
                                        onClick={() => router.push(routes.userProfile(member.id))}
                                    />
                                    {isAdmin && member.id !== user?.id && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleRemoveMember(member.id, member.displayName || member.username);
                                            }}
                                            disabled={isRemoving}
                                            className="absolute right-12 top-1/2 -translate-y-1/2 p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors opacity-0 group-hover:opacity-100"
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
                    ) : (
                        <div className="text-center py-12 text-brand-text-secondary">
                            {t('members.empty')}
                        </div>
                    )}
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default CommunityMembersPage;
