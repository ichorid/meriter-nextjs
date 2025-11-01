import React from 'react';
import { Spinner, type SpinnerSize } from '../Spinner/Spinner';

export interface LoadingStateProps {
  size?: SpinnerSize;
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

/**
 * Reusable loading state component
 * Provides consistent loading UI across the application
 */
export const LoadingState: React.FC<LoadingStateProps> = ({
  size = 'lg',
  text,
  fullScreen = false,
  className = '',
}) => {
  const baseClasses = fullScreen
    ? 'flex justify-center items-center min-h-screen'
    : 'flex justify-center items-center';
  
  return (
    <div className={`${baseClasses} ${className}`}>
      <Spinner size={size} />
      {text && <span className="ml-2">{text}</span>}
    </div>
  );
};

LoadingState.displayName = 'LoadingState';

