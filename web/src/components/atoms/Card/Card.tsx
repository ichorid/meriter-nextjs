'use client';

import React from 'react';
import {
  Card as ShadcnCard,
  CardHeader as ShadcnCardHeader,
  CardTitle as ShadcnCardTitle,
  CardDescription,
  CardContent as ShadcnCardContent,
  CardFooter as ShadcnCardFooter,
} from '@/components/ui/shadcn/card';
import { cn } from '@/lib/utils';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  hover?: boolean;
  bordered?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
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
      <ShadcnCard
        ref={ref}
        className={cn(
          'rounded-xl',
          bordered && 'border',
          compact && 'p-2',
          !compact && 'p-4',
          hover && 'hover:shadow-md transition-shadow duration-200',
          className
        )}
        {...props}
      >
        {children}
      </ShadcnCard>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ShadcnCardHeader ref={ref} className={cn('mb-4', className)} {...props}>
        {children}
      </ShadcnCardHeader>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export interface CardBodyProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardBody = React.forwardRef<HTMLDivElement, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ShadcnCardContent ref={ref} className={className} {...props}>
        {children}
      </ShadcnCardContent>
    );
  }
);
CardBody.displayName = 'CardBody';

export interface CardFooterProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardFooter = React.forwardRef<HTMLDivElement, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ShadcnCardFooter
        ref={ref}
        className={cn('mt-4 pt-4 border-t', className)}
        {...props}
      >
        {children}
      </ShadcnCardFooter>
    );
  }
);
CardFooter.displayName = 'CardFooter';

export interface CardTitleProps extends React.HTMLAttributes<HTMLDivElement> {
  children?: React.ReactNode;
}

export const CardTitle = React.forwardRef<HTMLDivElement, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <ShadcnCardTitle ref={ref} className={cn('text-lg', className)} {...props}>
        {children}
      </ShadcnCardTitle>
    );
  }
);
CardTitle.displayName = 'CardTitle';

// Export CardDescription for convenience
export { CardDescription };
