import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient, useQueries } from '@tanstack/react-query';
import { useCommunity, useUpdateCommunity, useCreateCommunity, useCommunityMembers, useRemoveCommunityMember, useResetDailyQuota } from '@/hooks/api';
import type { CommunityMember } from '@/hooks/api/useCommunityMembers';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles, useCanCreateCommunity } from '@/hooks/api/useProfile';
import { useCreateInvite, useCommunityInvites } from '@/hooks/api/useInvites';
import { useUserProfile } from '@/hooks/api/useUsers';
import { usersApiV1 } from '@/lib/api/v1';
import { queryKeys } from '@/lib/constants/queryKeys';
import { HashtagInput } from '@/shared/components/HashtagInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { BrandCheckbox } from '@/components/ui/BrandCheckbox';
import { Loader2, X, Copy, Check, UserX, CheckCircle2, Clock } from 'lucide-react';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { useToastStore } from '@/shared/stores/toast.store';
import { extractErrorMessage } from '@/shared/lib/utils/error-utils';

interface CommunityFormProps {
    communityId?: string; // Если нет - создание, если есть - редактирование
}

export const CommunityForm = ({ communityId }: CommunityFormProps) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const t = useTranslations('pages.communitySettings');
    const tCreate = useTranslations('communities.create');
    const tInvites = useTranslations('invites.create');

    const { user } = useAuth();
    const { data: userRoles } = useUserRoles(user?.id || '');
    const { canCreate: canCreateCommunity, isLoading: permissionLoading } = useCanCreateCommunity();
    const createInvite = useCreateInvite();
    const addToast = useToastStore((state) => state.addToast);

    const isEditMode = !!communityId && communityId !== 'create';
    const { data: community, isLoading } = useCommunity(isEditMode ? communityId : '');
    const updateCommunity = useUpdateCommunity();
    const createCommunity = useCreateCommunity();
    const resetDailyQuota = useResetDailyQuota();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [currencySingular, setCurrencySingular] = useState('merit');
    const [currencyPlural, setCurrencyPlural] = useState('merits');
    const [currencyGenitive, setCurrencyGenitive] = useState('merits');
    const [dailyEmission, setDailyEmission] = useState('100');
    const [language, setLanguage] = useState<'en' | 'ru'>('en');
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [adminIds, setAdminIds] = useState<string[]>([]);
    const [newAdminId, setNewAdminId] = useState('');
    const [isPriority, setIsPriority] = useState(false);
    
    // Invite generation state
    const [inviteTargetUserId, setInviteTargetUserId] = useState('');
    const [inviteTargetUserName, setInviteTargetUserName] = useState('');
    const [useUserName, setUseUserName] = useState(false); // Toggle between User ID and User Name
    const [inviteExpiresInDays, setInviteExpiresInDays] = useState<number | ''>(30);
    const [inviteRole, setInviteRole] = useState<'lead' | 'participant'>('lead'); // Role selection for superadmin
    const [generatedInvite, setGeneratedInvite] = useState<{ 
        code: string; 
        targetUserId?: string; 
        targetUserName?: string;
    } | null>(null);
    const [inviteCopied, setInviteCopied] = useState(false);

    useEffect(() => {
        if (community && isEditMode) {
            setName(community.name);
            setDescription(community.description || '');
            setAvatarUrl(community.avatarUrl || '');
            setCurrencySingular(community.settings?.currencyNames?.singular || 'merit');
            setCurrencyPlural(community.settings?.currencyNames?.plural || 'merits');
            setCurrencyGenitive(community.settings?.currencyNames?.genitive || 'merits');
            setDailyEmission(String(community.settings?.dailyEmission || 100));
            setLanguage((community.settings?.language as 'en' | 'ru') || 'en');
            setHashtags(community.hashtags || []);
            setAdminIds((community as any).adminIds || []);
            setIsPriority((community as any).isPriority || false);
        }
    }, [community, isEditMode]);

    // Load admin user profiles (after adminIds is set)
    const adminQueries = useQueries({
        queries: adminIds.map((adminId) => ({
            queryKey: queryKeys.users.profile(adminId),
            queryFn: () => usersApiV1.getUser(adminId),
            enabled: !!adminId && isEditMode,
        })),
    });

    // Create a map of adminId -> user data
    const adminUsersMap = useMemo(() => {
        const map = new Map<string, { name: string; id: string }>();
        adminIds.forEach((adminId, index) => {
            const userData = adminQueries[index]?.data;
            if (userData) {
                const displayName = userData.displayName || userData.firstName || userData.username || adminId;
                map.set(adminId, { name: displayName, id: adminId });
            } else {
                map.set(adminId, { name: adminId, id: adminId });
            }
        });
        return map;
    }, [adminIds, adminQueries]);

    const handleAddAdmin = () => {
        if (newAdminId && !adminIds.includes(newAdminId)) {
            setAdminIds([...adminIds, newAdminId]);
            setNewAdminId('');
        }
    };

    const handleRemoveAdmin = (id: string) => {
        setAdminIds(adminIds.filter(adminId => adminId !== id));
    };

    const handleGenerateAvatar = () => {
        const seed = encodeURIComponent(name || 'community');
        const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
        setAvatarUrl(avatarUrl);
    };

    const handleSubmit = async () => {
        try {
            const data = {
                name,
                description,
                avatarUrl: avatarUrl || undefined,
                hashtags,
                settings: {
                    currencyNames: {
                        singular: currencySingular,
                        plural: currencyPlural,
                        genitive: currencyGenitive,
                    },
                    dailyEmission: parseInt(dailyEmission, 10),
                    language,
                },
                ...(isEditMode && { adminIds }),
            };

            if (isEditMode) {
                await updateCommunity.mutateAsync({
                    id: communityId!,
                    data: {
                        ...data,
                        ...(isSuperadmin && { isPriority }),
                    },
                });
                router.push(`/meriter/communities/${communityId}`);
            } else {
                const createData = {
                    ...data,
                    ...(isSuperadmin && { isPriority }),
                };
                const result = await createCommunity.mutateAsync(createData);

                // Note: Invalidation is handled in useCreateCommunity hook's onSuccess
                // No need to invalidate here as it's already done in the mutation hook

                addToast(tCreate('success'), 'success');
                router.push(`/meriter/communities/${result.id}`);
            }
        } catch (error) {
            console.error(`Failed to ${isEditMode ? 'update' : 'create'} community:`, error);
            const errorMessage = extractErrorMessage(error, tCreate('errors.createFailed'));
            addToast(errorMessage, 'error');
        }
    };

    const isPending = isEditMode ? updateCommunity.isPending : createCommunity.isPending;

    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === 'superadmin';

    // Check if user is lead/admin of this community
    const isUserLead = useMemo(() => {
        if (!communityId || !user?.id || !userRoles) return false;
        const role = userRoles.find(r => r.communityId === communityId);
        // User is lead if they have 'lead' role OR are in adminIds
        return role?.role === 'lead' || community?.adminIds?.includes(user.id);
    }, [communityId, user?.id, userRoles, community?.adminIds]);

    // Superadmin can create invites for leads or participants in any community
    // Lead can create invites for participants in their community
    const canGenerateInvites = isEditMode && (isSuperadmin || isUserLead);
    // Superadmin can choose role, non-superadmin can only invite participants
    const inviteType = isSuperadmin 
        ? (inviteRole === 'lead' ? 'superadmin-to-lead' : 'lead-to-participant')
        : 'lead-to-participant';

    // Get community members and invites for settings page
    const { data: membersData, isLoading: membersLoading } = useCommunityMembers(isEditMode ? communityId : '');
    const { data: communityInvites = [] } = useCommunityInvites(isEditMode ? communityId : '');
    const { mutate: removeMember, isPending: isRemoving } = useRemoveCommunityMember(isEditMode ? communityId : '');

    // Create a map of userId -> invite status
    const memberInviteMap = useMemo(() => {
        const map = new Map<string, { isUsed: boolean; inviteCode?: string; targetUserName?: string }>();
        communityInvites.forEach((invite) => {
            // Match by targetUserId (for existing users) or usedBy (for used invites)
            // If invite was used, use usedBy; otherwise use targetUserId
            const userId = invite.isUsed ? invite.usedBy : invite.targetUserId;
            if (userId) {
                map.set(userId, {
                    isUsed: invite.isUsed || false,
                    inviteCode: invite.code,
                    targetUserName: invite.targetUserName,
                });
            }
        });
        return map;
    }, [communityInvites]);

    // Create combined list of members and pending invites
    const allMembersAndInvites = useMemo(() => {
        const members = membersData?.data || [];
        const memberIds = new Set(members.map(m => m.id));
        
        // Add pending invites for users not yet in members list
        const pendingInvites = communityInvites
            .filter(invite => !invite.isUsed)
            .map(invite => {
                // If invite has targetUserId and user is not in members, add as pending
                if (invite.targetUserId && !memberIds.has(invite.targetUserId)) {
                    return {
                        id: `invite-${invite.id}`,
                        username: invite.targetUserId,
                        displayName: invite.targetUserId,
                        avatarUrl: undefined,
                        globalRole: '',
                        isPendingInvite: true,
                        inviteCode: invite.code,
                        targetUserName: invite.targetUserName,
                        inviteType: invite.type,
                    };
                }
                // If invite has targetUserName (new user), add as pending
                if (invite.targetUserName && !invite.targetUserId) {
                    return {
                        id: `invite-${invite.id}`,
                        username: invite.targetUserName,
                        displayName: invite.targetUserName,
                        avatarUrl: undefined,
                        globalRole: '',
                        isPendingInvite: true,
                        inviteCode: invite.code,
                        targetUserName: invite.targetUserName,
                        inviteType: invite.type,
                    };
                }
                return null;
            })
            .filter(Boolean) as Array<CommunityMember & { isPendingInvite?: boolean; inviteCode?: string; targetUserName?: string; inviteType?: string }>;
        
        return [...members, ...pendingInvites];
    }, [membersData?.data, communityInvites]);

    const handleRemoveMember = (userId: string, userName: string) => {
        if (confirm(t('members.confirmRemove', { name: userName }) || `Remove ${userName} from community?`)) {
            removeMember(userId);
        }
    };

    const handleGenerateInvite = async () => {
        if (!communityId) return;

        try {
            const expiresAt = inviteExpiresInDays && inviteExpiresInDays > 0
                ? new Date(Date.now() + inviteExpiresInDays * 24 * 60 * 60 * 1000).toISOString()
                : undefined;

            const inviteData: any = {
                type: inviteType,
                communityId,
                expiresAt,
            };

            // Only include targetUserId or targetUserName if provided
            if (useUserName && inviteTargetUserName.trim()) {
                inviteData.targetUserName = inviteTargetUserName.trim();
            } else if (!useUserName && inviteTargetUserId.trim()) {
                inviteData.targetUserId = inviteTargetUserId.trim();
            }

            const invite = await createInvite.mutateAsync(inviteData);

            setGeneratedInvite({ 
                code: invite.code,
                targetUserId: invite.targetUserId,
                targetUserName: invite.targetUserName,
            });
            setInviteCopied(false);
            addToast(tInvites('success'), 'success');
        } catch (error) {
            console.error('Failed to create invite:', error);
            const errorMessage = extractErrorMessage(error, tInvites('errors.createFailed'));
            addToast(errorMessage, 'error');
        }
    };

    const handleCopyInviteCode = () => {
        if (generatedInvite?.code) {
            navigator.clipboard.writeText(generatedInvite.code);
            setInviteCopied(true);
            setTimeout(() => setInviteCopied(false), 2000);
        }
    };

    const handleResetDailyQuota = async () => {
        if (!communityId) return;
        
        const confirmed = confirm(t('resetQuotaConfirm'));
        if (!confirmed) return;

        try {
            await resetDailyQuota.mutateAsync(communityId);
            addToast(t('resetQuotaSuccess'), 'success');
        } catch (error) {
            console.error('Failed to reset daily quota:', error);
            const errorMessage = extractErrorMessage(error, t('resetQuotaError'));
            addToast(errorMessage, 'error');
        }
    };

    if (isEditMode && isLoading) {
        return (
            <div className="flex justify-center items-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
        );
    }

    if (isEditMode && !community) {
        return (
            <div className="p-4">
                <p className="text-brand-text-secondary">{t('communityNotFound')}</p>
            </div>
        );
    }

    // Guard: Check permission for create mode
    if (!isEditMode) {
        if (permissionLoading) {
            return (
                <div className="flex justify-center items-center min-h-[400px]">
                    <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
                </div>
            );
        }

        if (!canCreateCommunity) {
            return (
                <div className="p-4">
                    <div className="max-w-2xl mx-auto">
                        <PageHeader title={tCreate('title')} showBack={true} />
                        <div className="mt-6 p-6 bg-base-200 rounded-lg border border-base-300">
                            <p className="text-brand-text-primary text-lg font-medium mb-2">
                                Access Restricted
                            </p>
                            <p className="text-brand-text-secondary">
                                Only organizers and team leads can create communities. Contact an organizer if you want to create a team.
                            </p>
                        </div>
                    </div>
                </div>
            );
        }
    }

    const pageTitle = isEditMode
        ? t('settingsTitle', { communityName: community?.name })
        : tCreate('title');

    return (
        <div className="flex-1">
            <PageHeader title={pageTitle} showBack={true} />

            <div className="p-4 space-y-6">
                <BrandFormControl label={t('name')} required>
                    <BrandInput
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('namePlaceholder')}
                        fullWidth
                    />
                </BrandFormControl>

                <BrandFormControl label={t('description')}>
                    <BrandInput
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder={t('descriptionPlaceholder')}
                        fullWidth
                    />
                </BrandFormControl>

                <BrandFormControl
                    label={t('avatarUrl')}
                    helperText={t('generateAvatarHelp')}
                >
                    <div className="flex gap-2">
                        <BrandInput
                            value={avatarUrl}
                            onChange={(e) => setAvatarUrl(e.target.value)}
                            placeholder={t('avatarUrlPlaceholder')}
                            fullWidth
                        />
                        <BrandButton
                            variant="outline"
                            onClick={handleGenerateAvatar}
                        >
                            {t('generateAvatar')}
                        </BrandButton>
                    </div>
                </BrandFormControl>

                <HashtagInput
                    value={hashtags}
                    onChange={setHashtags}
                    label={t('hashtags')}
                    placeholder={t('hashtagsPlaceholder')}
                    helperText={t('hashtagsHelp')}
                />

                <div className="border-t border-base-300 pt-6">
                    <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                        {t('configuration')}
                    </h2>

                    <div className="space-y-6">
                        <BrandFormControl label={t('language')}>
                            <BrandSelect
                                value={language}
                                onChange={(val) => setLanguage(val as 'en' | 'ru')}
                                options={[
                                    { label: t('languageOption.en'), value: 'en' },
                                    { label: t('languageOption.ru'), value: 'ru' },
                                ]}
                                placeholder={t('languageSelect')}
                                fullWidth
                            />
                        </BrandFormControl>

                        <BrandFormControl
                            label={t('dailyEmission')}
                            helperText={t('dailyEmissionHelp')}
                        >
                            <BrandInput
                                type="number"
                                value={dailyEmission}
                                onChange={(e) => setDailyEmission(e.target.value)}
                                fullWidth
                            />
                        </BrandFormControl>

                        {isEditMode && isUserLead && (
                            <BrandFormControl
                                label={t('resetQuota')}
                                helperText={t('resetQuotaDescription')}
                            >
                                <BrandButton
                                    variant="outline"
                                    size="md"
                                    onClick={handleResetDailyQuota}
                                    disabled={resetDailyQuota.isPending}
                                    isLoading={resetDailyQuota.isPending}
                                >
                                    {resetDailyQuota.isPending ? t('saving') : t('resetQuota')}
                                </BrandButton>
                            </BrandFormControl>
                        )}

                        <div>
                            <h3 className="text-base font-semibold text-brand-text-primary mb-3">
                                {t('currencyNames')}
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <BrandFormControl label={t('singular')}>
                                    <BrandInput
                                        value={currencySingular}
                                        onChange={(e) => setCurrencySingular(e.target.value)}
                                        fullWidth
                                    />
                                </BrandFormControl>
                                <BrandFormControl label={t('plural')}>
                                    <BrandInput
                                        value={currencyPlural}
                                        onChange={(e) => setCurrencyPlural(e.target.value)}
                                        fullWidth
                                    />
                                </BrandFormControl>
                            </div>
                            <BrandFormControl label={t('genitive')}>
                                <BrandInput
                                    value={currencyGenitive}
                                    onChange={(e) => setCurrencyGenitive(e.target.value)}
                                    fullWidth
                                />
                            </BrandFormControl>
                        </div>
                    </div>
                </div>

                {isSuperadmin && !isEditMode && (
                    <div className="border-t border-gray-200 pt-6">
                        <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                            {t('prioritySettings') || 'Priority Settings'}
                        </h2>
                        <BrandFormControl helperText={t('priorityHelp') || 'Priority communities are displayed first in the list'}>
                            <BrandCheckbox
                                checked={isPriority}
                                onChange={(checked) => setIsPriority(checked)}
                                label={t('isPriority') || 'Mark as priority community'}
                                disabled={isPending}
                            />
                        </BrandFormControl>
                    </div>
                )}

                {isEditMode && (
                    <>
                        <div className="border-t border-base-300 pt-6">
                            <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                {t('administrators')}
                            </h2>

                            <div className="space-y-2 mb-4">
                                {adminIds.map((adminId) => {
                                    const adminUser = adminUsersMap.get(adminId);
                                    const isLoading = adminQueries[adminIds.indexOf(adminId)]?.isLoading;
                                    const displayName = adminUser?.name || adminId;
                                    
                                    return (
                                        <div
                                            key={adminId}
                                            className="flex items-center justify-between p-3 border border-base-300 rounded-lg"
                                        >
                                            <div className="flex items-center gap-2">
                                                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-brand-text-secondary" />}
                                                <p className="text-sm text-brand-text-primary">
                                                    {displayName} <span className="text-brand-text-secondary">({adminId})</span>
                                                </p>
                                            </div>
                                            <BrandButton
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleRemoveAdmin(adminId)}
                                            >
                                                <X size={16} />
                                            </BrandButton>
                                        </div>
                                    );
                                })}
                                {adminIds.length === 0 && (
                                    <p className="text-sm text-brand-text-secondary">{t('noAdmins')}</p>
                                )}
                            </div>

                            <BrandFormControl label={t('addAdmin')}>
                                <div className="flex gap-2">
                                    <BrandInput
                                        value={newAdminId}
                                        onChange={(e) => setNewAdminId(e.target.value)}
                                        placeholder={t('addAdminPlaceholder')}
                                        fullWidth
                                    />
                                    <BrandButton
                                        variant="primary"
                                        onClick={handleAddAdmin}
                                        disabled={!newAdminId}
                                    >
                                        {t('add')}
                                    </BrandButton>
                                </div>
                            </BrandFormControl>
                        </div>

                        {isSuperadmin && (
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                    {t('prioritySettings') || 'Priority Settings'}
                                </h2>
                                <BrandFormControl helperText={t('priorityHelp') || 'Priority communities are displayed first in the list'}>
                                    <BrandCheckbox
                                        checked={isPriority}
                                        onChange={(checked) => setIsPriority(checked)}
                                        label={t('isPriority') || 'Mark as priority community'}
                                        disabled={isPending}
                                    />
                                </BrandFormControl>
                            </div>
                        )}

                        {canGenerateInvites && (
                            <div className="border-t border-base-300 pt-6">
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                    {tInvites('title')}
                                </h2>

                                {isSuperadmin && (
                                    <BrandFormControl 
                                        label={tInvites('inviteRole') || 'Invite Role'}
                                        helperText={tInvites('inviteRoleHelp') || 'Select the role for the invited user'}
                                    >
                                        <div className="flex gap-2">
                                            <BrandButton
                                                variant={inviteRole === 'lead' ? "primary" : "outline"}
                                                onClick={() => setInviteRole('lead')}
                                                size="sm"
                                            >
                                                {tInvites('roleLead') || 'Lead'}
                                            </BrandButton>
                                            <BrandButton
                                                variant={inviteRole === 'participant' ? "primary" : "outline"}
                                                onClick={() => setInviteRole('participant')}
                                                size="sm"
                                            >
                                                {tInvites('roleParticipant') || 'Participant'}
                                            </BrandButton>
                                        </div>
                                    </BrandFormControl>
                                )}

                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        {isSuperadmin 
                                            ? (inviteRole === 'lead' 
                                                ? tInvites('superadminToLeadDescription') || 'Create an invite to make a user a Lead (Representative) of this community'
                                                : tInvites('leadToParticipantDescription') || 'Create an invite to add a participant to this team community')
                                            : tInvites('leadToParticipantDescription') || 'Create an invite to add a participant to this team community'
                                        }
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <BrandFormControl helperText={tInvites('inviteModeHelp') || 'Choose whether to invite an existing user by ID or a new user by name'}>
                                        <div className="flex gap-2">
                                            <BrandButton
                                                variant={!useUserName ? "primary" : "outline"}
                                                onClick={() => {
                                                    setUseUserName(false);
                                                    setInviteTargetUserName('');
                                                }}
                                                size="sm"
                                            >
                                                {tInvites('existingUser') || 'Existing User'}
                                            </BrandButton>
                                            <BrandButton
                                                variant={useUserName ? "primary" : "outline"}
                                                onClick={() => {
                                                    setUseUserName(true);
                                                    setInviteTargetUserId('');
                                                }}
                                                size="sm"
                                            >
                                                {tInvites('newUser') || 'New User'}
                                            </BrandButton>
                                        </div>
                                    </BrandFormControl>

                                    {!useUserName ? (
                                        <BrandFormControl 
                                            label={tInvites('targetUserId')}
                                            helperText={isSuperadmin 
                                                ? (inviteRole === 'lead' 
                                                    ? 'User ID who will become a Lead (Representative)'
                                                    : 'User ID who will become a Participant')
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
                                    ) : (
                                        <BrandFormControl 
                                            label={tInvites('targetUserName') || 'User Name'}
                                            helperText={isSuperadmin 
                                                ? (inviteRole === 'lead' 
                                                    ? 'Name of the new user who will become a Lead (Representative)'
                                                    : 'Name of the new user who will become a Participant')
                                                : 'Name of the new user who will become a Participant'
                                            }
                                        >
                                            <BrandInput
                                                value={inviteTargetUserName}
                                                onChange={(e) => setInviteTargetUserName(e.target.value)}
                                                placeholder={tInvites('targetUserNamePlaceholder') || 'Enter user name'}
                                                fullWidth
                                            />
                                        </BrandFormControl>
                                    )}

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
                                        <div className="p-4 bg-green-50 border border-green-200 rounded-lg space-y-3">
                                            <div className="flex items-center justify-between">
                                                <p className="text-sm font-semibold text-brand-text-primary">
                                                    {tInvites('generatedInvites')}
                                                </p>
                                                <BrandButton
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={handleCopyInviteCode}
                                                >
                                                    {inviteCopied ? (
                                                        <Check size={16} className="text-green-600" />
                                                    ) : (
                                                        <Copy size={16} />
                                                    )}
                                                </BrandButton>
                                            </div>
                                            <div className="space-y-2">
                                                <p className="font-mono text-sm text-brand-text-secondary break-all">
                                                    {generatedInvite.code}
                                                </p>
                                                {(generatedInvite.targetUserName || generatedInvite.targetUserId) && (
                                                    <p className="text-xs text-brand-text-secondary">
                                                        {tInvites('for') || 'For'}: {generatedInvite.targetUserName || generatedInvite.targetUserId}
                                                    </p>
                                                )}
                                            </div>
                                            {inviteCopied && (
                                                <p className="text-xs text-green-600">
                                                    {tInvites('invitesCopied')}
                                                </p>
                                            )}
                                        </div>
                                    )}

                                    <BrandButton
                                        variant="primary"
                                        size="lg"
                                        onClick={handleGenerateInvite}
                                        disabled={createInvite.isPending}
                                        isLoading={createInvite.isPending}
                                        fullWidth
                                    >
                                        {createInvite.isPending ? tInvites('creating') : tInvites('create')}
                                    </BrandButton>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Members Section - only in edit mode */}
                {isEditMode && (isSuperadmin || isUserLead) && (
                    <div className="mt-8 space-y-4">
                        <h2 className="text-xl font-semibold text-brand-text-primary">
                            {t('members.title') || 'Community Members'}
                        </h2>
                        
                        {membersLoading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                            </div>
                        ) : allMembersAndInvites && allMembersAndInvites.length > 0 ? (
                            <div className="space-y-2">
                                {allMembersAndInvites.map((member) => {
                                    const isPendingInvite = (member as any).isPendingInvite;
                                    const inviteInfo = isPendingInvite 
                                        ? { isUsed: false, inviteCode: (member as any).inviteCode, targetUserName: (member as any).targetUserName }
                                        : memberInviteMap.get(member.id);
                                    const hasInvite = !!inviteInfo || isPendingInvite;
                                    const inviteUsed = inviteInfo?.isUsed || false;
                                    
                                    return (
                                        <div
                                            key={member.id}
                                            className={`flex items-center justify-between p-3 bg-white border border-brand-secondary/10 rounded-lg shadow-sm hover:shadow-md transition-shadow ${isPendingInvite ? 'opacity-75' : ''}`}
                                        >
                                            <div className="flex items-center space-x-3 flex-1">
                                                <BrandAvatar
                                                    src={member.avatarUrl}
                                                    fallback={member.displayName || member.username}
                                                    size="md"
                                                />
                                                <div className="flex-1">
                                                    <div className="font-medium text-brand-text-primary">
                                                        {member.displayName || member.username}
                                                        {isPendingInvite && (
                                                            <span className="ml-2 text-xs text-amber-600">
                                                                ({t('members.invited') || 'Invited'})
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-xs text-brand-text-secondary flex items-center gap-2">
                                                        {!isPendingInvite && <span>@{member.username}</span>}
                                                        {member.globalRole && (
                                                            <>
                                                                {!isPendingInvite && <span>•</span>}
                                                                <span>{member.globalRole}</span>
                                                            </>
                                                        )}
                                                        {isPendingInvite && (member as any).inviteType && (
                                                            <>
                                                                <span>•</span>
                                                                <span>{(member as any).inviteType === 'superadmin-to-lead' ? 'Lead' : 'Participant'}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                    {hasInvite && (
                                                        <div className="flex items-center gap-2 mt-1">
                                                            {inviteUsed ? (
                                                                <div className="flex items-center gap-1 text-xs text-green-600">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>{t('members.inviteUsed') || 'Invite used'}</span>
                                                                </div>
                                                            ) : (
                                                                <div className="flex items-center gap-1 text-xs text-amber-600">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>{t('members.invitePending') || 'Invite pending'}</span>
                                                                </div>
                                                            )}
                                                            {inviteInfo?.inviteCode && (
                                                                <span className="text-xs text-brand-text-secondary font-mono">
                                                                    ({inviteInfo.inviteCode})
                                                                </span>
                                                            )}
                                                        </div>
                                                    )}
                                                    {!hasInvite && !isPendingInvite && (
                                                        <div className="text-xs text-brand-text-secondary mt-1">
                                                            {t('members.noInvite') || 'No invite'}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {!isPendingInvite && member.id !== user?.id && (
                                                <button
                                                    onClick={() => handleRemoveMember(member.id, member.displayName || member.username)}
                                                    disabled={isRemoving}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    title={t('members.remove') || 'Remove member'}
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
                                })}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-brand-text-secondary">
                                {t('members.noMembers') || 'No members yet'}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex justify-end pt-4">
                    <BrandButton
                        variant="primary"
                        size="lg"
                        onClick={handleSubmit}
                        disabled={!name || isPending}
                        isLoading={isPending}
                    >
                        {isPending
                            ? (isEditMode ? t('saving') : tCreate('creating'))
                            : (isEditMode ? t('saveChanges') : tCreate('createButton'))
                        }
                    </BrandButton>
                </div>
            </div>
        </div>
    );
};
