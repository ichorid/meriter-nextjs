import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
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
import { routes } from "@/lib/constants/routes";
import { MeriterEditor } from "@/components/molecules/RichTextEditor";
import {
    createEmptyDocumentDraft,
    concatOfficialPlainTextFromDraft,
    documentDraftHasOfficialText,
    serializeDraftForApi,
    type DocumentDraft,
} from "@/features/documents/lib/document-draft";

interface CommunityFormProps {
    communityId?: string; // Если нет - создание, если есть - редактирование
}

export const CommunityForm = ({
    communityId,
}: CommunityFormProps) => {
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
    const isFutureVisionHub =
        isEditMode &&
        (community as { typeTag?: string } | undefined)?.typeTag === "future-vision";
    const isProjectCommunity = Boolean(
        (community as { isProject?: boolean } | undefined)?.isProject,
    );
    const updateCommunity = useUpdateCommunity();
    const createCommunity = useCreateCommunity();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [avatarUrl, setAvatarUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [currencySingular, setCurrencySingular] = useState(() =>
        t("defaultCurrencySingular")
    );
    const [currencyPlural, setCurrencyPlural] = useState(() =>
        t("defaultCurrencyPlural")
    );
    const [currencyGenitive, setCurrencyGenitive] = useState(() =>
        t("defaultCurrencyGenitive")
    );
    const [isPriority, setIsPriority] = useState(false);
    // Default icon is "thanks" emoji (🙏)
    const defaultIconUrl = `data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="75" font-size="75">${encodeURIComponent(
        "🙏"
    )}</text></svg>`;
    const [iconUrl, setIconUrl] = useState(defaultIconUrl);
    const [futureVisionTags, setFutureVisionTags] = useState<string[]>([]);
    const [futureVisionCover, setFutureVisionCover] = useState("");
    const [eventCreation, setEventCreation] = useState<"admin" | "members">("admin");
    const [documentsMode, setDocumentsMode] = useState<
        "off" | "visionOrDescriptionOnly" | "all"
    >("visionOrDescriptionOnly");
    const [documentCreators, setDocumentCreators] = useState<"admins" | "members">(
        "admins",
    );
    const [documentVariantCost, setDocumentVariantCost] = useState("");
    const [documentVotingDurationHours, setDocumentVotingDurationHours] = useState("48");
    const [documentDefaultMode, setDocumentDefaultMode] = useState<"manual" | "auto">(
        "manual",
    );
    /** Draft collaborative OB document at create time (seeded into imageOfFuture document). */
    const [futureVisionDraft, setFutureVisionDraft] = useState<DocumentDraft>(() =>
        createEmptyDocumentDraft(),
    );

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
            setFutureVisionTags(Array.isArray(c.futureVisionTags) ? c.futureVisionTags : []);
            setFutureVisionCover(c.futureVisionCover || "");
            const ec = c.settings?.eventCreation;
            setEventCreation(ec === "members" ? "members" : "admin");
            const dm = c.settings?.documentsMode;
            setDocumentsMode(
                dm === "off" || dm === "visionOrDescriptionOnly" || dm === "all"
                    ? dm
                    : "visionOrDescriptionOnly",
            );
            setDocumentCreators(c.settings?.documentCreators === "members" ? "members" : "admins");
            const dvc = c.settings?.documentVariantCost;
            setDocumentVariantCost(
                dvc === null || dvc === undefined ? "" : String(dvc),
            );
            setDocumentVotingDurationHours(
                String(c.settings?.documentVotingDurationHours ?? 48),
            );
            setDocumentDefaultMode(
                c.settings?.documentDefaultMode === "auto" ? "auto" : "manual",
            );
        }
    }, [community, isEditMode]);

    const isSuperadmin = user?.globalRole === "superadmin";

    const isUserLead = useMemo(() => {
        if (!communityId || !user?.id || !userRoles) return false;
        const role = userRoles.find((r) => r.communityId === communityId);
        return role?.role === "lead";
    }, [communityId, user?.id, userRoles]);

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
                    ...(isEditMode && (isUserLead || isSuperadmin)
                        ? { eventCreation }
                        : {}),
                    ...(!isEditMode || isUserLead || isSuperadmin
                        ? {
                              documentsMode,
                              documentCreators,
                              ...(documentsMode !== "off"
                                  ? {
                                        documentVariantCost:
                                            documentVariantCost.trim() === ""
                                                ? null
                                                : Math.max(
                                                      0,
                                                      parseInt(documentVariantCost, 10) || 0,
                                                  ),
                                        documentVotingDurationHours: Math.max(
                                            1,
                                            parseInt(documentVotingDurationHours, 10) || 48,
                                        ),
                                        documentDefaultMode,
                                    }
                                  : {}),
                          }
                        : {}),
                },
            };

            if (isEditMode) {
                await updateCommunity.mutateAsync({
                    id: communityId!,
                    data: {
                        ...data,
                        ...(isSuperadmin && { isPriority }),
                        ...(!isFutureVisionHub && {
                            futureVisionTags:
                                futureVisionTags.length > 0 ? futureVisionTags : undefined,
                            futureVisionCover: futureVisionCover.trim() || undefined,
                        }),
                    },
                });
                router.push(`/meriter/communities/${communityId}`);
            } else {
                const futureVisionPlain = concatOfficialPlainTextFromDraft(futureVisionDraft);
                const createData = {
                    ...data,
                    ...(isSuperadmin && { isPriority }),
                    futureVisionText: futureVisionPlain,
                    futureVisionDocumentSeed: serializeDraftForApi(futureVisionDraft),
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
                <div className="border-t border-base-300 pt-6 space-y-6">
                    {isEditMode && communityId ? (
                        <>
                            <h2 className="text-lg font-semibold text-brand-text-primary">
                                {isProjectCommunity ? t("projectDocumentSection") : t("futureVisionSection")}
                            </h2>
                            <Button variant="outline" className="rounded-xl active:scale-[0.98]" asChild>
                            <Link href={routes.communityDocuments(communityId)}>
                                {t("openCollaborativeDocument")}
                            </Link>
                        </Button>
                        </>
                    ) : (
                        <BrandFormControl
                            label={t("futureVisionSection")}
                            required
                        >
                            <MeriterEditor
                                mode="collaborative-document"
                                value={futureVisionDraft}
                                onChange={setFutureVisionDraft}
                                placeholder={t("futureVisionPlaceholder")}
                                disabled={isPending}
                            />
                        </BrandFormControl>
                    )}
                    <div className="space-y-4">
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

            {isEditMode && (isUserLead || isSuperadmin) && !isFutureVisionHub && (
                <div className="border-t border-base-300 pt-6">
                    <h2 className="mb-2 text-lg font-semibold text-brand-text-primary">
                        {t("documentsSection")}
                    </h2>
                    <p className="mb-4 text-sm text-base-content/70">{t("documentsSectionHelp")}</p>
                    <div className="mb-6 space-y-4">
                        <BrandFormControl label={t("documentsModeLabel")}>
                            <Select
                                value={documentsMode}
                                onValueChange={(v) =>
                                    setDocumentsMode(v as "off" | "visionOrDescriptionOnly" | "all")
                                }
                                disabled={isPending}
                            >
                                <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="off">{t("documentsModeOff")}</SelectItem>
                                    <SelectItem value="visionOrDescriptionOnly">
                                        {t("documentsModeVisionOnly")}
                                    </SelectItem>
                                    <SelectItem value="all">{t("documentsModeAll")}</SelectItem>
                                </SelectContent>
                            </Select>
                        </BrandFormControl>
                        {documentsMode !== "off" ? (
                            <>
                                <BrandFormControl label={t("documentCreatorsLabel")}>
                                    <Select
                                        value={documentCreators}
                                        onValueChange={(v) =>
                                            setDocumentCreators(v as "admins" | "members")
                                        }
                                        disabled={isPending}
                                    >
                                        <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="admins">
                                                {t("documentCreatorsAdmins")}
                                            </SelectItem>
                                            <SelectItem value="members">
                                                {t("documentCreatorsMembers")}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </BrandFormControl>
                                <BrandFormControl
                                    label={t("documentVariantCostLabel")}
                                    helperText={t("documentVariantCostHelp")}
                                >
                                    <Input
                                        type="number"
                                        min={0}
                                        className="h-11 max-w-md rounded-xl"
                                        value={documentVariantCost}
                                        onChange={(e) => setDocumentVariantCost(e.target.value)}
                                        disabled={isPending}
                                        placeholder="1"
                                    />
                                </BrandFormControl>
                                <BrandFormControl label={t("documentVotingDurationLabel")}>
                                    <Input
                                        type="number"
                                        min={1}
                                        className="h-11 max-w-md rounded-xl"
                                        value={documentVotingDurationHours}
                                        onChange={(e) =>
                                            setDocumentVotingDurationHours(e.target.value)
                                        }
                                        disabled={isPending}
                                    />
                                </BrandFormControl>
                                <BrandFormControl label={t("documentDefaultModeLabel")}>
                                    <Select
                                        value={documentDefaultMode}
                                        onValueChange={(v) =>
                                            setDocumentDefaultMode(v as "manual" | "auto")
                                        }
                                        disabled={isPending}
                                    >
                                        <SelectTrigger className="h-11 w-full max-w-md rounded-xl">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="manual">
                                                {t("documentDefaultModeManual")}
                                            </SelectItem>
                                            <SelectItem value="auto">
                                                {t("documentDefaultModeAuto")}
                                            </SelectItem>
                                        </SelectContent>
                                    </Select>
                                </BrandFormControl>
                            </>
                        ) : null}
                    </div>
                    <h2 className="mb-2 text-lg font-semibold text-brand-text-primary">
                        {t("eventCreationSection")}
                    </h2>
                    <p className="mb-3 text-sm text-base-content/70">{t("eventCreationHelp")}</p>
                    <BrandFormControl label={t("eventCreationLabel")}>
                        <Select
                            value={eventCreation}
                            onValueChange={(v) => setEventCreation(v as "admin" | "members")}
                            disabled={isPending}
                        >
                            <SelectTrigger className="h-11 rounded-xl w-full max-w-md">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="admin">{t("eventCreationAdmin")}</SelectItem>
                                <SelectItem value="members">{t("eventCreationMembers")}</SelectItem>
                            </SelectContent>
                        </Select>
                    </BrandFormControl>
                </div>
            )}

            <div className="flex justify-end pt-4">
                <Button
                    variant="default"
                    size="lg"
                    onClick={handleSubmit}
                    disabled={
                        !name ||
                        isPending ||
                        (!isEditMode &&
                            !isFutureVisionHub &&
                            !documentDraftHasOfficialText(futureVisionDraft))
                    }
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
