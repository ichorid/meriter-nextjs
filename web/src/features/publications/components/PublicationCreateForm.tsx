'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreatePublication, useUpdatePublication } from '@/hooks/api/usePublications';
import type { Publication } from '@/types/api-v1';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useWallet } from '@/hooks/api/useWallet';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { BrandCheckbox } from '@/components/ui/BrandCheckbox';
import { HashtagInput } from '@/shared/components/hashtag-input';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { useToastStore } from '@/shared/stores/toast.store';
import { FileText } from 'lucide-react';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { ImageGallery } from '@/components/ui/ImageGallery';

export type PublicationPostType = 'basic' | 'poll' | 'project';

interface PublicationDraft {
  title: string;
  description: string;
  postType: PublicationPostType;
  hashtags: string[];
  imageUrl?: string; // Legacy support
  images?: string[]; // New multi-image support
  isProject: boolean;
  savedAt: string;
}

interface PublicationCreateFormProps {
  communityId: string;
  onSuccess?: (publication: { id: string; slug?: string }) => void;
  onCancel?: () => void;
  defaultPostType?: PublicationPostType;
  publicationId?: string;
  initialData?: Publication;
}

const getDraftKey = (communityId: string) => `publication_draft_${communityId}`;

export const PublicationCreateForm: React.FC<PublicationCreateFormProps> = ({
  communityId,
  onSuccess,
  onCancel,
  defaultPostType = 'basic',
  publicationId,
  initialData,
}) => {
  const t = useTranslations('publications.create');
  const router = useRouter();
  const createPublication = useCreatePublication();
  const updatePublication = useUpdatePublication();
  const { data: community } = useCommunity(communityId);
  const { data: quotaData } = useUserQuota(communityId);
  const { data: wallet } = useWallet(communityId);
  const isEditMode = !!publicationId && !!initialData;

  // Check if this is Good Deeds Marathon community
  const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';
  
  // Get post cost from community settings (default to 1 if not set)
  const postCost = community?.settings?.postCost ?? 1;
  
  // Check if payment is required (not future-vision and cost > 0)
  const requiresPayment = community?.typeTag !== 'future-vision' && postCost > 0;
  const quotaRemaining = quotaData?.remainingToday ?? 0;
  const walletBalance = wallet?.balance ?? 0;
  
  // Automatic payment method selection: quota first, then wallet
  const willUseQuota = requiresPayment && quotaRemaining >= postCost;
  const willUseWallet = requiresPayment && quotaRemaining < postCost && walletBalance >= postCost;
  const hasInsufficientPayment = requiresPayment && quotaRemaining < postCost && walletBalance < postCost;
  const paymentMethod = willUseQuota ? 'quota' : (willUseWallet ? 'wallet' : null);

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || initialData?.content || '');
  const [postType, setPostType] = useState<PublicationPostType>(initialData?.postType || defaultPostType);
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags || []);
  // Support both legacy single image and new multi-image
  const initialImages = initialData?.imageUrl 
    ? [initialData.imageUrl] 
    : ((initialData as any)?.images || []);
  const [images, setImages] = useState<string[]>(initialImages);
  const [isProject, setIsProject] = useState(initialData?.isProject || false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const isSubmittingRef = useRef(false);

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!title.trim()) {
      newErrors.title = t('errors.titleRequired');
    } else if (title.trim().length > 200) {
      newErrors.title = t('errors.titleTooLong', { max: 200 });
    }

    if (!description.trim()) {
      newErrors.description = t('errors.descriptionRequired');
    } else if (description.trim().length > 5000) {
      newErrors.description = t('errors.descriptionTooLong', { max: 5000 });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Load draft on mount (skip if editing)
  useEffect(() => {
    if (isEditMode) {
      return; // Don't load draft when editing
    }
    const draftKey = getDraftKey(communityId);
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft: PublicationDraft = JSON.parse(savedDraft);
        setTitle(draft.title || '');
        setDescription(draft.description || '');
        setPostType(draft.postType || defaultPostType);
        setHashtags(draft.hashtags || []);
        setImages(draft.images || (draft.imageUrl ? [draft.imageUrl] : []));
        setIsProject(draft.isProject || false);
        setHasDraft(true);
        setShowDraftAlert(true);
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [communityId, defaultPostType, isEditMode]);

  // Auto-save draft (skip if editing)
  useEffect(() => {
    if (isEditMode) {
      return; // Don't auto-save draft when editing
    }
    const hasContent = title.trim() || description.trim();
    if (!hasContent) {
      return;
    }

    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      images,
      isProject,
      savedAt: new Date().toISOString(),
    };

    const draftKey = getDraftKey(communityId);
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [title, description, postType, hashtags, images, isProject, communityId, isEditMode]);

  const saveDraft = () => {
    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      images,
      isProject,
      savedAt: new Date().toISOString(),
    };

    const draftKey = getDraftKey(communityId);
    localStorage.setItem(draftKey, JSON.stringify(draft));
    setHasDraft(true);
    addToast(t('draftSaved'), 'success');
  };

  const loadDraft = () => {
    const draftKey = getDraftKey(communityId);
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft: PublicationDraft = JSON.parse(savedDraft);
        setTitle(draft.title || '');
        setDescription(draft.description || '');
        setPostType(draft.postType || defaultPostType);
        setHashtags(draft.hashtags || []);
        setImages(draft.images || (draft.imageUrl ? [draft.imageUrl] : []));
        setIsProject(draft.isProject || false);
        addToast(t('draftLoaded'), 'success');
      } catch (error) {
        console.error('Failed to load draft:', error);
        addToast(t('draftLoadError'), 'error');
      }
    }
  };

  const clearDraft = () => {
    const draftKey = getDraftKey(communityId);
    localStorage.removeItem(draftKey);
    setHasDraft(false);
    setTitle('');
    setDescription('');
    setHashtags([]);
    setImages([]);
    setIsProject(false);
    addToast(t('draftCleared'), 'success');
  };

  const handleSubmit = async () => {
    // Prevent double submission using ref for immediate check
    if (isSubmittingRef.current || isSubmitting) {
      console.warn('Prevented double submission');
      return;
    }

    if (!validate()) {
      return;
    }

    // Set both ref and state immediately to prevent double submission
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});

    try {
      // Ensure postType is 'project' if isProject is true
      const finalPostType = isProject ? 'project' : postType;

      let publication;
      if (isEditMode && publicationId) {
        // Validate publicationId is defined and not empty
        if (!publicationId || publicationId === 'undefined') {
          throw new Error('Publication ID is required for editing');
        }
        
        // Update existing publication
        publication = await updatePublication.mutateAsync({
          id: publicationId,
          data: {
            title: title.trim(),
            description: description.trim(),
            content: description.trim(), // Оставляем для обратной совместимости
            hashtags,
            imageUrl: images.length > 0 ? images[0] : undefined, // Legacy: use first image
            images: images.length > 0 ? images : undefined, // New: support multiple images
          },
        });
      } else {
        // Create new publication with automatic payment (quota first, then wallet)
        const quotaAmount = willUseQuota ? postCost : 0;
        const walletAmount = willUseWallet ? postCost : 0;
        
        publication = await createPublication.mutateAsync({
          communityId,
          title: title.trim(),
          description: description.trim(),
          content: description.trim(), // Оставляем для обратной совместимости
          type: 'text',
          postType: finalPostType,
          isProject: isProject,
          hashtags,
          imageUrl: images.length > 0 ? images[0] : undefined, // Legacy: use first image
          images: images.length > 0 ? images : undefined, // New: support multiple images
          quotaAmount: quotaAmount > 0 ? quotaAmount : undefined,
          walletAmount: walletAmount > 0 ? walletAmount : undefined,
        });

        // Clear draft after successful publication
        const draftKey = getDraftKey(communityId);
        localStorage.removeItem(draftKey);
        setHasDraft(false);
      }

      // Navigate after successful creation/update
      if (onSuccess) {
        onSuccess({ id: publication.id, slug: publication.slug });
      } else {
        // Redirect to post detail page
        // Use slug if available, otherwise fall back to id
        const postIdentifier = publication.slug || publication.id;
        router.push(`/meriter/communities/${communityId}/posts/${postIdentifier}`);
      }
      
      // Don't reset state here - navigation will unmount component
      // If navigation doesn't happen, state will remain but that's okay since we're navigating away
    } catch (error: any) {
      console.error('Publication creation error:', error);
      setErrors({
        submit: error?.message || t('errors.submitFailed'),
      });
      // Reset state on error so user can retry
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle PROJECT checkbox change
  const handleProjectChange = (checked: boolean) => {
    setIsProject(checked);
    if (checked) {
      setPostType('project');
    } else {
      setPostType('basic');
    }
  };

  return (
    <div className="flex-1">
      <div className="space-y-6">
        {/* Draft restore button */}
        {hasDraft && (
          <div className="flex justify-end">
            <BrandButton variant="outline" size="sm" onClick={loadDraft} leftIcon={<FileText size={16} />}>
              {t('loadDraft')}
            </BrandButton>
          </div>
        )}

        {showDraftAlert && hasDraft && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg mb-4 flex items-center justify-between">
            <p className="text-blue-700">{t('draftRestored')}</p>
            <button
              onClick={() => setShowDraftAlert(false)}
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              {t('dismiss')}
            </button>
          </div>
        )}

        {!isEditMode && requiresPayment && (
          <div className={`p-3 rounded-lg border ${
            hasInsufficientPayment
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
          }`}>
                    {hasInsufficientPayment ? (
                        <p className="text-red-700 text-sm">
                            {t('insufficientPayment', { cost: postCost })}
                        </p>
                    ) : postCost > 0 ? (
                        <p className="text-blue-700 text-sm">
                            {willUseQuota 
                                ? t('willPayWithQuota', { remaining: quotaRemaining, cost: postCost })
                                : t('willPayWithWallet', { balance: walletBalance, cost: postCost })}
                        </p>
                    ) : (
                        <p className="text-blue-700 text-sm">
                            {t('postIsFree')}
                        </p>
                    )}
          </div>
        )}

        <BrandFormControl
          label={t('fields.title')}
          error={errors.title}
          helperText={`${title.length}/200 ${t('fields.characters')}`}
          required
        >
          <BrandInput
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('fields.titlePlaceholder')}
            disabled={isSubmitting}
            maxLength={200}
            fullWidth
          />
        </BrandFormControl>

        <BrandFormControl
          label={t('fields.description')}
          error={errors.description}
          helperText={`${description.length}/5000 ${t('fields.characters')}`}
          required
        >
          <RichTextEditor
            content={description}
            onChange={(content) => setDescription(content)}
            placeholder={t('fields.descriptionPlaceholder')}
            className={isSubmitting ? 'opacity-50 pointer-events-none' : ''}
          />
        </BrandFormControl>

        {/* PROJECT checkbox - only for Good Deeds Marathon */}
        {isGoodDeedsMarathon && (
          <BrandFormControl helperText={t('fields.markAsProjectHelp')}>
            <BrandCheckbox
              checked={isProject}
              onChange={handleProjectChange}
              label={t('fields.markAsProject')}
              disabled={isSubmitting}
            />
          </BrandFormControl>
        )}

        {/* Post Type selector - hide if PROJECT checkbox is checked (in marathon communities) or when editing */}
        {!isProject && !isEditMode && (
          <BrandFormControl
            label={t('fields.postType')}
            helperText={t('fields.postTypeHelp')}
          >
            <BrandSelect
              value={postType}
              onChange={(value) => {
                const newType = value as PublicationPostType;
                setPostType(newType);
              }}
              options={[
                { label: t('postTypes.basic'), value: 'basic' },
                { label: t('postTypes.poll'), value: 'poll' },
                ...(isGoodDeedsMarathon ? [] : [{ label: t('postTypes.project'), value: 'project' }]),
              ]}
              placeholder={t('fields.postTypePlaceholder')}
              disabled={isSubmitting}
              fullWidth
            />
          </BrandFormControl>
        )}

        {/* Show poll creation prompt when poll type is selected */}
        {postType === 'poll' && !isProject && (
          <div className="p-4 bg-info/10 border border-info/20 rounded-xl">
            <p className="text-sm text-base-content mb-3">
              {t('pollCreatePrompt')}
            </p>
            <BrandButton
              variant="primary"
              onClick={() => router.push(`/meriter/communities/${communityId}/create-poll`)}
            >
              {t('goToPollCreate')}
            </BrandButton>
          </div>
        )}

        <BrandFormControl
          label={t('fields.images') || 'Images'}
          error={errors.images}
          helperText={t('fields.imagesHelp') || 'Upload up to 10 images for your post'}
        >
          <ImageGallery
            images={images}
            onImagesChange={setImages}
            disabled={isSubmitting}
          />
        </BrandFormControl>

        <HashtagInput
          value={hashtags}
          onChange={setHashtags}
          label={t('fields.hashtags')}
          placeholder={t('fields.hashtagsPlaceholder')}
          helperText={t('fields.hashtagsHelp')}
        />

        {errors.submit && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Preview Toggle */}
        <BrandButton
          variant="outline"
          onClick={() => setShowPreview(!showPreview)}
          className="self-start"
        >
          {showPreview ? t('hidePreview') : t('showPreview')}
        </BrandButton>

        {/* Preview */}
        {showPreview && (title.trim() || description.trim()) && (
          <div className="border border-brand-border rounded-xl overflow-hidden bg-base-100">
            <div className="p-4 space-y-4">
              <h3 className="text-lg font-semibold text-brand-text-primary">{t('preview')}</h3>
              <PublicationContent
                publication={{
                  id: 'preview',
                  createdAt: new Date().toISOString(),
                  title,
                  description,
                  content: description,
                  imageUrl: images.length > 0 ? images[0] : undefined,
                  images: images.length > 0 ? images : undefined,
                  isProject,
                  meta: {},
                }}
              />
              {hashtags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {hashtags.map((tag) => (
                    <div
                      key={tag}
                      className="px-2 py-1 bg-blue-100 rounded-md text-sm text-blue-600"
                    >
                      #{tag}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="h-px bg-brand-border my-6" />

        <div className="flex items-center justify-between gap-4">
          <div className="flex gap-2">
            {hasDraft && (
              <BrandButton variant="outline" onClick={clearDraft} disabled={isSubmitting}>
                {t('clearDraft')}
              </BrandButton>
            )}
          </div>
          <div className="flex gap-2">
            {onCancel && (
              <BrandButton variant="outline" onClick={onCancel} disabled={isSubmitting}>
                {t('cancel')}
              </BrandButton>
            )}
            <BrandButton
              variant="primary"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleSubmit();
              }}
              disabled={!title.trim() || !description.trim() || isSubmitting || isSubmittingRef.current || hasInsufficientPayment}
              isLoading={isSubmitting || isSubmittingRef.current}
            >
              {isEditMode ? (t('update') || 'Update') : t('create')}
            </BrandButton>
          </div>
        </div>
      </div>
    </div>
  );
};
