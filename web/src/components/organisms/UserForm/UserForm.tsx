"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { BrandButton, BrandInput, BrandFormControl } from "@/components/ui";
import { Loader2 } from "lucide-react";
import { OSMAutocomplete } from "@/components/molecules/OSMAutocomplete";

export interface UserFormData {
    displayName: string;
    avatarUrl?: string;
    bio?: string;
    location?: {
        region: string;
        city: string;
    };
    website?: string;
    values: string;
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
}

export function UserForm({
    initialData,
    onSubmit,
    onCancel,
    isSubmitting = false,
    submitLabel,
    showContacts = true,
    showEducation = true,
}: UserFormProps) {
    const t = useTranslations("profile");

    const [displayName, setDisplayName] = useState(
        initialData?.displayName || ""
    );
    const [avatarUrl, setAvatarUrl] = useState(initialData?.avatarUrl || "");
    const [bio, setBio] = useState(initialData?.bio || "");
    const [region, setRegion] = useState(initialData?.location?.region || "");
    const [city, setCity] = useState(initialData?.location?.city || "");
    const [website, setWebsite] = useState(initialData?.website || "");
    const [values, setValues] = useState(initialData?.values || "");
    const [about, setAbout] = useState(initialData?.about || "");
    const [email, setEmail] = useState(initialData?.contacts?.email || "");
    const [otherContacts, setOtherContacts] = useState(
        initialData?.contacts?.other || ""
    );
    const [educationalInstitution, setEducationalInstitution] = useState(
        initialData?.educationalInstitution || ""
    );
    const [errors, setErrors] = useState<Record<string, string>>({});

    useEffect(() => {
        if (initialData) {
            setDisplayName(initialData.displayName || "");
            setAvatarUrl(initialData.avatarUrl || "");
            setBio(initialData.bio || "");
            setRegion(initialData.location?.region || "");
            setCity(initialData.location?.city || "");
            setWebsite(initialData.website || "");
            setValues(initialData.values || "");
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
        if (!values.trim()) {
            newErrors.values = t("errors.required");
        }

        if (bio.length > 1000) {
            newErrors.bio = t("errors.bioTooLong", { max: 1000 });
        }
        if (values.length > 1000) {
            newErrors.values = t("errors.valuesTooLong", { max: 1000 });
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

        // Email is read-only, but if it's somehow empty, it might be an issue depending on backend
        if (!email.trim()) {
            // newErrors.email = t('errors.required'); // Optional: enforce email presence
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
            values: values.trim(),
            about: about.trim() || undefined,
            contacts: {
                email: email.trim(),
                other: otherContacts.trim() || undefined,
            },
            educationalInstitution: educationalInstitution.trim() || undefined,
        };

        await onSubmit(formData);
    };

    return (
        <div className="w-full max-w-full overflow-hidden space-y-6">
            <div className="mb-2">
                <h2 className="text-2xl font-bold text-base-content text-left mb-6">
                    {t("newProfile")}
                </h2>
                <p className="text-sm text-base-content/70 mb-8">
                    {t("newProfileSubtitle")}
                </p>
            </div>
            <div className="bg-base-200 dark:bg-base-300/20 p-4 rounded-xl mb-4">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-base-content">
                        {t("generalInformation")}
                    </h3>
                </div>
                <div className="flex items-center gap-4 mb-2">
                    <div className="relative w-20 h-20 rounded-full overflow-hidden bg-base-300 dark:bg-base-content/10 border border-base-content/20 flex-shrink-0 mb-4">
                        {avatarUrl ? (
                            <img
                                src={avatarUrl}
                                alt="Avatar"
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-base-content/30">
                                No Img
                            </div>
                        )}
                    </div>
                    <div className="flex-1">
                        <BrandFormControl
                            label={t("avatarUrl")}
                            helperText={t("avatarUrlHelper")}
                        >
                            <BrandInput
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                placeholder="https://..."
                            />
                        </BrandFormControl>
                    </div>
                </div>

                <BrandFormControl
                    label={t("displayName")}
                    error={errors.displayName}
                    required
                >
                    <BrandInput
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder={t("displayNamePlaceholder")}
                    />
                </BrandFormControl>
            </div>
            <div className="bg-base-200 dark:bg-base-300/20 p-4 rounded-xl mb-4">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-base-content">
                        {t("contactInformation")}
                    </h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-base-content">
                            {t("region")} <span className="text-error">*</span>
                        </label>
                        <OSMAutocomplete
                            value={region}
                            onChange={setRegion}
                            placeholder={t("regionPlaceholder")}
                            type="state"
                            error={errors.region}
                        />
                    </div>
                    <div className="space-y-3">
                        <label className="block text-sm font-medium text-base-content">
                            {t("city")} <span className="text-error">*</span>
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

                <div className="mb-4">
                    <BrandFormControl label={t("email")}>
                        <BrandInput
                            type="email"
                            value={email}
                            onChange={() => {}} // Read-only
                            disabled
                            className="bg-base-300 dark:bg-base-content/10 text-base-content/60"
                        />
                    </BrandFormControl>
                </div>
                <div>
                    <BrandFormControl
                        label={t("otherContacts")}
                        helperText={t("otherContactsHelper")}
                    >
                        <textarea
                            className="w-full px-4 py-2 bg-base-100 dark:bg-base-content/5 border border-base-content/20 rounded-xl resize-none text-base-content placeholder:text-base-content/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                            value={otherContacts}
                            onChange={(e) => setOtherContacts(e.target.value)}
                            placeholder={t("otherContactsPlaceholder")}
                            rows={3}
                        />
                    </BrandFormControl>
                </div>
            </div>
            <div className="mb-2 bg-base-200 dark:bg-base-300/20 p-4 rounded-xl">
                <div className="mb-6">
                    <h3 className="font-bold text-base text-base-content">
                        {t("aboutInformation")}
                    </h3>
                </div>

                <div className="mb-2 text-sm text-base-content/70">
                    {t("hint.about")}
                </div>
                <BrandFormControl
                    label={t("about")}
                    helperText={`${about.length}/1000 ${t("characters")}`}
                    error={errors.about}
                    className="mb-4"
                    required
                >
                    <textarea
                        className="w-full px-4 py-2 bg-base-100 dark:bg-base-content/5 border border-base-content/20 rounded-xl resize-none text-base-content placeholder:text-base-content/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                        value={about}
                        onChange={(e) => setAbout(e.target.value)}
                        placeholder={t("aboutPlaceholder")}
                        maxLength={1000}
                        rows={4}
                    />
                </BrandFormControl>

                <div className="mb-2 text-sm text-base-content/70">
                    {t("hint.values")}
                </div>
                <BrandFormControl
                    label={t("values")}
                    helperText={`${values.length}/1000 ${t("characters")}`}
                    error={errors.values}
                    required
                >
                    <textarea
                        className="w-full px-4 py-2 bg-base-100 dark:bg-base-content/5 border border-base-content/20 rounded-xl resize-none text-base-content placeholder:text-base-content/50 focus:outline-none focus:ring-2 focus:ring-brand-primary/50 focus:border-brand-primary"
                        value={values}
                        onChange={(e) => setValues(e.target.value)}
                        placeholder={t("valuesPlaceholder")}
                        maxLength={1000}
                        rows={4}
                    />
                </BrandFormControl>
            </div>

            <div className="flex gap-4 justify-end">
                {onCancel && (
                    <BrandButton
                        variant="outline"
                        onClick={onCancel}
                        disabled={isSubmitting}
                        size="sm"
                    >
                        {t("cancel")}
                    </BrandButton>
                )}
                <BrandButton
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                    isLoading={isSubmitting}
                    size="sm"
                    variant="default"
                >
                    {isSubmitting ? t("saving") : submitLabel || t("save")}
                </BrandButton>
            </div>
        </div>
    );
}
