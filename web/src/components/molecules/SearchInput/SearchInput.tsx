import React from 'react';
import { useTranslations } from 'next-intl';
import { Icon } from '@/components/atoms';
import { Input } from '@/components/ui/shadcn/input';
import { cn } from '@/lib/utils';

export interface SearchInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  onSearch?: (value: string) => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({
  onSearch,
  onChange,
  className = '',
  ...props
}) => {
  const tSearch = useTranslations('search');
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange?.(e);
    onSearch?.(e.target.value);
  };

  return (
    <div className="relative">
      <Icon 
        name="search" 
        size={20} 
        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none z-10" 
      />
      <Input
        type="text"
        placeholder={props.placeholder || tSearch('results.searchPlaceholder')}
        onChange={handleChange}
        className={cn('pl-10', className)}
        {...props}
      />
    </div>
  );
};
