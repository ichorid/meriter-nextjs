"use client";

import React, { useMemo, useRef, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useAuth } from "@/contexts/AuthContext";
import { useUpdateUser } from "@/hooks/api/useProfile";
import { UserForm, UserFormData } from "@/components/organisms/UserForm";
import { Logo } from "@/components/ui";
import { Button } from "@/components/ui/shadcn/button";
import { Loader2 } from "lucide-react";
import { useToastStore } from "@/shared/stores/toast.store";

function NewUserPageContent() {
    const t = useTranslations("profile");
    const tLogin = useTranslations("login");
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUser();
    const addToast = useToastStore((state) => state.addToast);
    const formRef = useRef<{ submit: () => void }>(null);

    const initialData: Partial<UserFormData> = useMemo(() => {
        if (!user) return {};
        return {
            displayName: user.displayName || "",
            avatarUrl: user.avatarUrl || "",
            bio: user.profile?.bio || "",
            location: {
                region: user.profile?.location?.region || "",
                city: user.profile?.location?.city || "",
            },
            website: user.profile?.website || "",
            about: user.profile?.about || "",
            contacts: {
                email: user.profile?.contacts?.email || "",
                other: user.profile?.contacts?.messenger || "",
            },
            educationalInstitution: user.profile?.educationalInstitution || "",
        };
    }, [user]);

    const handleSubmit = async (data: UserFormData) => {
        try {
            await updateUser({
                displayName: data.displayName,
                avatarUrl: data.avatarUrl,
                profile: {
                    bio: data.bio || null,
                    location: data.location
                        ? {
                              region: data.location.region,
                              city: data.location.city,
                          }
                        : null,
                    website: data.website || null,
                    about: data.about || null,
                    contacts: {
                        email: data.contacts?.email || "",
                        messenger: data.contacts?.other || "",
                    },
                    educationalInstitution: data.educationalInstitution || null,
                },
            });

            addToast(t("saved"), "success");
            router.push("/meriter/profile");
        } catch (error: any) {
            addToast(error?.message || t("error"), "error");
        }
    };

    const handleFooterSubmit = () => {
        formRef.current?.submit();
    };

    if (authLoading) {
        return (
            <div className="h-svh bg-base-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-base-content/50" />
            </div>
        );
    }

    if (!user) {
        router.push("/meriter/login");
        return null;
    }

    return (
        <div className="h-svh bg-base-100 flex flex-col">
            {/* Fixed Header */}
            <header className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-base-100 border-b border-base-content/5">
                <div className="w-full max-w-2xl mx-auto">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <Logo size={32} className="text-base-content" />
                            <span className="text-base font-medium text-base-content">
                                Meriter
                            </span>
                        </div>
                    </div>
                    {/* Title in header */}
                    <div className="mt-4">
                        <h1 className="text-xl font-semibold text-base-content">
                            {t("newProfile")}
                        </h1>
                        <p className="text-sm text-base-content/60 mt-1">
                            {t("newProfileSubtitle")}
                        </p>
                    </div>
                </div>
            </header>

            {/* Scrollable Form Content */}
            <main className="flex-1 overflow-y-auto">
                <div className="w-full max-w-2xl mx-auto px-6 py-6">
                    <UserForm
                        initialData={initialData}
                        onSubmit={handleSubmit}
                        isSubmitting={isUpdating}
                        showContacts={true}
                        showEducation={true}
                        hideHeader={true}
                        hideFooter={true}
                        formRef={formRef}
                    />
                </div>
            </main>

            {/* Fixed Footer */}
            <footer className="sticky bottom-0 z-10 px-6 pt-4 pb-6 bg-base-100 border-t border-base-content/5">
                <div className="w-full max-w-2xl mx-auto">
                    <Button
                        size="lg"
                        variant="default"
                        className="rounded-xl active:scale-[0.98] w-full"
                        onClick={handleFooterSubmit}
                        disabled={isUpdating}
                    >
                        {isUpdating && <Loader2 className="h-4 w-4 animate-spin" />}
                        {t("completeRegistration", {
                            defaultMessage: "Complete Registration",
                        })}
                    </Button>
                </div>
            </footer>
        </div>
    );
}

export default function NewUserPage() {
    return (
        <Suspense fallback={
            <div className="h-svh bg-base-100 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-base-content/50" />
            </div>
        }>
            <NewUserPageContent />
        </Suspense>
    );
}
