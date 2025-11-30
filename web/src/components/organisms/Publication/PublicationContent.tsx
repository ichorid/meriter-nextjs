// Publication content component
'use client';

import React, { useMemo } from 'react';
import { WithTelegramEntities } from '@shared/components/withTelegramEntities';
import DOMPurify from 'dompurify';

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

  // Check if content is HTML (from RichTextEditor)
  const isHtmlContent = useMemo(() => {
    return content.includes('<') && content.includes('>');
  }, [content]);

  // Sanitize HTML content
  const sanitizedHtml = useMemo(() => {
    if (isHtmlContent && typeof window !== 'undefined') {
      return DOMPurify.sanitize(content, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'u', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'a', 'blockquote', 'code'],
        ALLOWED_ATTR: ['href', 'target', 'rel'],
      });
    }
    return content;
  }, [content, isHtmlContent]);

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
      {description && isHtmlContent ? (
        <div
          className="text-gray-700 mb-3"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : description ? (
        <p className="text-gray-700 mb-3">{description}</p>
      ) : null}
      {content && !description && (
        isHtmlContent ? (
          <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        ) : (
          <WithTelegramEntities
            entities={publication.meta?.commentTgEntities || []}
          >
            {content}
          </WithTelegramEntities>
        )
      )}
    </div>
  );
};
