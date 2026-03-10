'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useSearchUsers, useUserProfile } from '@/hooks/api/useUsers';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Button } from '@/components/ui/shadcn/button';
import { cn } from '@/lib/utils';

export interface BeneficiarySelectorProps {
  value: string | null;
  onChange: (userId: string | null) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function BeneficiarySelector({
  value,
  onChange,
  placeholder,
  className,
  disabled = false,
}: BeneficiarySelectorProps) {
  const t = useTranslations('publications.create');
  const [query, setQuery] = useState('');
  const { data: searchResult, isLoading } = useSearchUsers(query.trim(), 15);
  const users = useMemo(() => searchResult ?? [], [searchResult]);
  const { data: selectedUser } = useUserProfile(value ?? '');
  const selectedLabel = selectedUser?.displayName ?? selectedUser?.username ?? (value ? value.slice(0, 8) : '');
  const showClear = !!value;

  return (
    <div className={cn('space-y-2', className)}>
      <Label>{t('beneficiary', { defaultValue: 'Beneficiary' })}</Label>
      <div className="flex flex-wrap gap-2 items-center">
        <Input
          type="search"
          placeholder={placeholder ?? t('searchUser', { defaultValue: 'Search user (min 2 chars)' })}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={disabled}
          className="max-w-xs"
        />
        {showClear && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              onChange(null);
              setQuery('');
            }}
            disabled={disabled}
          >
            {t('clear', { defaultValue: 'Clear' })}
          </Button>
        )}
      </div>
      {value && selectedLabel && (
        <p className="text-sm text-muted-foreground">{selectedLabel}</p>
      )}
      {query.trim().length >= 2 && (
        <ul className="border rounded-md divide-y max-h-48 overflow-auto">
          {isLoading && <li className="p-2 text-sm text-muted-foreground">…</li>}
          {!isLoading && users.length === 0 && (
            <li className="p-2 text-sm text-muted-foreground">{t('noUsersFound', { defaultValue: 'No users found' })}</li>
          )}
          {!isLoading &&
            users.map((u: { id: string; displayName?: string; username?: string }) => (
              <li key={u.id}>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-2"
                  onClick={() => {
                    onChange(u.id);
                    setQuery('');
                  }}
                  disabled={disabled}
                >
                  {u.displayName ?? u.username ?? u.id.slice(0, 8)}
                </Button>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
