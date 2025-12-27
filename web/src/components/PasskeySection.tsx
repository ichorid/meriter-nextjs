import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/shadcn/button";
import { Loader2 } from "lucide-react";
import { usePasskeys } from "@/hooks/usePasskeys";

interface PasskeySectionProps {
    isLoading: boolean;
    onSuccess: (result?: any) => void;
    onError: (msg: string) => void;
}

export function PasskeySection({ isLoading, onSuccess, onError }: PasskeySectionProps) {
    const t = useTranslations("login");
    const router = useRouter();
    const { authenticateWithPasskey, isWebAuthnSupported } = usePasskeys();
    const [localLoading, setLocalLoading] = useState(false);

    if (!isWebAuthnSupported()) {
        return null; // Don't show if not supported
    }

    const handleAuthenticate = async () => {
        setLocalLoading(true);
        try {
            const result = await authenticateWithPasskey();

            // Do not redirect here. Let the parent handle it based on isNewUser flag.
            // router.push('/meriter/profile');

            onSuccess(result);
        } catch (e: any) {
            console.error(e);
            onError(e.message || t("passkeyLoginFailed", { defaultMessage: "Passkey authentication failed" }));
        } finally {
            setLocalLoading(false);
        }
    };

    return (
        <Button
            variant="outline"
            size="default"
            className="rounded-xl active:scale-[0.98] w-full flex items-center justify-center gap-2"
            onClick={handleAuthenticate}
            disabled={isLoading || localLoading}
        >
            {localLoading && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{localLoading ? t("authenticating", { defaultMessage: "Authenticating..." }) : t("signInWithPasskey", { defaultMessage: "Sign in with Passkey" })}</span>
        </Button>
    );
}
