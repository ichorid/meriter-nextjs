import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
    useCommunity,
    useUpdateCommunity,
    useCreateCommunity,
    useCommunityMembers,
    useRemoveCommunityMember,
    useResetDailyQuota,
} from "@/hooks/api";
import type { CommunityMember } from "@/hooks/api/useCommunityMembers";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, useCanCreateCommunity } from "@/hooks/api/useProfile";
import { useCommunityInvites } from "@/hooks/api/useInvites";
import { useUserProfile } from "@/hooks/api/useUsers";
import { HashtagInput } from "@/shared/components/hashtag-input";
import { IconPicker } from "@/shared/components/iconpicker";
import { BrandButton } from "@/components/ui/BrandButton";
import { BrandInput } from "@/components/ui/BrandInput";
import { BrandSelect } from "@/components/ui/BrandSelect";
import { BrandFormControl } from "@/components/ui/BrandFormControl";
import { BrandCheckbox } from "@/components/ui/BrandCheckbox";
import { Loader2, X, UserX, CheckCircle2, Clock, Sparkles } from "lucide-react";
import { BrandAvatar } from "@/components/ui/BrandAvatar";
import { AvatarUploader } from "@/components/ui/AvatarUploader";
import { ImageUploader } from "@/components/ui/ImageUploader";
import { useToastStore } from "@/shared/stores/toast.store";
import { extractErrorMessage } from "@/shared/lib/utils/error-utils";

interface CommunityFormProps {
    communityId?: string; // Если нет - создание, если есть - редактирование
}

