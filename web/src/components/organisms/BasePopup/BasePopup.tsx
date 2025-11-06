'use client';

import React from 'react';
import { BottomPortal } from '@/shared/components/bottom-portal';

export interface BasePopupProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  maxWidth?: string;
}

export const BasePopup: React.FC<BasePopupProps> = ({
  isOpen,
  onClose,
  children,
  maxWidth = 'max-w-md',
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 flex items-end justify-center p-4 pointer-events-auto">
        {/* Backdrop */}
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        {/* Form Container */}
        <div className={`relative z-10 w-full ${maxWidth} bg-base-100 rounded-t-2xl shadow-2xl pointer-events-auto max-h-[90vh] overflow-y-auto`}>
          {children}
        </div>
      </div>
    </BottomPortal>
  );
};

