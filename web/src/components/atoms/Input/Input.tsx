import React from 'react';

export type InputSize = 'xs' | 'sm' | 'md' | 'lg';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  size?: InputSize;
  error?: string;
  label?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  fullWidth?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'md',
      error,
      label,
      helperText,
      leftIcon,
      rightIcon,
      fullWidth = false,
      className = '',
      id,
      ...props
    },
    ref
  ) => {
    const sizeClasses = {
      xs: 'input-xs',
      sm: 'input-sm',
      md: 'input-md',
      lg: 'input-lg',
    };

    const inputId = id || `input-${Math.random().toString(36).substring(2, 9)}`;
    
    const inputClasses = [
      'input',
      'input-bordered',
      sizeClasses[size],
      error && 'input-error',
      fullWidth && 'w-full',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <div className={fullWidth ? 'w-full' : ''}>
        {label && (
          <label htmlFor={inputId} className="label">
            <span className="label-text">{label}</span>
          </label>
        )}
        
        <div className="relative">
          {leftIcon && (
            <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/50">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            className={inputClasses}
            style={{ paddingLeft: leftIcon ? '2.5rem' : undefined, paddingRight: rightIcon ? '2.5rem' : undefined }}
            {...props}
          />
          
          {rightIcon && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-base-content/50">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(error || helperText) && (
          <label className="label">
            <span className={`label-text-alt ${error ? 'text-error' : ''}`}>
              {error || helperText}
            </span>
          </label>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
