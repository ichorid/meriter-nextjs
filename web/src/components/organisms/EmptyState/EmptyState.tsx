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
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      {icon && <div className="mb-4 text-6xl opacity-50">{icon}</div>}
      {title && (
        <h3 className="text-lg font-semibold text-base-content mb-2">{title}</h3>
      )}
      {message && (
        <p className="text-sm text-base-content/60 text-center max-w-md mb-4">{message}</p>
      )}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
};

