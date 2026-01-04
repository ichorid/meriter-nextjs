'use client';

import React, { useMemo, useState } from 'react';
import { WithTelegramEntities } from '@shared/components/with-telegram-entities';
import DOMPurify from 'dompurify';
import { ImageLightbox } from '@shared/components/image-lightbox';
import { ImageViewer } from '@/components/ui/ImageViewer/ImageViewer';
import { ImageGalleryDisplay } from '@shared/components/image-gallery-display';
import { Badge } from '@/components/ui/shadcn/badge';
import { useTranslations } from 'next-intl';
import { useTaxonomyTranslations } from '@/hooks/useTaxonomyTranslations';
import { ENABLE_HASHTAGS } from '@/lib/constants/features';
import { useCategories } from '@/hooks/api/useCategories';

interface Publication {
  id: string;
  slug?: string;
  content?: string;
  createdAt: string;
  imageUrl?: string;
  images?: string[]; // Add images array to interface
  hashtags?: string[]; // Add hashtags array to interface
  categories?: string[]; // Add categories array to interface (category IDs)
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
  onCategoryClick?: (categoryId: string) => void;
}

export const PublicationContent: React.FC<PublicationContentProps> = ({
  publication,
  className = '',
  onCategoryClick,
}) => {
  const t = useTranslations('publications.create.taxonomy');
  const {
    translateImpactArea,
    translateStage,
    translateBeneficiary,
    translateMethod,
    translateHelpNeeded,
  } = useTaxonomyTranslations();
  const { data: allCategories } = useCategories();

  const title = (publication as any).title;
  const description = (publication as any).description;
  const isProject = (publication as any).isProject;
  const coverImageUrl = publication.imageUrl || (publication as any).imageUrl;
  const galleryImages = (publication as any).images || [];

  // FRONTEND DEBUG
  console.log('[PublicationContent DEBUG]', {
    id: publication.id,
    hasImages: !!(publication as any).images,
    imagesLength: ((publication as any).images || []).length,
    galleryImages,
    coverImageUrl
  });

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
        />
      )}

      {galleryImages.length > 0 && (
        <ImageGalleryDisplay
          images={galleryImages}
          altPrefix={title ? `${title} - Image` : 'Publication image'}
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
              <Badge className="font-normal">{translateImpactArea((publication as any).impactArea)}</Badge>
            )}
            {(publication as any).stage && (
              <Badge variant="outline" className="font-normal">{translateStage((publication as any).stage)}</Badge>
            )}
          </div>
          {(publication as any).beneficiaries && Array.isArray((publication as any).beneficiaries) && (publication as any).beneficiaries.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('beneficiaries')}:</span>
              {((publication as any).beneficiaries as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{translateBeneficiary(x)}</Badge>
              ))}
            </div>
          )}
          {(publication as any).methods && Array.isArray((publication as any).methods) && (publication as any).methods.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('methods')}:</span>
              {((publication as any).methods as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{translateMethod(x)}</Badge>
              ))}
            </div>
          )}
          {(publication as any).helpNeeded && Array.isArray((publication as any).helpNeeded) && (publication as any).helpNeeded.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-muted-foreground">{t('helpNeeded')}:</span>
              {((publication as any).helpNeeded as string[]).map((x) => (
                <Badge key={x} variant="secondary" className="font-normal">{translateHelpNeeded(x)}</Badge>
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
      
      {/* Hashtags or Categories - show if they exist */}
      {ENABLE_HASHTAGS ? (
        publication.hashtags && Array.isArray(publication.hashtags) && publication.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {publication.hashtags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-2 py-0.5 rounded-sm text-gray-700 dark:text-gray-800 text-xs font-normal"
                style={{ backgroundColor: '#E0E0E0' }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )
      ) : (
        publication.categories && Array.isArray(publication.categories) && publication.categories.length > 0 && allCategories && (
          <div className="flex flex-wrap gap-2 mt-3">
            {publication.categories.map((categoryId) => {
              const category = allCategories.find(c => c.id === categoryId);
              if (!category) return null;
              return (
                <button
                  key={categoryId}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onCategoryClick) {
                      onCategoryClick(categoryId);
                    }
                  }}
                  className="inline-flex items-center px-2 py-0.5 rounded-sm text-gray-700 dark:text-gray-800 text-xs font-normal cursor-pointer hover:opacity-80 transition-opacity"
                  style={{ backgroundColor: '#E0E0E0' }}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        )
      )}
    </div>
  );
};
