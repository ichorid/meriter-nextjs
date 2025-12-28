"use client";

import React, { useState, useEffect, useImperativeHandle } from "react";
import { useTranslations } from "next-intl";
import { BrandFormControl } from "@/components/ui";
import { Button } from "@/components/ui/shadcn/button";
import { Input } from "@/components/ui/shadcn/input";
import { Textarea } from "@/components/ui/shadcn/textarea";
import { Loader2 } from "lucide-react";
import { OSMAutocomplete } from "@/components/molecules/OSMAutocomplete";
import { AvatarUploader } from "@/components/ui/AvatarUploader";

export interface UserFormData {
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    location?: {
        region: string;
        city: string;
    };
    website?: string;
    about?: string;
    contacts?: {
        email: string;
        other?: string;
    };
    educationalInstitution?: string;
}

interface UserFormProps {
    initialData?: Partial<UserFormData>;
    onSubmit: (data: UserFormData) => Promise<void>;
    onCancel?: () => void;
    isSubmitting?: boolean;
    submitLabel?: string;
    showContacts?: boolean;
    showEducation?: boolean;
    stickyFooter?: boolean;
    hideHeader?: boolean;
    hideFooter?: boolean;
    formRef?: React.RefObject<{ submit: () => void } | null>;
}

export function UserForm({
    initialData,
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel,
    showContacts = true,
    showEducation = true,
    stickyFooter = false,
    hideHeader = false,
    hideFooter = false,
    formRef,
}: UserFormProps) {
    const t = useTranslations("profile");
    const tCommon = useTranslations("common");

    const [displayName, setDisplayName] = useState(
        initialData?.displayName || ""
    );
    const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl || "");
    const [bio, setBio] = useState(initialData?.bio || "");
    const [region, setRegion] = useState(initialData?.location?.region || "");
    const [city, setCity] = useState(initialData?.location?.city || "");
    const [website, setWebsite] = useState(initialData?.website || "");
    const [about, setAbout] = useState(initialData?.about || "");
    const [email, setEmail] = useState(initialData?.contacts?.email || "");
    const [otherContacts, setOtherContacts] = useState(
        initialData?.contacts?.other || ""
    );
    const [educationalInstitution, setEducationalInstitution] = useState(
        initialData?.educationalInstitution || ""
    );
    const [errors, setErrors] = useState<Record<string, string>>({});

    // Email is editable only if it wasn't provided initially
    const isEmailEditable = !initialData?.contacts?.email;

    useEffect(() => {
        if (initialData) {
            setDisplayName(initialData.displayName || "");
            setAvatarUrl(initialData.avatarUrl || "");
            setBio(initialData.bio || "");
            setRegion(initialData.location?.region || "");
            setCity(initialData.location?.city || "");
            setWebsite(initialData.website || "");
            setAbout(initialData.about || "");
            setEmail(initialData.contacts?.email || "");
            setOtherContacts(initialData.contacts?.other || "");
            setEducationalInstitution(initialData.educationalInstitution || "");
        }
        console.log(initialData);
    }, [initialData]);

    const validate = (): boolean => {
        const newErrors: Record<string, string> = {};

        if (!displayName.trim()) {
            newErrors.displayName = t("errors.required");
        }
        if (!region.trim()) {
            newErrors.region = t("errors.required");
        }
        if (!city.trim()) {
            newErrors.city = t("errors.required");
        }

        if (bio.length > 1000) {
            newErrors.bio = t("errors.bioTooLong", { max: 1000 });
        }
        if (about.length > 1000) {
            newErrors.about = t("errors.aboutTooLong", { max: 1000 });
        }
        if (educationalInstitution.length > 200) {
            newErrors.educationalInstitution = t(
                "errors.educationalInstitutionTooLong",
                { max: 200 }
            );
        }
        if (website && !isValidUrl(website)) {
            newErrors.website = t("errors.invalidUrl");
        }

        // Validate email if it's editable and user entered something
        if (isEmailEditable && email.trim()) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email.trim())) {
                newErrors.email = t("errors.invalidEmail");
            }
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const isValidUrl = (url: string): boolean => {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    };

    const handleSubmit = async () => {
        if (!validate()) {
            return;
        }

        const formData: UserFormData = {
            displayName: displayName.trim(),
            avatarUrl: avatarUrl.trim() || undefined,
            bio: bio.trim() || undefined,
            location: {
                region: region.trim(),
                city: city.trim(),
            },
            website: website.trim() || undefined,
            about: about.trim() || undefined,
            contacts: {
                email: email.trim(),
                other: otherContacts.trim() || undefined,
            },
            educationalInstitution: educationalInstitution.trim() || undefined,
        };

        await onSubmit(formData);
    };

    // Expose submit method via ref
    useImperativeHandle(formRef, () => ({
        submit: handleSubmit,
    }));

    return (
        <div className="w-full max-w-full">
            {/* Page Header - conditionally rendered */}
            {!hideHeader && (
                <header className="mb-8">
                    <h2 className="text-xl font-semibold text-base-content mb-2">
                        {t("newProfile")}
                    </h2>
                    <p className="text-sm text-base-content/60 leading-relaxed">
                        {t("newProfileSubtitle")}
                    </p>
                </header>
            )}

            {/* Form Sections */}
            <div className="space-y-6">
                {/* Section 1: General Information */}
                <section className="bg-base-200/40 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-base-content mb-5 uppercase tracking-wide">
                        {t("generalInformation")}
                    </h3>

                    {/* Avatar Row */}
                    <BrandFormControl
                        label={t("avatarUrl")}
                        helperText={t("avatarUrlHelper")}
                    >
                        <AvatarUploader
                            value={avatarUrl}
                            onUpload={(url) => setAvatarUrl(url)}
                            size={80}
                            labels={{
                                upload: t("changeAvatar") || "Change avatar",
                                cropTitle: t("cropAvatar") || "Crop avatar",
                                cancel: tCommon("cancel") || "Cancel",
                                save: t("save") || "Save",
                            }}
                        />
                    </BrandFormControl>

                    {/* Display Name */}
                    <BrandFormControl
                        label={t("displayName")}
                        error={errors.displayName}
                        required
                    >
                        <Input
                            value={displayName}
                            onChange={(e) => setDisplayName(e.target.value)}
                            placeholder={t("displayNamePlaceholder")}
                            className="h-11 rounded-xl w-full"
                        />
                    </BrandFormControl>
                </section>

                {/* Section 2: Contact Information */}
                <section className="bg-base-200/40 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-base-content mb-5 uppercase tracking-wide">
                        {t("contactInformation")}
                    </h3>

                    {/* Location Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-base-content">
                                {t("region")}{" "}
                                <span className="text-error">*</span>
                            </label>
                            <OSMAutocomplete
                                value={region}
                                onChange={setRegion}
                                placeholder={t("regionPlaceholder")}
                                type="state"
                                error={errors.region}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-base-content">
                                {t("city")}{" "}
                                <span className="text-error">*</span>
                            </label>
                            <OSMAutocomplete
                                value={city}
                                onChange={setCity}
                                placeholder={t("cityPlaceholder")}
                                type="city"
                                error={errors.city}
                            />
                        </div>
                    </div>

                    {/* Email */}
                    <div className="mb-5">
                        <BrandFormControl
                            label={t("email")}
                            error={errors.email}
                        >
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) =>
                                    isEmailEditable && setEmail(e.target.value)
                                }
                                disabled={!isEmailEditable}
                                placeholder={
                                    isEmailEditable
                                        ? t("emailPlaceholder")
                                        : undefined
                                }
                                className={`h-11 rounded-xl w-full ${!isEmailEditable
                                    ? "bg-base-300/30 text-base-content/50"
                                    : ""
                                    }`}
                            />
                        </BrandFormControl>
                    </div>

                    {/* Other Contacts */}
                    <BrandFormControl
                        label={t("otherContacts")}
                        helperText={t("otherContactsHelper")}
                    >
                        <Textarea
                            className="min-h-[80px]"
                            value={otherContacts}
                            onChange={(e) => setOtherContacts(e.target.value)}
                            placeholder={t("otherContactsPlaceholder")}
                            rows={3}
                        />
                    </BrandFormControl>
                </section>

                {/* Section 3: About */}
                <section className="bg-base-200/40 rounded-2xl p-5">
                    <h3 className="text-sm font-semibold text-base-content mb-5 uppercase tracking-wide">
                        {t("aboutInformation")}
                    </h3>

                    {/* About Field */}
                    <div className="mb-5">
                        <p className="text-xs text-base-content/50 mb-3 leading-relaxed">
                            {t("hint.about")}
                        </p>
                        <BrandFormControl
                            label={t("about")}
                            helperText={`${about.length}/1000`}
                            error={errors.about}
                            required
                        >
                            <Textarea
                                className="min-h-[120px]"
                                value={about}
                                onChange={(e) => setAbout(e.target.value)}
                                placeholder={t("aboutPlaceholder")}
                                maxLength={1000}
                                rows={4}
                            />
                        </BrandFormControl>
                    </div>
                </section>
            </div>

            {/* Action Buttons - conditionally rendered */}
            {!hideFooter && (
                <footer
                    className={`
                        flex gap-3 justify-end pt-6 border-t border-base-content/5
                        ${stickyFooter
                            ? "sticky bottom-0 bg-base-100 pb-6 -mx-6 px-6 mt-8"
                            : "mt-8"
                        }
                    `}
                >
                    {onCancel && (
                        <Button
                            variant="ghost"
                            onClick={onCancel}
                            disabled={isSubmitting}
                            size="default"
                            className="rounded-xl active:scale-[0.98]"
                        >
                            {t("cancel")}
                        </Button>
                    )}
                    <Button
                        onClick={handleSubmit}
                        disabled={isSubmitting}
                        size="lg"
                        variant="default"
                        className={`rounded-xl active:scale-[0.98] ${stickyFooter ? 'w-full' : ''}`}
                    >
                        {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                        {isSubmitting ? t("saving") : submitLabel || t("save")}
                    </Button>
                </footer>
            )}
        </div>
    );
}
