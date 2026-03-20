'use client';

import { useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CollapsibleSection } from '@/components/ui/taxonomy/CollapsibleSection';
import { mergeTicketActivity, type TicketActivityPublicationSlice } from './mergeTicketActivity';

export interface TicketActivityLogCollapsibleProps {
  publication: TicketActivityPublicationSlice;
  defaultOpen?: boolean;
}

export function TicketActivityLogCollapsible({
  publication,
  defaultOpen = false,
}: TicketActivityLogCollapsibleProps) {
  const t = useTranslations('projects');
  const [open, setOpen] = useState(defaultOpen);

  const rows = useMemo(() => mergeTicketActivity(publication, t), [publication, t]);

  if (rows.length === 0) {
    return null;
  }

  return (
    <CollapsibleSection title={t('taskActivityTitle')} open={open} setOpen={setOpen}>
      <ul className="max-h-72 space-y-2 overflow-y-auto text-sm text-base-content/80">
        {rows.map((row, i) => (
          <li key={`${row.kind}-${row.at}-${i}`} className="border-b border-base-300/40 pb-2 last:border-0">
            <div className="text-xs text-base-content/50">
              {new Date(row.at).toLocaleString()}
              {row.actorName ? ` · ${row.actorName}` : ''}
            </div>
            <div>{row.label}</div>
          </li>
        ))}
      </ul>
    </CollapsibleSection>
  );
}
