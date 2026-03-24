'use client';

import React, { useEffect, useId, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface BottomActionSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
    /** Sticky footer below scrollable content (e.g. primary actions) */
    footer?: React.ReactNode;
}

export const BottomActionSheet = React.forwardRef<HTMLDivElement, BottomActionSheetProps>(({
    isOpen,
    onClose,
    title,
    children,
    footer,
}, ref) => {
    const titleHeadingId = useId();
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            requestAnimationFrame(() => setVisible(true));
            document.body.style.overflow = 'hidden';
            return () => {
                document.body.style.overflow = '';
            };
        } else {
            setVisible(false);
            const timer = setTimeout(() => {
                document.body.style.overflow = '';
            }, 300);
            return () => {
                clearTimeout(timer);
                document.body.style.overflow = '';
            };
        }
    }, [isOpen]);

    if (!mounted) return null;

    const content = (
        <div
            ref={ref}
            className={`
                fixed inset-0 z-[100] flex items-center justify-center
                transition-opacity duration-300
                ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
            `}
        >
            {/* Backdrop */}
            <div
                className={`
                    absolute inset-0 bg-base-content/50 backdrop-blur-sm transition-opacity duration-300
                    ${visible ? 'opacity-100' : 'opacity-0'}
                `}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                role="dialog"
                aria-modal="true"
                aria-labelledby={title ? titleHeadingId : undefined}
                className={`
                    relative mx-4 w-full max-w-lg overflow-hidden rounded-2xl border border-base-200/70 bg-base-100 shadow-2xl
                    transform transition-all duration-300 ease-out
                    ${visible ? 'translate-y-0 scale-100' : 'translate-y-10 scale-95'}
                `}
                onClick={(e) => e.stopPropagation()}
            >

                {/* Header */}
                <div className="flex items-center gap-3 border-b border-base-200/80 px-5 pt-4 pb-3">
                    {title ? (
                        <h2 id={titleHeadingId} className="min-w-0 flex-1 text-lg font-semibold tracking-tight text-base-content">
                            {title}
                        </h2>
                    ) : (
                        <div className="flex-1" />
                    )}
                    <button
                        type="button"
                        onClick={onClose}
                        className="shrink-0 rounded-full p-2 text-base-content/50 transition-colors hover:bg-base-200/80 hover:text-base-content"
                        aria-label={title ? undefined : 'Close'}
                    >
                        <X size={20} aria-hidden />
                    </button>
                </div>

                {/* Content */}
                <div className={`max-h-[min(70vh,28rem)] overflow-y-auto px-5 pt-4 ${footer ? 'pb-4' : 'pb-8'}`}>
                    {children}
                </div>

                {footer ? (
                    <div className="border-t border-base-200/80 bg-base-200/20 px-5 py-4">
                        {footer}
                    </div>
                ) : null}
            </div>
        </div>
    );

    return createPortal(content, document.body);
});

BottomActionSheet.displayName = 'BottomActionSheet';
