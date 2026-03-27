'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { routes } from '@/lib/constants/routes';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import {
    useCommunity,
    useCommunityMembers,
    useLeaveCommunity,
    useRemoveCommunityMember,
} from '@/hooks/api';
import type { CommunityMember } from '@/hooks/api/useCommunityMembers';
import {
    Coins,
    Copy,
    Loader2,
    LogOut,
    Shield,
    ShieldOff,
    UserMinus,
    UserPlus,
    UserX,
    Users,
} from 'lucide-react';
import { useCanViewUserMerits } from '@/hooks/useCanViewUserMerits';
import { MemberCardWithMerits } from './MemberCardWithMerits';
import { SearchInput } from '@/components/molecules/SearchInput';
import { useDebounce } from '@/hooks/useDebounce';
import { AddMeritsDialog } from '@/components/organisms/Community/AddMeritsDialog';
import {
    useTeamRequestsForLead,
    useApproveTeamRequest,
    useRejectTeamRequest,
    type TeamJoinRequest,
} from '@/hooks/api/useTeamRequests';
import { TeamRequestCard } from '@/components/molecules/TeamRequestCard/TeamRequestCard';
import { resolveApiErrorToastMessage } from '@/lib/i18n/api-error-toast';
import { useToastStore } from '@/shared/stores/toast.store';
import { Separator } from '@/components/ui/shadcn/separator';
import { Button } from '@/components/ui/shadcn/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { Input } from '@/components/ui/shadcn/input';
import { trpc } from '@/lib/trpc/client';
import { sanitizeMeriterInternalPath } from '@/lib/utils/safe-meriter-path';
import { communityAllowsLeadManagement } from '@/lib/community/community-lead-management';
import { splitMembersByAdminRole } from '@/lib/community/split-members-by-admin-role';
import {
    CommunityDemoteSelfLeadDialog,
    CommunityPromoteLeadDialog,
    CommunitySuperadminDemoteToParticipantDialog,
} from '@/components/organisms/Community/CommunityLeadActionDialogs';
import { isLocalMembershipHubCommunity } from '@/lib/constants/birzha-source';
import { CommunityJoinRequestPanel } from '@/components/molecules/CommunityJoinRequest/CommunityJoinRequestPanel';
import { isPriorityCommunity } from '@/lib/community/is-priority-community';

interface CommunityMembersPageClientProps {
  communityId: string;
  /** Safe in-app path (e.g. project page) for sticky back; must start with /meriter/ */
  returnTo?: string;
  /** When opened from project UI: copy and back behavior stay project-centric */
  membersContext?: 'project';
}

