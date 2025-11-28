'use client';

import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';

interface BottomActionSheetProps {
    isOpen: boolean;
    onClose: () => void;
    title?: string;
    children: React.ReactNode;
}

export const BottomActionSheet: React.FC<BottomActionSheetProps> = ({
    isOpen,
    onClose,
    title,
    children,
}) => {
    const [mounted, setMounted] = useState(false);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isOpen) {
            // Small delay to allow render before animation
            requestAnimationFrame(() => setVisible(true));
            document.body.style.overflow = 'hidden';

            return () => {
                document.body.style.overflow = '';
            };
        } else {
            setVisible(false);
            const timer = setTimeout(() => {
                document.body.style.overflow = '';
            }, 300); // Match transition duration

            return () => {
                clearTimeout(timer);
                document.body.style.overflow = '';
            };
        }
    }, [isOpen]);

    if (!mounted) return null;

    const content = (
        <div
            className={`
        fixed inset-0 z-50 flex items-end justify-center sm:items-center
        transition-opacity duration-300
        ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}
      `}
        >
            {/* Backdrop */}
            <div
                className={`
          absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300
          ${visible ? 'opacity-100' : 'opacity-0'}
        `}
                onClick={onClose}
            />

            {/* Sheet */}
            <div
                className={`
          relative w-full max-w-lg bg-brand-surface rounded-t-2xl sm:rounded-2xl p-4 shadow-xl
          transform transition-transform duration-300 ease-out
          ${visible ? 'translate-y-0 scale-100' : 'translate-y-full sm:translate-y-10 sm:scale-95'}
          pb-safe-bottom
        `}
            >
                {/* Handle bar for mobile */}
                <div className="w-12 h-1.5 bg-brand-secondary/20 rounded-full mx-auto mb-4 sm:hidden" />

                <div className="flex items-center justify-between mb-4">
                    {title && (
                        <h2 className="text-lg font-bold text-brand-text-primary">
                            {title}
                        </h2>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-brand-text-muted hover:text-brand-text-primary rounded-full hover:bg-brand-secondary/10 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="max-h-[80vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
