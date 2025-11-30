'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { BrandModal } from '@/components/ui/BrandModal';
import { useCommunity, useCommunityMembers, useRemoveCommunityMember } from '@/hooks/api';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCreateInvite } from '@/hooks/api/useInvites';
import { Loader2, Trash2, UserX, UserPlus, Copy, Check } from 'lucide-react';
import { routes } from '@/lib/constants/routes';

const CommunityMembersPage = ({ params }: { params: Promise<{ id: string }> }) => {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tInvites = useTranslations('invites.create');
    const tCommon = useTranslations('common');
    const resolvedParams = use(params);
    const communityId = resolvedParams.id;
    const { user } = useAuth();

    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId);
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(communityId);
    const { data: userRoles = [] } = useUserRoles(user?.id || '');
    const createInvite = useCreateInvite();

    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteTargetUserId, setInviteTargetUserId] = useState('');
    const [inviteExpiresInDays, setInviteExpiresInDays] = useState<number | ''>(30);
    const [generatedInvite, setGeneratedInvite] = useState<{ code: string } | null>(null);
    const [inviteCopied, setInviteCopied] = useState(false);

    // Check if user is admin (superadmin or lead of this community)
    const isAdmin = community?.isAdmin;
    const isSuperadmin = user?.globalRole === 'superadmin';
    const isUserLead = userRoles.some(r => r.communityId === communityId && r.role === 'lead');
    const canGenerateInvites = isAdmin && (isSuperadmin || isUserLead);
    const inviteType = isSuperadmin ? 'superadmin-to-lead' : 'lead-to-participant';

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }))) {
            removeMember(userId);
        }
    };

    const handleGenerateInvite = async () => {
        if (!communityId || !inviteTargetUserId.trim()) return;

        try {
            const expiresAt = inviteExpiresInDays && inviteExpiresInDays > 0
                ? new Date(Date.now() + inviteExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
                : undefined;

            const invite = await createInvite.mutateAsync({
                targetUserId: inviteTargetUserId.trim(),
                type: inviteType,
                communityId,
                expiresAt,
            });

            setGeneratedInvite({ code: invite.code });
            setInviteCopied(false);
        } catch (error) {
            console.error('Failed to create invite:', error);
        }
    };

    const handleCopyInviteCode = () => {
        if (generatedInvite?.code) {
            navigator.clipboard.writeText(generatedInvite.code);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
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
                    {canGenerateInvites && (
                        <div className="mb-4">
                            <BrandButton
                                variant="primary"
                                onClick={() => setShowInviteModal(true)}
                                leftIcon={<UserPlus className="w-4 h-4" />}
                                fullWidth
                            >
                                {tInvites('generateInvite') || 'Сгенерировать код приглашения'}
                            </BrandButton>
                        </div>
                    )}

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

                {/* Invite Generation Modal */}
                <BrandModal
                    isOpen={showInviteModal}
                    onClose={() => {
                        setShowInviteModal(false);
                        setGeneratedInvite(null);
                        setInviteTargetUserId('');
                        setInviteExpiresInDays(30);
                    }}
                    title={tInvites('title')}
                >
                    <div className="space-y-4">
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                            <p className="text-sm text-blue-800">
                                {isSuperadmin 
                                    ? tInvites('superadminToLeadDescription') || 'Create an invite to make a user a Lead (Representative)'
                                    : tInvites('leadToParticipantDescription') || 'Create an invite to add a participant to this team community'
                                }
                            </p>
                        </div>

                        <BrandFormControl 
                            label={tInvites('targetUserId')}
                            helperText={isSuperadmin 
                                ? 'User ID who will become a Lead (Representative)'
                                : 'User ID who will become a Participant'
                            }
                        >
                            <BrandInput
                                value={inviteTargetUserId}
                                onChange={(e) => setInviteTargetUserId(e.target.value)}
                                placeholder={tInvites('targetUserIdPlaceholder')}
                                fullWidth
                            />
                        </BrandFormControl>

                        <BrandFormControl
                            label={tInvites('expiresInDays')}
                            helperText={tInvites('expiresInDaysHelp')}
                        >
                            <BrandInput
                                type="number"
                                value={inviteExpiresInDays.toString()}
                                onChange={(e) => {
                                    const num = parseInt(e.target.value, 10);
                                    setInviteExpiresInDays(isNaN(num) ? '' : num);
                                }}
                                placeholder={tInvites('expiresInDaysPlaceholder')}
                                fullWidth
                            />
                        </BrandFormControl>

                        {generatedInvite && (
                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center justify-between mb-2">
                                    <p className="font-bold text-green-800">{tInvites('inviteCode') || 'Invite Code'}</p>
                                    <button
                                        onClick={handleCopyInviteCode}
                                        className="p-1 hover:bg-green-100 rounded"
                                        title={tCommon('copy') || 'Copy'}
                                    >
                                        {inviteCopied ? (
                                            <Check className="w-4 h-4 text-green-600" />
                                        ) : (
                                            <Copy className="w-4 h-4 text-green-600" />
                                        )}
                                    </button>
                                </div>
                                <p className="font-mono text-sm text-green-900 break-all">{generatedInvite.code}</p>
                                {inviteCopied && (
                                    <p className="text-xs text-green-600 mt-1">{tCommon('copied') || 'Copied!'}</p>
                                )}
                            </div>
                        )}

                        <div className="flex gap-2">
                            <BrandButton
                                variant="outline"
                                onClick={() => {
                                    setShowInviteModal(false);
                                    setGeneratedInvite(null);
                                    setInviteTargetUserId('');
                                    setInviteExpiresInDays(30);
                                }}
                                fullWidth
                            >
                                {tCommon('close') || 'Close'}
                            </BrandButton>
                            <BrandButton
                                variant="primary"
                                onClick={handleGenerateInvite}
                                disabled={!inviteTargetUserId.trim() || createInvite.isPending}
                                isLoading={createInvite.isPending}
                                fullWidth
                            >
                                {createInvite.isPending ? tInvites('creating') : tInvites('create')}
                            </BrandButton>
                        </div>
                    </div>
                </BrandModal>
            </div>
        </AdaptiveLayout>
    );
};

export default CommunityMembersPage;
