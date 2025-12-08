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
            className={`
                fixed inset-0 z-[100] flex items-end justify-center sm:items-center
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
                className={`
                    relative w-full max-w-lg bg-base-100 rounded-t-3xl sm:rounded-2xl shadow-2xl
                    transform transition-all duration-300 ease-out
                    ${visible ? 'translate-y-0 scale-100' : 'translate-y-full sm:translate-y-10 sm:scale-95'}
                `}
            >
                {/* Handle bar for mobile */}
                <div className="w-10 h-1 bg-base-content/20 rounded-full mx-auto mt-3 sm:hidden" />

                {/* Header */}
                <div className="flex items-center justify-between px-5 pt-4 pb-3">
                    {title ? (
                        <h2 className="text-lg font-semibold text-base-content">
                            {title}
                        </h2>
                    ) : (
                        <div />
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 -mr-2 text-base-content/50 hover:text-base-content rounded-full hover:bg-base-content/5 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="px-5 pb-8 max-h-[70vh] overflow-y-auto">
                    {children}
                </div>
            </div>
        </div>
    );

    return createPortal(content, document.body);
};
