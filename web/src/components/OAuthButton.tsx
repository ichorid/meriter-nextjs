/**
 * OAuth Provider Button Component
 * 
 * Renders a consistent OAuth provider button with icon and proper styling
 */

"use client";

import React from "react";
import * as LucideIcons from "lucide-react";
import { Button } from "@/components/ui/shadcn/button";
import type { OAuthProvider } from "@/lib/utils/oauth-providers";

interface OAuthButtonProps {
    provider: OAuthProvider;
    onClick: () => void;
    disabled?: boolean;
    label: string;
}

export function OAuthButton({ provider, onClick, disabled, label }: OAuthButtonProps) {
    // Get icon component from lucide-react
    const IconComponent = LucideIcons[
        provider.icon
    ] as React.ComponentType<{ className?: string }>;

    return (
        <Button
            variant="outline"
            size="default"
            className="w-full justify-center"
            onClick={onClick}
            disabled={disabled}
        >
            {IconComponent && <IconComponent className="mr-2" />}
            {label}
        </Button>
    );
}
