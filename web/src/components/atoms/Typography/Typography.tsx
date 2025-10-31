import React from 'react';

export type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

export interface HeadingProps extends React.HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
}

export const Heading = React.forwardRef<HTMLHeadingElement, HeadingProps>(
  (
    {
      as = 'h1',
      className = '',
      children,
      ...props
    },
    ref
  ) => {
    const Tag = as;
    
    const sizeClasses = {
      h1: 'text-4xl font-bold',
      h2: 'text-3xl font-bold',
      h3: 'text-2xl font-semibold',
      h4: 'text-xl font-semibold',
      h5: 'text-lg font-medium',
      h6: 'text-base font-medium',
    };

    return (
      <Tag ref={ref} className={`${sizeClasses[as]} ${className}`} {...props}>
        {children}
      </Tag>
    );
  }
);

Heading.displayName = 'Heading';

export interface ParagraphProps extends React.HTMLAttributes<HTMLParagraphElement> {}
export const Paragraph = React.forwardRef<HTMLParagraphElement, ParagraphProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <p ref={ref} className={`text-base ${className}`} {...props}>
        {children}
      </p>
    );
  }
);

Paragraph.displayName = 'Paragraph';

export interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {}
export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <label ref={ref} className={`text-sm font-medium ${className}`} {...props}>
        {children}
      </label>
    );
  }
);

Label.displayName = 'Label';

export interface SmallProps extends React.HTMLAttributes<HTMLElement> {}
export const Small = React.forwardRef<HTMLElement, SmallProps>(
  ({ className = '', children, ...props }, ref) => {
    return (
      <small ref={ref} className={`text-xs ${className}`} {...props}>
        {children}
      </small>
    );
  }
);

Small.displayName = 'Small';
