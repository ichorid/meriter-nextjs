import React from 'react';
import { Card, CardContent } from '@/components/ui/shadcn/card';

export interface AuthLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({
  children,
  title,
  subtitle,
}) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-base-200 p-4">
      <Card className="rounded-lg border bg-card text-card-foreground shadow-sm w-full max-w-md">
        <CardContent className="p-6">
          {title && (
            <div className="text-center mb-6">
              <h1 className="text-3xl font-bold mb-2">{title}</h1>
              {subtitle && <p className="text-base-content/70">{subtitle}</p>}
            </div>
          )}
          {children}
        </CardContent>
      </Card>
    </div>
  );
};
