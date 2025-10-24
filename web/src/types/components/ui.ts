// UI component prop types
import type { ReactNode } from 'react';

export interface TabProps {
  label: string;
  value: string;
  disabled?: boolean;
  icon?: ReactNode;
}

export interface TabsProps {
  tabs: TabProps[];
  activeTab: string;
  onChange: (tab: string) => void;
  className?: string;
}

export interface AccordionProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  open?: boolean;
  onToggle?: (open: boolean) => void;
  disabled?: boolean;
}

export interface TooltipProps {
  content: ReactNode;
  children: ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  delay?: number;
  disabled?: boolean;
}

export interface DropdownProps {
  trigger: ReactNode;
  items: Array<{
    label: string;
    onClick?: () => void;
    href?: string;
    disabled?: boolean;
    divider?: boolean;
  }>;
  position?: 'left' | 'right';
  disabled?: boolean;
}

export interface ToastProps {
  type?: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message?: string;
  duration?: number;
  closable?: boolean;
  onClose?: () => void;
}

export interface ProgressProps {
  value: number;
  max?: number;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'success' | 'warning' | 'error';
  showValue?: boolean;
  label?: string;
}

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  color?: 'primary' | 'secondary' | 'accent';
  text?: string;
}

export interface DividerProps {
  orientation?: 'horizontal' | 'vertical';
  spacing?: 'sm' | 'md' | 'lg';
  label?: string;
}

export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

