'use client';

import React, { useMemo, useState } from 'react';
import { WithTelegramEntities } from '@shared/components/with-telegram-entities';
import DOMPurify from 'dompurify';
import { _ImageLightbox } from '@shared/components/image-lightbox';
import { _ImageViewer } from '@/components/ui/ImageViewer/ImageViewer';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';

interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  imageUrl?: string;
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
    commentTgEntities?: unknown[];
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
  const title = (publication as unknown).title;
  const description = (publication as unknown).description;
  const isProject = (publication as unknown).isProject;
  const coverImageUrl = publication.imageUrl || (publication as unknown).imageUrl;
  const galleryImages = (publication as unknown).images || [];
  
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
  const content = typeof publication.meta?.comment === 'string'
    ? publication.meta.comment
    : typeof publication.content === 'string'
      ? publication.content
      : '';

  const isHtmlContent = useMemo(() => {
    return content.includes('<') && content.includes('>');
  }, [content]);

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
    <div className={`prose prose-sm dark:prose-invert max-w-none text-base-content ${className}`}>
      {coverImageUrl && galleryImages.length === 0 && (
        <ImageGalleryDisplay
          images={[coverImageUrl]}
          altPrefix={title ? `${title} - Cover` : 'Publication cover'}
          initialIndex={viewingImageIndex}
          onClose={() => setViewingImageIndex(null)}
          onImageClick={(index) => setViewingImageIndex(index)}
        />
      )}
      
      {galleryImages.length > 0 && (
        <ImageGalleryDisplay
          images={galleryImages}
          altPrefix={title ? `${title} - Image` : 'Publication image'}
          initialIndex={viewingImageIndex}
          onClose={() => setViewingImageIndex(null)}
          onImageClick={(index) => setViewingImageIndex(index)}
        />
      )}
      {isProject && (
        <div className="mb-2">
          <span className="inline-block px-2 py-1 text-xs font-semibold text-white bg-blue-600 rounded">
            ПРОЕКТ
          </span>
        </div>
      )}
      {title && (
        <h3 className="text-lg font-semibold mb-2 text-base-content">{title}</h3>
      )}
      {description && isHtmlContent ? (
        <div
          className="text-base-content mb-3"
          dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
        />
      ) : description ? (
        <p className="text-base-content mb-3">{description}</p>
      ) : null}
      {content && !description && (
        isHtmlContent ? (
          <div className="text-base-content" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
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