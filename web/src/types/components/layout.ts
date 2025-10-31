// Layout component prop types
import type { ReactNode } from 'react';

export interface LayoutProps {
  children: ReactNode;
  className?: string;
}

export interface HeaderProps extends LayoutProps {
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  avatar?: {
    src?: string;
    name?: string;
    onClick?: () => void;
  };
  breadcrumbs?: Array<{
    label: string;
    href?: string;
  }>;
}

export interface SidebarProps extends LayoutProps {
  isOpen?: boolean;
  onToggle?: () => void;
  items?: Array<{
    label: string;
    href?: string;
    icon?: ReactNode;
    active?: boolean;
    onClick?: () => void;
  }>;
}

export interface FooterProps extends LayoutProps {
  links?: Array<{
    label: string;
    href: string;
  }>;
  copyright?: string;
}

export interface PageProps extends LayoutProps {
  title?: string;
  description?: string;
  loading?: boolean;
  error?: string;
  actions?: ReactNode;
  sidebar?: ReactNode;
}

export interface ContainerProps extends LayoutProps {
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  centered?: boolean;
}

export interface GridProps extends LayoutProps {
  cols?: 1 | 2 | 3 | 4 | 5 | 6 | 12;
  gap?: 'none' | 'sm' | 'md' | 'lg';
  responsive?: boolean;
}

export interface FlexProps extends LayoutProps {
  direction?: 'row' | 'column';
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  gap?: 'none' | 'sm' | 'md' | 'lg';
  wrap?: boolean;
}

