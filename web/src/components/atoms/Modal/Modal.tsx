// Atomic Modal component
'use client';

import React from 'react';
import { useTranslations } from 'next-intl';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface ModalProps extends React.HTMLAttributes<HTMLDivElement> {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  closable?: boolean;
  children?: React.ReactNode;
  footer?: React.ReactNode;
}

export const Modal = React.forwardRef<HTMLDivElement, ModalProps>(
  (
    {
      isOpen = false,
      onClose,
      title,
      size = 'md',
      closable = true,
      children,
      footer,
      className = '',
      ...props
    },
    ref
  ) => {
    const tCommon = useTranslations('common');
    const sizeClasses = {
      sm: 'modal-box-sm',
      md: '',
      lg: 'modal-box-lg',
      xl: 'modal-box-xl',
      full: 'modal-box-full',
    };

    React.useEffect(() => {
      if (isOpen) {
        document.body.style.overflow = 'hidden';
      } else {
        document.body.style.overflow = '';
      }
      return () => {
        document.body.style.overflow = '';
      };
    }, [isOpen]);

    if (!isOpen) return null;

    return (
      <div
        ref={ref}
        className={`modal ${isOpen ? 'modal-open' : ''} ${className}`}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            onClose();
          }
        }}
        {...props}
      >
        <div
          className={`modal-box ${sizeClasses[size]}`}
          onClick={(e) => e.stopPropagation()}
        >
          {title && (
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">{title}</h3>
              {closable && (
                <button
                  className="btn btn-sm btn-circle btn-ghost"
                  onClick={onClose}
                  aria-label={tCommon('closeModal')}
                >
                  ✕
                </button>
              )}
            </div>
          )}
          {children}
          {footer && (
            <div className="modal-action">
              {footer}
            </div>
          )}
        </div>
        <form method="dialog" className="modal-backdrop">
          <button type="submit" className="hidden">close</button>
        </form>
      </div>
    );
  }
);

Modal.displayName = 'Modal';
