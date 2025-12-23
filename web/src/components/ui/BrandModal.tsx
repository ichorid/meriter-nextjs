'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from '@/components/ui/shadcn/dialog';
import { cn } from '@/lib/utils';

interface BrandModalProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    size?: 'sm' | 'md' | 'lg' | 'full';
    children: React.ReactNode;
    footer?: React.ReactNode;
    closeOnBackdrop?: boolean;
    showCloseButton?: boolean;
}

export const BrandModal: React.FC<BrandModalProps> = ({
    isOpen,
    onClose,
    title,
    size = 'md',
    children,
    footer,
    closeOnBackdrop = true,
    showCloseButton = true,
}) => {
    const tCommon = useTranslations('common');

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        full: 'max-w-full m-4',
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className={cn(
                    'rounded-2xl max-h-[90vh] flex flex-col p-0',
                    sizeClasses[size]
                )}
                onInteractOutside={(e) => {
                    if (!closeOnBackdrop) {
                        e.preventDefault();
                    }
                }}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <DialogHeader className="p-6 border-b">
                        {title && <DialogTitle>{title}</DialogTitle>}
                    </DialogHeader>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <DialogFooter className="p-6 border-t">
                        {footer}
                    </DialogFooter>
                )}
            </DialogContent>
        </Dialog>
    );
};
