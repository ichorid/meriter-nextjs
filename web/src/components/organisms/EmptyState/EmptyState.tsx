'use client';

import React from 'react';


export interface EmptyStateProps {
  title?: string;
  message?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  message,
  icon,
  action,
  className = '',
}) => {
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 min-h-[400px] ${className}`}>
      <div className="flex flex-col items-center max-w-md space-y-2 text-center">
        {icon && typeof icon !== 'string' && (
          <div className="mb-2 opacity-50">
            {icon}
          </div>
        )}
        {title && (
          <h3 className="text-base font-normal text-brand-text-secondary">
            {title}
          </h3>
        )}
        {message && (
          <p className="text-sm text-brand-text-secondary opacity-80">
            {message}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
};

