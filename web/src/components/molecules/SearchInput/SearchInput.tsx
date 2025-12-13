import React from 'react';
import { useTranslations } from 'next-intl';
import { Input, Icon } from '@/components/atoms';

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
    <Input
      type="text"
      placeholder={props.placeholder || tSearch('results.searchPlaceholder')}
      leftIcon={<Icon name="search" size={20} />}
      onChange={handleChange}
      className={className}
      {...props}
    />
  );
};
