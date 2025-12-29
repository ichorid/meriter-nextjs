import React, { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
    useCommunity,
    useUpdateCommunity,
    useCreateCommunity,
} from "@/hooks/api";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, useCanCreateCommunity } from "@/hooks/api/useProfile";
import { HashtagInput } from "@/shared/components/hashtag-input";
import { IconPicker } from "@/shared/components/iconpicker";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from "@/components/ui/BrandFormControl";
import { Checkbox } from "@/components/ui/shadcn/checkbox";
import { cn } from '@/lib/utils';
import { Loader2, Sparkles } from "lucide-react";
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

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [currencySingular, setCurrencySingular] = useState("merit");
    const [currencyPlural, setCurrencyPlural] = useState("merits");
    const [currencyGenitive, setCurrencyGenitive] = useState("merits");
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
                <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("namePlaceholder")}
                    className="h-11 rounded-xl w-full"
                />
            </BrandFormControl>

            <BrandFormControl label={t("description")}>
                <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    className="h-11 rounded-xl w-full"
                />
            </BrandFormControl>

            <div className="space-y-2">
                <label className="block text-sm font-medium text-base-content">
                    {t("avatarUrl")}
                </label>
                <div className="flex flex-col items-center gap-4">
                    <AvatarUploader
                        value={avatarUrl}
                        onUpload={(url) => setAvatarUrl(url)}
                        size={120}
                        communityId={isEditMode ? communityId : undefined}
                        labels={{
                            upload: t("changeAvatar"),
                            cropTitle: t("cropAvatar"),
                            cancel: t("cancel"),
                            save: t("save"),
                        }}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={handleGenerateAvatar}
                        className="rounded-xl active:scale-[0.98]"
                    >
                        <Sparkles size={16} />
                        {t("generateAvatar")}
                    </Button>
                </div>
                {t("generateAvatarHelp") && (
                    <p className="text-xs text-base-content/50 text-center">
                        {t("generateAvatarHelp")}
                    </p>
                )}
            </div>

            <BrandFormControl
                label={t("coverImage")}
                helperText={t("coverImageHelp")}
            >
                <ImageUploader
                    value={coverImageUrl}
                    onUpload={(url) => setCoverImageUrl(url)}
                    onRemove={() => setCoverImageUrl("")}
                    aspectRatio={3}
                    placeholder={t("coverImagePlaceholder")}
                    labels={{
                        placeholder: t("coverImagePlaceholder"),
                        uploading: t("uploading"),
                        uploadFailed: t("uploadFailed"),
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
                    <div>
                        <h3 className="text-base font-semibold text-brand-text-primary mb-3">
                            {t("currencyNames")}
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <BrandFormControl label={t("singular")}>
                                <Input
                                    value={currencySingular}
                                    onChange={(e) =>
                                        setCurrencySingular(e.target.value)
                                    }
                                    className="h-11 rounded-xl w-full"
                                />
                            </BrandFormControl>
                            <BrandFormControl label={t("plural")}>
                                <Input
                                    value={currencyPlural}
                                    onChange={(e) =>
                                        setCurrencyPlural(e.target.value)
                                    }
                                    className="h-11 rounded-xl w-full"
                                />
                            </BrandFormControl>
                        </div>
                        <BrandFormControl label={t("genitive")}>
                            <Input
                                value={currencyGenitive}
                                onChange={(e) =>
                                    setCurrencyGenitive(e.target.value)
                                }
                                className="h-11 rounded-xl w-full"
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
                        <div className="flex items-center gap-2.5">
                            <Checkbox
                                id="isPriority"
                                checked={isPriority}
                                onCheckedChange={(checked) => setIsPriority(checked as boolean)}
                                disabled={isPending}
                            />
                            <Label htmlFor="isPriority" className="text-sm cursor-pointer">
                                {t("isPriority") || "Mark as priority community"}
                            </Label>
                        </div>
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
                                <div className="flex items-center gap-2.5">
                                    <Checkbox
                                        id="isPriorityEdit"
                                        checked={isPriority}
                                        onCheckedChange={(checked) =>
                                            setIsPriority(checked as boolean)
                                        }
                                        disabled={isPending}
                                    />
                                    <Label htmlFor="isPriorityEdit" className="text-sm cursor-pointer">
                                        {t("isPriority") ||
                                        "Mark as priority community"}
                                    </Label>
                                </div>
                            </BrandFormControl>
                        </div>
                    )}
                </>
            )}


            <div className="flex justify-end pt-4">
                <Button
                    variant="default"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={!name || isPending}
                    className="rounded-xl active:scale-[0.98]"
                >
                    {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    {isPending
                        ? isEditMode
                            ? t("saving")
                            : tCreate("creating")
                        : isEditMode
                        ? t("saveChanges")
                        : tCreate("createButton")}
                </Button>
            </div>
        </div>
    );
};