export const CommunityForm = ({ communityId }: CommunityFormProps) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const t = useTranslations("pages.communitySettings");
    const tCreate = useTranslations("communities.create");

    const { user } = useAuth();
    const { data: userRoles } = useUserRoles(user?.id || "");
    const { canCreate: canCreateCommunity, isLoading: permissionLoading } =
        useCanCreateCommunity();
    const addToast = useToastStore((state) => state.addToast);

    const isEditMode = !!communityId && communityId !== "create";
    const { data: community, isLoading } = useCommunity(
        isEditMode ? communityId : ""
    );
    const updateCommunity = useUpdateCommunity();
    const createCommunity = useCreateCommunity();
    const resetDailyQuota = useResetDailyQuota();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [currencySingular, setCurrencySingular] = useState("merit");
    const [currencyPlural, setCurrencyPlural] = useState("merits");
    const [currencyGenitive, setCurrencyGenitive] = useState("merits");
    const [dailyEmission, setDailyEmission] = useState("100");
    const [postCost, setPostCost] = useState("1");
    const [pollCost, setPollCost] = useState("1");
    const [hashtags, setHashtags] = useState<string[]>([]);
    const [isPriority, setIsPriority] = useState(false);
    // Default icon is "thanks" emoji (🙏)
    const defaultIconUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(
        "🙏"
    )}</text></svg>`;
    const [iconUrl, setIconUrl] = useState(defaultIconUrl);

    useEffect(() => {
        if (community && isEditMode) {
            const c = community as any;
            setName(c.name);
            setDescription(c.description || "");
            setAvatarUrl(c.avatarUrl || "");
            setCoverImageUrl(c.coverImageUrl || "");
            setCurrencySingular(c.settings?.currencyNames?.singular || "merit");
            setCurrencyPlural(c.settings?.currencyNames?.plural || "merits");
            setCurrencyGenitive(
                c.settings?.currencyNames?.genitive || "merits"
            );
            setDailyEmission(String(c.settings?.dailyEmission || 100));
            setPostCost(String(c.settings?.postCost ?? 1));
            setPollCost(String(c.settings?.pollCost ?? 1));
            setHashtags(c.hashtags || []);
            setIsPriority(c.isPriority || false);
            setIconUrl(c.settings?.iconUrl || defaultIconUrl);
        }
    }, [community, isEditMode]);

    const handleGenerateAvatar = () => {
        const seed = encodeURIComponent(name || "community");
        const avatarUrl = `https://api.dicebear.com/7.x/identicon/svg?seed=${seed}`;
        setAvatarUrl(avatarUrl);
    };

    const handleSubmit = async () => {
        try {
            const data = {
                name,
                description,
                avatarUrl: avatarUrl || undefined,
                coverImageUrl: coverImageUrl || undefined,
                hashtags,
                settings: {
                    iconUrl: iconUrl || defaultIconUrl,
                    currencyNames: {
                        singular: currencySingular,
                        plural: currencyPlural,
                        genitive: currencyGenitive,
                    },
                    dailyEmission: parseInt(dailyEmission, 10),
                    postCost: parseInt(postCost, 10),
                    pollCost: parseInt(pollCost, 10),
                },
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

                addToast(tCreate("success"), "success");
                router.push(`/meriter/communities/${result.id}`);
            }
        } catch (error) {
            console.error(
                `Failed to ${isEditMode ? "update" : "create"} community:`,
                error
            );
            const errorMessage = extractErrorMessage(
                error,
                tCreate("errors.createFailed")
            );
            addToast(errorMessage, "error");
        }
    };

    const isPending = isEditMode
        ? updateCommunity.isPending
        : createCommunity.isPending;

    // Check if user is superadmin
    const isSuperadmin = user?.globalRole === "superadmin";

    // Check if user is lead/admin of this community
    const isUserLead = useMemo(() => {
        if (!communityId || !user?.id || !userRoles) return false;
        const role = userRoles.find((r) => r.communityId === communityId);
        return role?.role === "lead";
    }, [communityId, user?.id, userRoles]);

    // Check if user can reset quota (superadmin OR lead role)
    const canResetQuota = useMemo(() => {
        return isSuperadmin || isUserLead;
    }, [isSuperadmin, isUserLead]);

    // Superadmin can create invites for leads or participants in any community
    // Lead can create invites for participants in their community
    // Only fetch invites if user has admin/lead permissions
    const canViewInvites = isSuperadmin || isUserLead;

    // Get community members and invites for settings page
    const { data: membersData, isLoading: membersLoading } =
        useCommunityMembers(isEditMode ? communityId : "");
    const { data: communityInvites = [] } = useCommunityInvites(
        isEditMode ? communityId : "",
        { enabled: canViewInvites }
    );
    const { mutate: removeMember, isPending: isRemoving } =
        useRemoveCommunityMember(isEditMode ? communityId : "");

    // Create a map of userId -> invite status
    const memberInviteMap = useMemo(() => {
        const map = new Map<
            string,
            { isUsed: boolean; inviteCode?: string; targetUserName?: string }
        >();
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
        const memberIds = new Set(members.map((m) => m.id));

        // Add pending invites for users not yet in members list
        const pendingInvites = communityInvites
            .filter((invite) => !invite.isUsed)
            .map((invite) => {
                // If invite has targetUserId and user is not in members, add as pending
                if (
                    invite.targetUserId &&
                    !memberIds.has(invite.targetUserId)
                ) {
                    return {
                        id: `invite-${invite.id}`,
                        username: invite.targetUserId,
                        displayName: invite.targetUserId,
                        avatarUrl: undefined,
                        globalRole: "",
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
                        globalRole: "",
                        isPendingInvite: true,
                        inviteCode: invite.code,
                        targetUserName: invite.targetUserName,
                        inviteType: invite.type,
                    };
                }
                return null;
            })
            .filter(Boolean) as Array<
            CommunityMember & {
                isPendingInvite?: boolean;
                inviteCode?: string;
                targetUserName?: string;
                inviteType?: string;
            }
        >;

        return [...members, ...pendingInvites];
    }, [membersData?.data, communityInvites]);

    const handleRemoveMember = (userId: string, userName: string) => {
        if (
            confirm(
                t("members.confirmRemove", { name: userName }) ||
                    `Remove ${userName} from community?`
            )
        ) {
            removeMember(userId);
        }
    };

    const handleResetDailyQuota = async () => {
        if (!communityId) return;

        const confirmed = confirm(t("resetQuotaConfirm"));
        if (!confirmed) return;

        try {
            await resetDailyQuota.mutateAsync(communityId);
            addToast(t("resetQuotaSuccess"), "success");
        } catch (error) {
            console.error("Failed to reset daily quota:", error);
            const errorMessage = extractErrorMessage(
                error,
                t("resetQuotaError")
            );
            addToast(errorMessage, "error");
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
                <p className="text-brand-text-secondary">
                    {t("communityNotFound")}
                </p>
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
                <div className="p-6 bg-base-200 rounded-lg border border-base-300">
                    <p className="text-brand-text-primary text-lg font-medium mb-2">
                        Access Restricted
                    </p>
                    <p className="text-brand-text-secondary">
                        Only organizers and team leads can create communities.
                        Contact an organizer if you want to create a team.
                    </p>
                </div>
            );
        }
    }

    return (
        <div className="flex-1 space-y-6">
            <BrandFormControl label={t("name")} required>
                <BrandInput
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    fullWidth
                />
            </BrandFormControl>

            <BrandFormControl label={t("description")}>
                <BrandInput
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    fullWidth
                />
            </BrandFormControl>

            <BrandFormControl
                label={t("avatarUrl")}
                helperText={t("generateAvatarHelp")}
            >
                <div className="flex items-center gap-4">
                    <AvatarUploader
                        value={avatarUrl}
                        onUpload={(url) => setAvatarUrl(url)}
                        size={80}
                        labels={{
                            upload: t("changeAvatar") || "Change avatar",
                            cropTitle: t("cropAvatar") || "Crop avatar",
                            cancel: t("cancel") || "Cancel",
                            save: t("save") || "Save",
                        }}
                    />
                    <BrandButton
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAvatar}
                        leftIcon={<Sparkles size={16} />}
                    >
                        {t("generateAvatar")}
                    </BrandButton>
                </div>
            </BrandFormControl>

            <BrandFormControl
                label={t("coverImage") || "Cover Image"}
                helperText={
                    t("coverImageHelp") ||
                    "Upload a cover image for your community"
                }
            >
                <ImageUploader
                    value={coverImageUrl}
                    onUpload={(url) => setCoverImageUrl(url)}
                    onRemove={() => setCoverImageUrl("")}
                    aspectRatio={3}
                    placeholder={
                        t("coverImagePlaceholder") ||
                        "Drop cover image here or click to upload"
                    }
                    labels={{
                        placeholder:
                            t("coverImagePlaceholder") ||
                            "Drop cover image here or click to upload",
                        uploading: t("uploading") || "Uploading...",
                        uploadFailed: t("uploadFailed") || "Upload failed",
                    }}
                />
            </BrandFormControl>

            <HashtagInput
                value={hashtags}
                onChange={setHashtags}
                label={t("hashtags")}
                placeholder={t("hashtagsPlaceholder")}
                helperText={t("hashtagsHelp")}
            />

            <div className="border-t border-base-300 pt-6">
                <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                    {t("configuration")}
                </h2>

                <div className="space-y-6">
                    <BrandFormControl
                        label={t("dailyEmission")}
                        helperText={t("dailyEmissionHelp")}
                    >
                        <BrandInput
                            type="number"
                            value={dailyEmission}
                            onChange={(e) => setDailyEmission(e.target.value)}
                            fullWidth
                        />
                    </BrandFormControl>

                    {(isSuperadmin || isUserLead) && (
                        <>
                            <BrandFormControl
                                label={t("postCost")}
                                helperText={t("postCostHelp")}
                            >
                                <BrandInput
                                    type="number"
                                    min="0"
                                    value={postCost}
                                    onChange={(e) =>
                                        setPostCost(e.target.value)
                                    }
                                    fullWidth
                                />
                            </BrandFormControl>

                            <BrandFormControl
                                label={t("pollCost")}
                                helperText={t("pollCostHelp")}
                            >
                                <BrandInput
                                    type="number"
                                    min="0"
                                    value={pollCost}
                                    onChange={(e) =>
                                        setPollCost(e.target.value)
                                    }
                                    fullWidth
                                />
                            </BrandFormControl>
                        </>
                    )}

                    {isEditMode && canResetQuota && (
                        <BrandFormControl
                            label={t("resetQuota")}
                            helperText={t("resetQuotaDescription")}
                        >
                            <BrandButton
                                variant="outline"
                                size="md"
                                onClick={handleResetDailyQuota}
                                disabled={resetDailyQuota.isPending}
                                isLoading={resetDailyQuota.isPending}
                            >
                                {resetDailyQuota.isPending
                                    ? t("saving")
                                    : t("resetQuota")}
                            </BrandButton>
                        </BrandFormControl>
                    )}

                    <div>
                        <h3 className="text-base font-semibold text-brand-text-primary mb-3">
                            {t("currencyNames")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BrandFormControl label={t("singular")}>
                                <BrandInput
                                    value={currencySingular}
                                    onChange={(e) =>
                                        setCurrencySingular(e.target.value)
                                    }
                                    fullWidth
                                />
                            </BrandFormControl>
                            <BrandFormControl label={t("plural")}>
                                <BrandInput
                                    value={currencyPlural}
                                    onChange={(e) =>
                                        setCurrencyPlural(e.target.value)
                                    }
                                    fullWidth
                                />
                            </BrandFormControl>
                        </div>
                        <BrandFormControl label={t("genitive")}>
                            <BrandInput
                                value={currencyGenitive}
                                onChange={(e) =>
                                    setCurrencyGenitive(e.target.value)
                                }
                                fullWidth
                            />
                        </BrandFormControl>
                    </div>

                    <BrandFormControl
                        label={t("currencyIcon")}
                        helperText={t("selectIcon")}
                    >
                        <IconPicker
                            icon={iconUrl}
                            cta={t("selectIcon")}
                            setIcon={setIconUrl}
                        />
                    </BrandFormControl>
                </div>
            </div>

            {isSuperadmin && !isEditMode && (
                <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                        {t("prioritySettings") || "Priority Settings"}
                    </h2>
                    <BrandFormControl
                        helperText={
                            t("priorityHelp") ||
                            "Priority communities are displayed first in the list"
                        }
                    >
                        <BrandCheckbox
                            checked={isPriority}
                            onChange={(checked) => setIsPriority(checked)}
                            label={
                                t("isPriority") || "Mark as priority community"
                            }
                            disabled={isPending}
                        />
                    </BrandFormControl>
                </div>
            )}

            {isEditMode && (
                <>
                    {isSuperadmin && (
                        <div className="border-t border-gray-200 pt-6">
                            <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                                {t("prioritySettings") || "Priority Settings"}
                            </h2>
                            <BrandFormControl
                                helperText={
                                    t("priorityHelp") ||
                                    "Priority communities are displayed first in the list"
                                }
                            >
                                <BrandCheckbox
                                    checked={isPriority}
                                    onChange={(checked) =>
                                        setIsPriority(checked)
                                    }
                                    label={
                                        t("isPriority") ||
                                        "Mark as priority community"
                                    }
                                    disabled={isPending}
                                />
                            </BrandFormControl>
                        </div>
                    )}
                </>
            )}

            {/* Members Section - only in edit mode */}
            {isEditMode && (isSuperadmin || isUserLead) && (
                <div className="mt-8 space-y-4">
                    <h2 className="text-xl font-semibold text-brand-text-primary">
                        {t("members.title") || "Community Members"}
                    </h2>

                    {membersLoading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
                        </div>
                    ) : allMembersAndInvites &&
                      allMembersAndInvites.length > 0 ? (
                        <div className="space-y-2">
                            {allMembersAndInvites.map((member) => {
                                const isPendingInvite = (member as any)
                                    .isPendingInvite;
                                const inviteInfo = isPendingInvite
                                    ? {
                                          isUsed: false,
                                          inviteCode: (member as any)
                                              .inviteCode,
                                          targetUserName: (member as any)
                                              .targetUserName,
                                      }
                                    : memberInviteMap.get(member.id);
                                const hasInvite =
                                    !!inviteInfo || isPendingInvite;
                                const inviteUsed = inviteInfo?.isUsed || false;

                                return (
                                    <div
                                        key={member.id}
                                        className={`flex items-center justify-between p-3 bg-base-100 border border-brand-secondary/10 rounded-lg shadow-sm hover:shadow-md transition-shadow ${
                                            isPendingInvite ? "opacity-75" : ""
                                        }`}
                                    >
                                        <div className="flex items-center space-x-3 flex-1">
                                            <BrandAvatar
                                                src={member.avatarUrl}
                                                fallback={
                                                    member.displayName ||
                                                    member.username
                                                }
                                                size="md"
                                            />
                                            <div className="flex-1">
                                                <div className="font-medium text-brand-text-primary">
                                                    {member.displayName ||
                                                        member.username}
                                                    {isPendingInvite && (
                                                        <span className="ml-2 text-xs text-amber-600">
                                                            (
                                                            {t(
                                                                "members.invited"
                                                            ) || "Invited"}
                                                            )
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-xs text-brand-text-secondary flex items-center gap-2">
                                                    {!isPendingInvite && (
                                                        <span>
                                                            @{member.username}
                                                        </span>
                                                    )}
                                                    {member.globalRole && (
                                                        <>
                                                            {!isPendingInvite && (
                                                                <span>•</span>
                                                            )}
                                                            <span>
                                                                {
                                                                    member.globalRole
                                                                }
                                                            </span>
                                                        </>
                                                    )}
                                                    {isPendingInvite &&
                                                        (member as any)
                                                            .inviteType && (
                                                            <>
                                                                <span>•</span>
                                                                <span>
                                                                    {(
                                                                        member as any
                                                                    )
                                                                        .inviteType ===
                                                                    "superadmin-to-lead"
                                                                        ? "Lead"
                                                                        : "Participant"}
                                                                </span>
                                                            </>
                                                        )}
                                                </div>
                                                {hasInvite && (
                                                    <div className="flex items-center gap-2 mt-1">
                                                        {inviteUsed ? (
                                                            <div className="flex items-center gap-1 text-xs text-green-600">
                                                                <CheckCircle2 className="w-3 h-3" />
                                                                <span>
                                                                    {t(
                                                                        "members.inviteUsed"
                                                                    ) ||
                                                                        "Invite used"}
                                                                </span>
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-center gap-1 text-xs text-amber-600">
                                                                <Clock className="w-3 h-3" />
                                                                <span>
                                                                    {t(
                                                                        "members.invitePending"
                                                                    ) ||
                                                                        "Invite pending"}
                                                                </span>
                                                            </div>
                                                        )}
                                                        {inviteInfo?.inviteCode && (
                                                            <span className="text-xs text-brand-text-secondary font-mono">
                                                                (
                                                                {
                                                                    inviteInfo.inviteCode
                                                                }
                                                                )
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                                {!hasInvite &&
                                                    !isPendingInvite && (
                                                        <div className="text-xs text-brand-text-secondary mt-1">
                                                            {t(
                                                                "members.noInvite"
                                                            ) || "No invite"}
                                                        </div>
                                                    )}
                                            </div>
                                        </div>

                                        {!isPendingInvite &&
                                            member.id !== user?.id && (
                                                <button
                                                    onClick={() =>
                                                        handleRemoveMember(
                                                            member.id,
                                                            member.displayName ||
                                                                member.username
                                                        )
                                                    }
                                                    disabled={isRemoving}
                                                    className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                    title={
                                                        t("members.remove") ||
                                                        "Remove member"
                                                    }
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
                            {t("members.noMembers") || "No members yet"}
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
                        ? isEditMode
                            ? t("saving")
                            : tCreate("creating")
                        : isEditMode
                        ? t("saveChanges")
                        : tCreate("createButton")}
                </BrandButton>
            </div>
        </div>
    );
};
