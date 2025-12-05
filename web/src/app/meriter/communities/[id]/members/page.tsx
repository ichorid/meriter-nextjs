'use client';

import { use } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { BrandButton } from '@/components/ui/BrandButton';
import { useCommunity, useCommunityMembers, useRemoveCommunityMember } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { Loader2, UserX } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

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
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader
                    title={t('members.title')}
                    showBack={true}
                    onBack={() => router.push(routes.community(communityId))}
                />

                <div className="p-4 space-y-4">
                    {membersLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                        </div>
                    ) : membersData?.data && membersData.data.length > 0 ? (
                        <div className="space-y-2">
                            {membersData.data.map((member) => (
                                <div
                                    key={member.id}
                                    className="flex items-center justify-between p-3 bg-base-100 border border-brand-secondary/10 rounded-lg shadow-sm hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-center space-x-3">
                                        <BrandAvatar
                                            src={member.avatarUrl}
                                            fallback={member.displayName || member.username}
                                            size="md"
                                        />
                                        <div>
                                            <div className="font-medium text-brand-text-primary">
                                                {member.displayName || member.username}
                                            </div>
                                            <div className="text-xs text-brand-text-secondary">
                                                @{member.username} • {member.globalRole}
                                            </div>
                                        </div>
                                    </div>

                                    {isAdmin && member.id !== user?.id && (
                                        <button
                                            onClick={() => handleRemoveMember(member.id, member.displayName || member.username)}
                                            disabled={isRemoving}
                                            className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
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
