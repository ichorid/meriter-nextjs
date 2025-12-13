// Publication content component
'use client';

import React, { useMemo, useState } from 'react';
import { WithTelegramEntities } from '@shared/components/with-telegram-entities';
import DOMPurify from 'dompurify';
import { ImageLightbox } from '@shared/components/image-lightbox';
import { ImageViewer } from '@/components/ui/ImageViewer/ImageViewer';

// Local Publication type definition
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
  // Cover image (legacy imageUrl) - отдельное поле для обложки
  const coverImageUrl = publication.imageUrl || (publication as any).imageUrl;
  // Gallery images (новый массив images) - галерея изображений поста
  const galleryImages = (publication as any).images || [];
  
  // State for lightbox
  const [viewingImageIndex, setViewingImageIndex] = useState<number | null>(null);
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
    <div className={`prose prose-sm dark:prose-invert max-w-none text-base-content ${className}`}>
      {/* Cover Image - кнопка для открытия лайтбокса, если есть imageUrl но нет gallery images */}
      {coverImageUrl && galleryImages.length === 0 && (
        <div className="mb-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingImageIndex(0);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-base-200 hover:bg-base-300 rounded-lg transition-colors text-base-content"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">Показать изображение</span>
          </button>
          {viewingImageIndex === 0 && (
            <ImageViewer
              src={coverImageUrl}
              alt={title ? `${title} - Cover` : 'Publication cover'}
              isOpen={viewingImageIndex === 0}
              onClose={() => setViewingImageIndex(null)}
            />
          )}
        </div>
      )}
      
      {/* Gallery Images - кнопка для открытия лайтбокса */}
      {galleryImages.length > 0 && (
        <div className="mb-4">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setViewingImageIndex(0);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-base-200 hover:bg-base-300 rounded-lg transition-colors text-base-content"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span className="text-sm font-medium">
              {galleryImages.length === 1 
                ? 'Показать изображение' 
                : `Показать ${galleryImages.length} изображений`}
            </span>
          </button>
        </div>
      )}
      
      {/* Lightbox для галереи */}
      <ImageLightbox
        images={galleryImages}
        altPrefix={title ? `${title} - Image` : 'Publication image'}
        initialIndex={viewingImageIndex ?? 0}
        isOpen={galleryImages.length > 0 && viewingImageIndex !== null}
        onClose={() => setViewingImageIndex(null)}
      />
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
