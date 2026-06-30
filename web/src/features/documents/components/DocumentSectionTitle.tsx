'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/shadcn/input';
import { useDocumentStructure } from '@/features/documents/context/DocumentStructureContext';
import { DocumentSectionHeading } from '@/features/documents/components/DocumentSectionHeading';
import { sectionTitleForDisplay } from '@/features/documents/lib/document-canvas-shared';
import { cn } from '@/lib/utils';

export interface DocumentSectionTitleProps {
  sectionId: string;
  title?: string;
  className?: string;
}

export function DocumentSectionTitle({ sectionId, title = '', className }: DocumentSectionTitleProps) {
  const t = useTranslations('pages.documents.structure');
  const structure = useDocumentStructure();
  const [draft, setDraft] = useState(title);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  if (structure?.structureMode) {
    return (
      <Input
        value={draft}
        disabled={structure.structureBusy}
        placeholder={t('sectionTitle')}
        className={cn(
          'h-9 border-dashed border-base-300/80 bg-transparent text-xl font-bold tracking-tight',
          className,
        )}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft.trim() !== title.trim()) {
            structure.onSectionTitleSave(sectionId, draft.trim());
          }
        }}
      />
    );
  }

  const label = sectionTitleForDisplay(title);
  if (!label) {
    return null;
  }

  return <DocumentSectionHeading className={className}>{label}</DocumentSectionHeading>;
}
