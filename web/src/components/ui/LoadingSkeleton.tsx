'use client';

import React from 'react';

interface LoadingSkeletonProps {
  className?: string;
  count?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  className = '',
  count = 1,
}) => {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={index}
          className={`animate-pulse bg-base-200 rounded-xl transition-opacity duration-300 ${className}`}
        />
      ))}
    </>
  );
};

export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-full flex items-center p-4 bg-brand-surface shadow-none rounded-xl animate-fade-in">
      <div className="w-10 h-10 bg-base-200 rounded-lg mr-4 animate-pulse" />
      <div className="flex-1 space-y-2">
        <div className="h-4 bg-base-200 rounded w-3/4 animate-pulse" />
        <div className="h-3 bg-base-200 rounded w-1/2 animate-pulse" />
      </div>
    </div>
  );
};

