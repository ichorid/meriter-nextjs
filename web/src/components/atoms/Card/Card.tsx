'use client';

import React from 'react';

export interface CardProps {
  hover?: boolean;
  bordered?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      hover = false,
      bordered = false,
      compact = false,
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    return (
      <div
        ref={ref}
        className={`
          bg-white rounded-xl shadow-sm
          ${bordered ? 'border border-brand-border' : ''}
          ${compact ? 'p-2' : 'p-4'}
          ${hover ? 'hover:shadow-md transition-shadow duration-200' : ''}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`mb-4 ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export interface CardBodyProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardBody.displayName = 'CardBody';

export interface CardFooterProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`mt-4 pt-4 border-t border-brand-border ${className}`} {...props}>
        {children}
      </div>
    );
  }
);
CardFooter.displayName = 'CardFooter';

export interface CardTitleProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <div ref={ref} className={`${className}`} {...props}>
        <h3 className="text-lg font-bold text-brand-text-primary">{children}</h3>
      </div>
    );
  }
);
CardTitle.displayName = 'CardTitle';
