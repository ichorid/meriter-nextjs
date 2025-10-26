// Publication content component
'use client';

import React from 'react';
import { WithTelegramEntities } from '@shared/components/withTelegramEntities';

// Local Publication type definition
interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  metrics?: {
    score?: number;
  };
  meta?: {
    commentTgEntities?: any[];
    comment?: string;
  };
  [key: string]: unknown;
}

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
        entities={publication.meta?.commentTgEntities || []}
      >
        {publication.meta?.comment || publication.content || ''}
      </WithTelegramEntities>
    </div>
  );
};
