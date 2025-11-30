import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useQueryClient } from '@tanstack/react-query';
import { useCommunity, useUpdateCommunity, useCreateCommunity } from '@/hooks/api/useCommunities';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCreateInvite } from '@/hooks/api/useInvites';
import { HashtagInput } from '@/shared/components/HashtagInput';
import { PageHeader } from '@/components/ui/PageHeader';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { Loader2, X, Copy, Check } from 'lucide-react';
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
    const createInvite = useCreateInvite();
    const addToast = useToastStore((state) => state.addToast);

    const isEditMode = !!communityId;
    const { data: community, isLoading } = useCommunity(communityId || '');
    const updateCommunity = useUpdateCommunity();
    const createCommunity = useCreateCommunity();

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
    
    // Invite generation state
    const [inviteTargetUserId, setInviteTargetUserId] = useState('');
    const [inviteExpiresInDays, setInviteExpiresInDays] = useState<number | ''>(30);
    const [generatedInvite, setGeneratedInvite] = useState<{ code: string } | null>(null);
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
        }
    }, [community, isEditMode]);

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
                    data,
                });
                router.push(`/meriter/communities/${communityId}`);
            } else {
                const result = await createCommunity.mutateAsync(data);

                // Invalidate communities list to refresh it
                queryClient.invalidateQueries({ queryKey: ['communities'] });
                queryClient.invalidateQueries({ queryKey: ['wallets'] });

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

    // Superadmin can create invites for leads in any community
    // Lead can create invites for participants in their community
    const canGenerateInvites = isEditMode && (isSuperadmin || isUserLead);
    const inviteType = isSuperadmin ? 'superadmin-to-lead' : 'lead-to-participant';

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

                <div className="border-t border-gray-200 pt-6">
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

                {isEditMode && (
                    <>
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                {t('administrators')}
                            </h2>

                            <div className="space-y-2 mb-4">
                                {adminIds.map((adminId) => (
                                    <div
                                        key={adminId}
                                        className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
                                    >
                                        <p className="text-sm text-brand-text-primary">{adminId}</p>
                                        <BrandButton
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => handleRemoveAdmin(adminId)}
                                        >
                                            <X size={16} />
                                        </BrandButton>
                                    </div>
                                ))}
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

                        {canGenerateInvites && (
                            <div className="border-t border-gray-200 pt-6">
                                <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                    {tInvites('title')}
                                </h2>

                                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-sm text-blue-800">
                                        {isSuperadmin 
                                            ? tInvites('superadminToLeadDescription') || 'Create an invite to make a user a Lead (Representative) of this community'
                                            : tInvites('leadToParticipantDescription') || 'Create an invite to add a participant to this team community'
                                        }
                                    </p>
                                </div>

                                <div className="space-y-4">
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
                                            <p className="font-mono text-sm text-brand-text-secondary break-all">
                                                {generatedInvite.code}
                                            </p>
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
                                        disabled={!inviteTargetUserId.trim() || createInvite.isPending}
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