export function CommunityMembersPageClient({
  communityId,
  returnTo,
  membersContext,
}: CommunityMembersPageClientProps) {
    const router = useRouter();
    const t = useTranslations('pages.communities');
    const tLeadActions = useTranslations('pages.communities.members.leadActions');
    const tProjects = useTranslations('projects');
    const tSearch = useTranslations('search');
    const { user } = useAuth();
    const { data: userRoles = [] } = useUserRoles(user?.id || '');

    const { data: community, isLoading: communityLoading } = useCommunity(communityId);
    const [searchQuery, setSearchQuery] = useState('');
    const debouncedSearchQuery = useDebounce(searchQuery, 500);
    const [addMeritsDialogOpen, setAddMeritsDialogOpen] = useState(false);
    const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
    const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
    const [inviteUrl, setInviteUrl] = useState('');
    const [promoteLeadTarget, setPromoteLeadTarget] = useState<{ id: string; name: string } | null>(
        null,
    );
    const [demoteSelfLeadOpen, setDemoteSelfLeadOpen] = useState(false);
    const [superadminDemote, setSuperadminDemote] = useState<{
        userId: string;
        name: string;
        variant: 'self' | 'other';
    } | null>(null);
    const [leaveCommunityOpen, setLeaveCommunityOpen] = useState(false);
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(communityId, {
        search: debouncedSearchQuery.trim() || undefined,
    });
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(communityId);
    const leaveCommunity = useLeaveCommunity(communityId);
    // Check if user is admin (superadmin or lead of this community)
    const isAdmin = community?.isAdmin;

    // Determine if we should show role chip and hide team info
    const isMarathonOrFutureVision = community?.typeTag === 'marathon-of-good' || community?.typeTag === 'future-vision';
    const isTeam = community?.typeTag === 'team';
    const allowsJoinRequests = community ? isLocalMembershipHubCommunity(community) : false;
    const myRoleInCommunity = userRoles.find((r) => r.communityId === communityId)?.role;
    const isCurrentUserMember =
        myRoleInCommunity === 'lead' || myRoleInCommunity === 'participant';
    const isCurrentUserParticipantOnly = myRoleInCommunity === 'participant';
    const isProjectMembersUi = membersContext === 'project';

    const canShowLeaveCommunity =
        Boolean(user) &&
        isCurrentUserParticipantOnly &&
        !isProjectMembersUi &&
        community != null &&
        community.isProject !== true &&
        !isPriorityCommunity(community);

    const { data: requestsData } = useTeamRequestsForLead(
        allowsJoinRequests && isAdmin ? communityId : '',
    );
    const { mutate: approveRequest, isPending: isApproving } = useApproveTeamRequest();
    const { mutate: rejectRequest, isPending: isRejecting } = useRejectTeamRequest();
    const addToast = useToastStore((state) => state.addToast);

    const INVITE_BLOCKED_TYPE_TAGS = new Set([
        'future-vision',
        'marathon-of-good',
        'team-projects',
        'support',
        'global',
    ]);
    const canCreateInviteLink =
        isCurrentUserMember &&
        community != null &&
        (!community.typeTag || !INVITE_BLOCKED_TYPE_TAGS.has(community.typeTag));

    const leadManagementAllowed =
        !!isAdmin && communityAllowsLeadManagement(community?.typeTag);
    const isPlatformSuperadmin = user?.globalRole === 'superadmin';

    const createInviteMutation = trpc.communities.createCommunityInviteLink.useMutation({
        onSuccess: (data) => {
            const path = `${routes.communityJoin(communityId)}?t=${encodeURIComponent(data.token)}`;
            const full = `${window.location.origin}${path}`;
            setInviteUrl(full);
            setInviteDialogOpen(true);
        },
        onError: (e) => {
            addToast(
                e.message?.trim()
                    ? resolveApiErrorToastMessage(e.message)
                    : t('members.invite.generateFailed'),
                'error',
            );
        },
    });
    
    const requests = requestsData || [];

    // Check if current user can view merits/quota for other users
    const { canView: canViewMerits } = useCanViewUserMerits(communityId);
    const showRoleChip = isMarathonOrFutureVision || isTeam;
    const hideTeamInfo = isTeam;

    // Get members array (already filtered server-side)
    const members = Array.isArray(membersData?.data) ? membersData.data : [];
    const { admins: adminMembers, participants: participantMembers } = useMemo(
        () => splitMembersByAdminRole(members),
        [members],
    );

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }))) {
            removeMember({ id: communityId, userId });
        }
    };

    const handleApproveRequest = (requestId: string) => {
        approveRequest(
            { requestId },
            {
                onSuccess: () => {
                    addToast(t('teamRequests.approved'), 'success');
                },
                onError: (error: unknown) => {
                    const raw = error instanceof Error ? error.message : undefined;
                    addToast(
                        raw?.trim()
                            ? resolveApiErrorToastMessage(raw)
                            : t('teamRequests.approveFailed'),
                        'error',
                    );
                },
            }
        );
    };

    const handleRejectRequest = (requestId: string) => {
        if (confirm(t('teamRequests.confirmReject'))) {
            rejectRequest(
                { requestId },
                {
                    onSuccess: () => {
                        addToast(t('teamRequests.rejected'), 'success');
                    },
                    onError: (error: unknown) => {
                        const raw = error instanceof Error ? error.message : undefined;
                        addToast(
                            raw?.trim()
                                ? resolveApiErrorToastMessage(raw)
                                : t('teamRequests.rejectFailed'),
                            'error',
                        );
                    },
                }
            );
        }
    };

    const backTarget = sanitizeMeriterInternalPath(returnTo) ?? routes.community(communityId);

    const renderMemberRow = (member: CommunityMember) => (
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
                <div className="absolute right-2 top-1/2 z-10 flex -translate-y-1/2 flex-row-reverse items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    {member.id !== user?.id && (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                handleRemoveMember(member.id, member.displayName || member.username);
                            }}
                            disabled={isRemoving}
                            className="rounded-full p-2 text-red-500 transition-colors hover:bg-red-50"
                            title={t('members.remove')}
                        >
                            {isRemoving ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <UserX className="h-4 w-4" />
                            )}
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMember({
                                id: member.id,
                                name: member.displayName || member.username,
                            });
                            setAddMeritsDialogOpen(true);
                        }}
                        className="rounded-full p-2 text-primary transition-colors hover:bg-primary/10"
                        title={t('members.addMerits')}
                    >
                        <Coins className="h-4 w-4" />
                    </button>
                    {(leadManagementAllowed || isPlatformSuperadmin) &&
                        member.id === user?.id &&
                        member.role === 'lead' && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    if (isPlatformSuperadmin) {
                                        setSuperadminDemote({
                                            userId: member.id,
                                            name: member.displayName || member.username,
                                            variant: 'self',
                                        });
                                    } else {
                                        setDemoteSelfLeadOpen(true);
                                    }
                                }}
                                className="rounded-full p-2 text-base-content transition-colors hover:bg-base-200"
                                title={tLeadActions('demoteSelfFromLead')}
                            >
                                <UserMinus className="h-4 w-4" />
                            </button>
                        )}
                    {isPlatformSuperadmin &&
                        member.id !== user?.id &&
                        member.role === 'lead' && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setSuperadminDemote({
                                        userId: member.id,
                                        name: member.displayName || member.username,
                                        variant: 'other',
                                    });
                                }}
                                className="rounded-full p-2 text-violet-600 transition-colors hover:bg-violet-500/10 dark:text-violet-400"
                                title={tLeadActions('superadminRemoveLeadShort')}
                            >
                                <ShieldOff className="h-4 w-4" />
                            </button>
                        )}
                    {(leadManagementAllowed || isPlatformSuperadmin) &&
                        member.id !== user?.id &&
                        member.role === 'participant' && (
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setPromoteLeadTarget({
                                        id: member.id,
                                        name: member.displayName || member.username,
                                    });
                                }}
                                className="rounded-full p-2 text-amber-600 transition-colors hover:bg-amber-500/10 dark:text-amber-400"
                                title={tLeadActions('promoteToLead')}
                            >
                                <Shield className="h-4 w-4" />
                            </button>
                        )}
                </div>
            )}
        </div>
    );

    const pageHeader = (
        <SimpleStickyHeader
            title={t('members.title')}
            showBack={true}
            onBack={() => router.push(backTarget)}
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
                        {allowsJoinRequests && isAdmin && requests.length > 0 ? (
                            <section className="mb-4 space-y-2">
                                <h3 className="px-1 text-sm font-medium text-base-content/60">
                                    {t('teamRequests.title')}
                                </h3>
                                <div className="space-y-2">
                                    {requests.map((request) => (
                                        <TeamRequestCard
                                            key={request.id}
                                            request={request as TeamJoinRequest}
                                            onApprove={handleApproveRequest}
                                            onReject={handleRejectRequest}
                                            isApproving={isApproving}
                                            isRejecting={isRejecting}
                                        />
                                    ))}
                                </div>
                                <Separator className="my-4" />
                            </section>
                        ) : null}

                        <div className="mb-4 flex flex-col gap-3">
                            <CommunityJoinRequestPanel
                                communityId={communityId}
                                layout="compact"
                                entityKind={isProjectMembersUi ? 'project' : 'community'}
                                className="max-w-md sm:max-w-none"
                            />
                            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                                {canCreateInviteLink ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="shrink-0 gap-2"
                                        disabled={createInviteMutation.isPending}
                                        onClick={() => createInviteMutation.mutate({ communityId })}
                                    >
                                        {createInviteMutation.isPending ? (
                                            <Loader2 className="h-4 w-4 animate-spin" />
                                        ) : (
                                            <UserPlus className="h-4 w-4" />
                                        )}
                                        {isProjectMembersUi ? tProjects('inviteToProject') : t('members.invite.button')}
                                    </Button>
                                ) : null}
                                {canShowLeaveCommunity ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="shrink-0 gap-2 border-destructive/40 text-destructive hover:bg-destructive/10"
                                        onClick={() => setLeaveCommunityOpen(true)}
                                    >
                                        <LogOut className="h-4 w-4" />
                                        {t('members.leaveCommunity')}
                                    </Button>
                                ) : null}
                            </div>
                            <SearchInput
                                placeholder={tSearch('results.searchMembersPlaceholder')}
                                value={searchQuery}
                                onSearch={setSearchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full"
                            />
                        </div>

                        {members.length > 0 ? (
                            <div className="space-y-6">
                                {adminMembers.length > 0 && (
                                    <section className="space-y-2">
                                        <h3 className="px-1 text-sm font-medium text-base-content/60">
                                            {t('members.sectionAdmins')}
                                        </h3>
                                        <div className="overflow-hidden rounded-lg bg-base-100 shadow-none">
                                            {adminMembers.map(renderMemberRow)}
                                        </div>
                                    </section>
                                )}
                                {participantMembers.length > 0 && (
                                    <section className="space-y-2">
                                        <h3 className="px-1 text-sm font-medium text-base-content/60">
                                            {t('members.sectionParticipants')}
                                        </h3>
                                        <div className="overflow-hidden rounded-lg bg-base-100 shadow-none">
                                            {participantMembers.map(renderMemberRow)}
                                        </div>
                                    </section>
                                )}
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

            <CommunityPromoteLeadDialog
                communityId={communityId}
                open={!!promoteLeadTarget}
                onOpenChange={(open) => {
                    if (!open) setPromoteLeadTarget(null);
                }}
                targetUserId={promoteLeadTarget?.id ?? null}
                targetName={promoteLeadTarget?.name ?? ''}
            />
            <CommunityDemoteSelfLeadDialog
                communityId={communityId}
                open={demoteSelfLeadOpen}
                onOpenChange={setDemoteSelfLeadOpen}
            />
            <CommunitySuperadminDemoteToParticipantDialog
                communityId={communityId}
                open={!!superadminDemote}
                onOpenChange={(open) => {
                    if (!open) setSuperadminDemote(null);
                }}
                targetUserId={superadminDemote?.userId ?? null}
                targetName={superadminDemote?.name ?? ''}
                variant={superadminDemote?.variant ?? 'other'}
            />

            <Dialog open={leaveCommunityOpen} onOpenChange={setLeaveCommunityOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>{t('members.leaveCommunityTitle')}</DialogTitle>
                        <DialogDescription className="text-left text-base text-base-content/90">
                            {t('members.leaveCommunityWarning')}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="gap-2 sm:justify-end">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setLeaveCommunityOpen(false)}
                            disabled={leaveCommunity.isPending}
                        >
                            {t('members.leaveCommunityCancel')}
                        </Button>
                        <Button
                            type="button"
                            variant="destructive"
                            className="gap-2"
                            disabled={leaveCommunity.isPending}
                            onClick={() => {
                                leaveCommunity.mutate(
                                    { id: communityId },
                                    {
                                        onSuccess: () => {
                                            setLeaveCommunityOpen(false);
                                            addToast(t('members.leaveCommunitySuccess'), 'success');
                                            router.push(routes.community(communityId));
                                        },
                                        onError: (err) => {
                                            addToast(
                                                err.message?.trim()
                                                    ? resolveApiErrorToastMessage(err.message)
                                                    : t('members.leaveCommunity'),
                                                'error',
                                            );
                                        },
                                    },
                                );
                            }}
                        >
                            {leaveCommunity.isPending ? (
                                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
                            ) : null}
                            {leaveCommunity.isPending
                                ? t('members.leaveCommunitySubmitting')
                                : t('members.leaveCommunityConfirm')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
                <DialogContent className="sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>
                            {isProjectMembersUi ? tProjects('inviteToProject') : t('members.invite.dialogTitle')}
                        </DialogTitle>
                        <DialogDescription>
                            {isProjectMembersUi ? tProjects('inviteToProjectHint') : t('members.invite.dialogHint')}
                        </DialogDescription>
                    </DialogHeader>
                    <Input readOnly value={inviteUrl} className="font-mono text-xs" />
                    <DialogFooter className="gap-2 sm:gap-0">
                        <Button
                            type="button"
                            variant="secondary"
                            className="gap-2"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(inviteUrl);
                                    addToast(t('members.invite.copied'), 'success');
                                } catch {
                                    addToast(t('members.invite.copyFailed'), 'error');
                                }
                            }}
                        >
                            <Copy className="h-4 w-4" />
                            {t('members.invite.copyLink')}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </AdaptiveLayout>
    );
}

