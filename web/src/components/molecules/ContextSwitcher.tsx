'use client';

import { useMemo } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { useActingAsStore } from '@/stores/acting-as.store';
import { useLeadCommunities } from '@/hooks/api/useProfile';
import { useAuth } from '@/contexts/AuthContext';

const SELF_VALUE = '__self__';

/**
 * Dropdown to switch posting context: as self or as a community (for leads).
 * When a community is selected, publication.create and withdraw send actingAsCommunityId.
 */
export function ContextSwitcher() {
  const { user } = useAuth();
  const { actingAsCommunityId, setActingAs } = useActingAsStore();
  const { data: leadCommunities = [] } = useLeadCommunities(user?.id ?? '');

  const options = useMemo(
    () => [
      { value: SELF_VALUE, label: 'As myself' },
      ...leadCommunities.map((c: { id: string; name?: string }) => ({
        value: c.id,
        label: `As ${c.name ?? c.id}`,
      })),
    ],
    [leadCommunities],
  );

  if (leadCommunities.length === 0) return null;

  return (
    <Select
      value={actingAsCommunityId ?? SELF_VALUE}
      onValueChange={(v) => setActingAs(v === SELF_VALUE ? null : v)}
    >
      <SelectTrigger className="w-[180px]">
        <SelectValue placeholder="Post as..." />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
