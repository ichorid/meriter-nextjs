'use client';

import React, { useEffect } from 'react';

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
        <div className={`modal ${isOpen ? 'modal-open' : ''} ${className}`}>
            <div className={`modal-box ${sizeClasses[size]}`}>
                <button
                    className="btn btn-sm btn-circle absolute right-2 top-2"
                    onClick={() => close()}
                >
                    ✕
                </button>
                {title && (
                    <h3 className="font-semibold text-2xl pb-6 text-center">{title}</h3>
                )}

                {/* Loading modal body according to different modal type */}
                {BodyComponent && (
                    <BodyComponent
                        closeModal={close}
                        extraObject={extraObject}
                        {...extraObject}
                    />
                )}
            </div>
        </div>
    );
}

