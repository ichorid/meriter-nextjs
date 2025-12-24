// Form component prop types
import type { ReactNode } from 'react';

export interface FormProps {
  onSubmit: (_data: unknown) => void;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}

export interface FormFieldProps {
  name: string;
  label?: string;
  required?: boolean;
  error?: string;
  helperText?: string;
  children: ReactNode;
}

export interface SelectProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (_value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
}

export interface TextareaProps {
  value?: string;
  defaultValue?: string;
  placeholder?: string;
  onChange?: (_value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
  helperText?: string;
  rows?: number;
  maxLength?: number;
}

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (_checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
}

export interface RadioGroupProps {
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  value?: string;
  defaultValue?: string;
  onChange?: (_value: string) => void;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  label?: string;
}

export interface SwitchProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onChange?: (_checked: boolean) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
  helperText?: string;
}

