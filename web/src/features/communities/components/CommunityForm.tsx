import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useQueryClient } from "@tanstack/react-query";
import {
    useCommunity,
    useUpdateCommunity,
    useCreateCommunity,
} from "@/hooks/api";
import { useFutureVisionTags } from "@/hooks/api/useFutureVisions";
import { useAuth } from "@/contexts/AuthContext";
import { useUserRoles, useCanCreateCommunity } from "@/hooks/api/useProfile";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { Label } from "@/components/ui/shadcn/label";
import { Textarea } from "@/components/ui/shadcn/textarea";
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
import { FutureVisionCoverDevPlaceholders } from "@/shared/components/FutureVisionCoverDevPlaceholders";
import { ValuesFormPickerFields } from "@/shared/components/value-rubricator/ValuesFormPickerFields";
import { usePlatformValueRubricatorSections } from "@/shared/hooks/usePlatformValueRubricator";
import { resolveApiErrorToastMessage } from "@/lib/i18n/api-error-toast";
import { useToastStore } from "@/shared/stores/toast.store";
import { extractErrorMessage } from "@/shared/lib/utils/error-utils";

interface CommunityFormProps {
    communityId?: string; // Если нет - создание, если есть - редактирование
    /** When true (e.g. ?edit=futureVision on settings URL), focus future vision textarea after load */
    focusFutureVisionTextOnMount?: boolean;
}

