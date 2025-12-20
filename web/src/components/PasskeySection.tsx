import React, { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { BrandButton } from "@/components/ui";
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
        <BrandButton
            variant="outline"
            size="md"
            fullWidth
            onClick={handleAuthenticate}
            disabled={isLoading || localLoading}
        >
            {localLoading ? t("authenticating", { defaultMessage: "Authenticating..." }) : t("signInWithPasskey", { defaultMessage: "Sign in with Passkey" })}
        </BrandButton>
    );
}
