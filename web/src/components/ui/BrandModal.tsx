'use client';

import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { BrandButton } from './BrandButton';

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
    const modalRef = useRef<HTMLDivElement>(null);
    const previousActiveElement = useRef<HTMLElement | null>(null);
    const tCommon = useTranslations('common');

    // Handle ESC key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            // Prevent body scroll
            document.body.style.overflow = 'hidden';
            // Store previously focused element
            previousActiveElement.current = document.activeElement as HTMLElement;
            // Focus modal
            modalRef.current?.focus();
        }

        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
            // Restore focus
            previousActiveElement.current?.focus();
        };
    }, [isOpen, onClose]);

    // Handle backdrop click
    const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (closeOnBackdrop && e.target === e.currentTarget) {
            onClose();
        }
    };

    if (!isOpen) return null;

    const sizeClasses = {
        sm: 'max-w-md',
        md: 'max-w-lg',
        lg: 'max-w-2xl',
        full: 'max-w-full m-4',
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-labelledby={title ? 'modal-title' : undefined}
        >
            <div
                ref={modalRef}
                tabIndex={-1}
                className={`
          relative w-full ${sizeClasses[size]}
          bg-base-100 rounded-2xl shadow-xl
          animate-in zoom-in-95 duration-200
          max-h-[90vh] flex flex-col
        `}
            >
                {/* Header */}
                {(title || showCloseButton) && (
                    <div className="flex items-center justify-between p-6 border-b border-base-300">
                        {title && (
                            <h2
                                id="modal-title"
                                className="text-xl font-bold text-brand-text-primary"
                            >
                                {title}
                            </h2>
                        )}
                        {showCloseButton && (
                            <BrandButton
                                variant="ghost"
                                size="sm"
                                onClick={onClose}
                                className="ml-auto -mr-2"
                                aria-label={tCommon('closeModal')}
                            >
                                <X size={20} />
                            </BrandButton>
                        )}
                    </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {children}
                </div>

                {/* Footer */}
                {footer && (
                    <div className="flex items-center justify-end gap-3 p-6 border-t border-base-300">
                        {footer}
                    </div>
                )}
            </div>
        </div>
    );
};