export const CommunityForm = ({
    communityId,
    focusFutureVisionTextOnMount = false,
}: CommunityFormProps) => {
    const router = useRouter();
    const queryClient = useQueryClient();
    const t = useTranslations("pages.communitySettings");
    const tCreate = useTranslations("communities.create");
    const locale = useLocale();

    const { user } = useAuth();
    const { data: userRoles } = useUserRoles(user?.id || "");
    const { canCreate: canCreateCommunity, isLoading: permissionLoading } =
        useCanCreateCommunity();
    const addToast = useToastStore((state) => state.addToast);

    const isEditMode = !!communityId && communityId !== "create";
    const { data: community, isLoading } = useCommunity(
        isEditMode ? communityId : ""
    );
    const isFutureVisionHub =
        isEditMode &&
        (community as { typeTag?: string } | undefined)?.typeTag === "future-vision";
    const updateCommunity = useUpdateCommunity();
    const createCommunity = useCreateCommunity();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [currencySingular, setCurrencySingular] = useState(() =>
        locale === "ru" ? "заслуга" : "merit"
    );
    const [currencyPlural, setCurrencyPlural] = useState(() =>
        locale === "ru" ? "заслуги" : "merits"
    );
    const [currencyGenitive, setCurrencyGenitive] = useState(() =>
        locale === "ru" ? "заслуг" : "merits"
    );
    const [isPriority, setIsPriority] = useState(false);
    // Default icon is "thanks" emoji (🙏)
    const defaultIconUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(
        "🙏"
    )}</text></svg>`;
    const [iconUrl, setIconUrl] = useState(defaultIconUrl);
    const [futureVisionText, setFutureVisionText] = useState("");
    const [futureVisionTags, setFutureVisionTags] = useState<string[]>([]);
    const [futureVisionCover, setFutureVisionCover] = useState("");
    const futureVisionTextareaRef = useRef<HTMLTextAreaElement>(null);
    const didFocusFutureVisionRef = useRef(false);

    useFutureVisionTags();
    const { sections: rubricatorSections } = usePlatformValueRubricatorSections();

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
            setIsPriority(c.isPriority || false);
            setIconUrl(c.settings?.iconUrl || defaultIconUrl);
            setFutureVisionText(c.futureVisionText || "");
            setFutureVisionTags(Array.isArray(c.futureVisionTags) ? c.futureVisionTags : []);
            setFutureVisionCover(c.futureVisionCover || "");
        }
    }, [community, isEditMode]);

    useEffect(() => {
        if (
            !focusFutureVisionTextOnMount ||
            !isEditMode ||
            isLoading ||
            didFocusFutureVisionRef.current ||
            isFutureVisionHub
        ) {
            return;
        }
        didFocusFutureVisionRef.current = true;
        const t = window.setTimeout(() => {
            const el = futureVisionTextareaRef.current;
            if (!el) return;
            el.focus();
            el.scrollIntoView({ behavior: "smooth", block: "center" });
        }, 150);
        return () => window.clearTimeout(t);
    }, [focusFutureVisionTextOnMount, isEditMode, isLoading, isFutureVisionHub]);

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
                        ...(!isFutureVisionHub && {
                            futureVisionText: futureVisionText.trim() || undefined,
                            futureVisionTags:
                                futureVisionTags.length > 0 ? futureVisionTags : undefined,
                            futureVisionCover: futureVisionCover.trim() || undefined,
                        }),
                    },
                });
                router.push(`/meriter/communities/${communityId}`);
            } else {
                const createData = {
                    ...data,
                    ...(isSuperadmin && { isPriority }),
                    futureVisionText: futureVisionText.trim(),
                    futureVisionTags: futureVisionTags.length > 0 ? futureVisionTags : undefined,
                    futureVisionCover: futureVisionCover.trim() || undefined,
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
            const extracted = extractErrorMessage(error, "");
            const toastMsg = extracted.trim()
                ? resolveApiErrorToastMessage(extracted)
                : tCreate("errors.createFailed");
            addToast(toastMsg, "error");
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
                <div className="p-6 bg-base-200 rounded-lg shadow-none">
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

            <BrandFormControl 
                label={t("description")}
                helperText={`${description.length}/180 ${t("characters")}`}
            >
                <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder={t("descriptionPlaceholder")}
                    maxLength={180}
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

            {!isFutureVisionHub && (
                <div className="border-t border-base-300 pt-6">
                    <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                        {t("futureVisionSection")}
                    </h2>
                    <div className="space-y-4 mb-6">
                        <BrandFormControl label={t("futureVisionText")} required={!isEditMode}>
                            <Textarea
                                ref={futureVisionTextareaRef}
                                id="community-future-vision-text"
                                value={futureVisionText}
                                onChange={(e) => setFutureVisionText(e.target.value)}
                                placeholder={t("futureVisionPlaceholder")}
                                maxLength={10000}
                                rows={4}
                                className="rounded-xl w-full"
                            />
                        </BrandFormControl>
                        <ValuesFormPickerFields
                            decree809Tags={rubricatorSections.decree809}
                            adminExtrasTags={rubricatorSections.adminExtras}
                            valueTags={futureVisionTags}
                            onChange={setFutureVisionTags}
                            disabled={isPending}
                        />
                        <BrandFormControl label={t("futureVisionCover")}>
                            <ImageUploader
                                value={futureVisionCover || undefined}
                                onUpload={setFutureVisionCover}
                                onRemove={() => setFutureVisionCover("")}
                                aspectRatio={16 / 9}
                                compact
                                disabled={isPending}
                                allowUrlFallback
                                labels={{
                                    placeholder: t("coverImagePlaceholder"),
                                    uploading: t("uploading"),
                                    uploadFailed: t("uploadFailed"),
                                }}
                            />
                            <FutureVisionCoverDevPlaceholders
                                onSelectUrl={setFutureVisionCover}
                                disabled={isPending}
                            />
                        </BrandFormControl>
                    </div>
                </div>
            )}

            {isSuperadmin && !isEditMode && (
                <div className="border-t border-gray-200 pt-6">
                    <h2 className="text-lg font-semibold text-brand-text-primary mb-4">
                        {t("prioritySettings")}
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
                                {t("isPriority")}
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
                                {t("prioritySettings")}
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
                    disabled={!name || (!isEditMode && !futureVisionText.trim()) || isPending}
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
