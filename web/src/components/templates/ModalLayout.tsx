'use client';

import React from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/shadcn/dialog';
import { cn } from '@/lib/utils';

export interface ModalBody {
    [key: string]: React.ComponentType<any> | null;
}

export interface ModalLayoutProps {
    isOpen: boolean;
    bodyType: string;
    size?: 'sm' | 'md' | 'lg' | 'xl';
    extraObject?: Record<string, any>;
    title?: string;
    bodyComponents?: ModalBody;
    onClose?: (e?: any) => void;
    className?: string;
}

export function ModalLayout({
    isOpen,
    bodyType,
    size = 'md',
    extraObject = {},
    title,
    bodyComponents = {},
    onClose,
    className = '',
}: ModalLayoutProps) {
    const close = (e?: any) => {
        if (onClose) {
            onClose(e);
        }
    };

    const sizeClasses = {
        sm: 'max-w-sm',
        md: 'max-w-md',
        lg: 'max-w-5xl',
        xl: 'max-w-7xl',
    };

    const BodyComponent = bodyComponents[bodyType] || null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
            <DialogContent className={cn(sizeClasses[size], className)}>
                {title && (
                    <DialogHeader>
                        <DialogTitle className="text-center">{title}</DialogTitle>
                    </DialogHeader>
                )}

                {/* Loading modal body according to different modal type */}
                {BodyComponent && (
                    <BodyComponent
                        closeModal={close}
                        extraObject={extraObject}
                        {...extraObject}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

