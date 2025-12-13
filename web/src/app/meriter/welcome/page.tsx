"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { BrandButton, Logo } from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

export default function WelcomePage() {
    const router = useRouter();
    const t = useTranslations("login");
    const { user, isLoading: authLoading } = useAuth();

    if (authLoading) {
        return (
            <div className="min-h-svh bg-base-100 flex items-center justify-center">
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
            <header className="sticky top-0 z-10 px-6 pt-6 pb-4 bg-base-100">
                <div className="w-full max-w-md mx-auto">
                    <div className="flex items-center gap-3">
                        <Logo size={36} className="text-base-content" />
                        <span className="text-lg font-medium text-base-content">
                            Meriter
                        </span>
                    </div>
                </div>
            </header>

            {/* Scrollable Main Content */}
            <main className="flex-1 overflow-y-auto px-6">
                <div className="w-full max-w-md mx-auto py-8">
                    <div className="space-y-4">
                        <h1 className="text-2xl font-semibold text-base-content leading-tight">
                            {t("welcome")}
                        </h1>
                        <p className="text-base text-base-content/60 leading-relaxed">
                            {t("welcomeSubtitle")}
                        </p>
                    </div>
                </div>
            </main>

            {/* Fixed Footer */}
            <footer className="sticky bottom-0 z-10 px-6 pt-4 pb-6 bg-base-100 border-t border-base-content/5">
                <div className="w-full max-w-md mx-auto">
                    <BrandButton
                        size="lg"
                        variant="default"
                        fullWidth
                        onClick={() => router.push("/meriter/new-user")}
                    >
                        {t("fillProfile")}
                    </BrandButton>
                </div>
            </footer>
        </div>
    );
}
