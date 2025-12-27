'use client';

import React, { useMemo, useState } from 'react';
import { WithTelegramEntities } from '@shared/components/with-telegram-entities';
import DOMPurify from 'dompurify';
import { ImageLightbox } from '@shared/components/image-lightbox';
import { ImageViewer } from '@/components/ui/ImageViewer/ImageViewer';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';
import { Badge } from '@/components/ui/shadcn/badge';

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
  const coverImageUrl = publication.imageUrl || (publication as any).imageUrl;
  const galleryImages = (publication as any).images || [];
  
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
      
      {/* Taxonomy badges - show for project posts */}
      {((publication as any).postType === 'project' || (publication as any).isProject) && (
        <div className="mb-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {(publication as any).impactArea && (
              <Badge className="font-normal">{(publication as any).impactArea}</Badge>
            )}
            {(publication as any).stage && (
              <Badge variant="outline" className="font-normal">{(publication as any).stage}</Badge>
            )}
          </div>
          {(publication as any).beneficiaries && Array.isArray((publication as any).beneficiaries) && (publication as any).beneficiaries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Beneficiaries:</span>
              {((publication as any).beneficiaries as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{x}</Badge>
              ))}
            </div>
          )}
          {(publication as any).methods && Array.isArray((publication as any).methods) && (publication as any).methods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Methods:</span>
              {((publication as any).methods as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{x}</Badge>
              ))}
            </div>
          )}
          {(publication as any).helpNeeded && Array.isArray((publication as any).helpNeeded) && (publication as any).helpNeeded.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">Help needed:</span>
              {((publication as any).helpNeeded as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{x}</Badge>
              ))}
            </div>
          )}
        </div>
      )}
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
