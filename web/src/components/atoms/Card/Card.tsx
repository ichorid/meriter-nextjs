// Atomic Card component - теперь использует Gluestack UI
'use client';

import React from 'react';
import { Card as GluestackCard, CardHeader as GluestackCardHeader, CardBody as GluestackCardBody, CardFooter as GluestackCardFooter } from '@/components/ui/card';
import { Heading } from '@/components/ui/heading';
import { Box } from '@/components/ui/box';

export interface CardProps {
  hover?: boolean;
  bordered?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const Card = React.forwardRef<any, CardProps>(
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
      <GluestackCard
        ref={ref}
        borderWidth={bordered ? 1 : 0}
        p={compact ? '$2' : '$4'}
        {...props}
      >
        {children}
      </GluestackCard>
    );
  }
);

Card.displayName = 'Card';

export interface CardHeaderProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardHeader = React.forwardRef<any, CardHeaderProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <GluestackCardHeader ref={ref} {...props}>
        {children}
      </GluestackCardHeader>
    );
  }
);
CardHeader.displayName = 'CardHeader';

export interface CardBodyProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardBody = React.forwardRef<any, CardBodyProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <GluestackCardBody ref={ref} {...props}>
        {children}
      </GluestackCardBody>
    );
  }
);
CardBody.displayName = 'CardBody';

export interface CardFooterProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardFooter = React.forwardRef<any, CardFooterProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <GluestackCardFooter ref={ref} {...props}>
        {children}
      </GluestackCardFooter>
    );
  }
);
CardFooter.displayName = 'CardFooter';

export interface CardTitleProps {
  children?: React.ReactNode;
  className?: string;
  [key: string]: any;
}

export const CardTitle = React.forwardRef<any, CardTitleProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <Box ref={ref} {...props}>
        <Heading size="lg">{children}</Heading>
      </Box>
    );
  }
);
CardTitle.displayName = 'CardTitle';
