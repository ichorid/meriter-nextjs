// Publication content component
'use client';

import React from 'react';
import { WithTelegramEntities } from '@shared/components/withTelegramEntities';
import type { Publication } from '@/types/entities';

interface PublicationContentProps {
  publication: Publication;
  className?: string;
}

export const PublicationContent: React.FC<PublicationContentProps> = ({
  publication,
  className = '',
}) => {
  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      <WithTelegramEntities
        entities={publication.meta.commentTgEntities || []}
      >
        {publication.meta.comment}
      </WithTelegramEntities>
    </div>
  );
};
