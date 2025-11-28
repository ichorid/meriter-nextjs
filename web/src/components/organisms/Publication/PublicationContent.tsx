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
    author?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    beneficiary?: {
      id: string;
      name: string;
      photoUrl?: string;
      username?: string;
    };
    origin?: {
      telegramChatName?: string;
    };
    hashtagName?: string;
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
  const title = (publication as any).title;
  const description = (publication as any).description;
  const isProject = (publication as any).isProject;
  const content = typeof publication.meta?.comment === 'string' 
    ? publication.meta.comment 
    : typeof publication.content === 'string' 
      ? publication.content 
      : '';

  return (
    <div className={`prose prose-sm max-w-none ${className}`}>
      {isProject && (
        <div className="mb-2">
          <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded">
            ПРОЕКТ
          </span>
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-gray-700 mb-3">{description}</p>
      )}
      {content && (
        <WithTelegramEntities
          entities={publication.meta?.commentTgEntities || []}
        >
          {content}
        </WithTelegramEntities>
      )}
    </div>
  );
};
