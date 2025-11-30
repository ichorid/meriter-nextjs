'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreatePublication } from '@/hooks/api/usePublications';
import { useCommunity } from '@/hooks/api/useCommunities';
import { BrandButton } from '@/components/ui/BrandButton';
import { BrandInput } from '@/components/ui/BrandInput';
import { BrandSelect } from '@/components/ui/BrandSelect';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { BrandCheckbox } from '@/components/ui/BrandCheckbox';
import { HashtagInput } from '@/shared/components/HashtagInput';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { useToastStore } from '@/shared/stores/toast.store';
import { X, Check, ArrowLeft, Save, FileText, Loader2 } from 'lucide-react';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';

export type PublicationPostType = 'basic' | 'poll' | 'project';

interface PublicationDraft {
  title: string;
  description: string;
  postType: PublicationPostType;
  hashtags: string[];
  imageUrl: string;
  isProject: boolean;
  savedAt: string;
}

interface PublicationCreateFormProps {
  communityId: string;
  onSuccess?: (publicationId: string) => void;
  onCancel?: () => void;
  defaultPostType?: PublicationPostType;
}

const getDraftKey = (communityId: string) => `publication_draft_${communityId}`;

export const PublicationCreateForm: React.FC<PublicationCreateFormProps> = ({
  communityId,
  onSuccess,
  onCancel,
  defaultPostType = 'basic',
}) => {
  const t = useTranslations('publications.create');
  const router = useRouter();
  const createPublication = useCreatePublication();
  const { data: community } = useCommunity(communityId);

  // Check if this is Good Deeds Marathon community
  const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [postType, setPostType] = useState<PublicationPostType>(defaultPostType);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [imageUrl, setImageUrl] = useState('');
  const [isProject, setIsProject] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [hasDraft, setHasDraft] = useState(false);
  const [showDraftAlert, setShowDraftAlert] = useState(false);
  const addToast = useToastStore((state) => state.addToast);

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

    if (imageUrl && !isValidUrl(imageUrl)) {
      newErrors.imageUrl = t('errors.invalidUrl');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidUrl = (url: string): boolean => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  };

  // Load draft on mount
  useEffect(() => {
    const draftKey = getDraftKey(communityId);
    const savedDraft = localStorage.getItem(draftKey);
    if (savedDraft) {
      try {
        const draft: PublicationDraft = JSON.parse(savedDraft);
        setTitle(draft.title || '');
        setDescription(draft.description || '');
        setPostType(draft.postType || defaultPostType);
        setHashtags(draft.hashtags || []);
        setImageUrl(draft.imageUrl || '');
        setIsProject(draft.isProject || false);
        setHasDraft(true);
        setShowDraftAlert(true);
      } catch (error) {
        console.error('Failed to load draft:', error);
      }
    }
  }, [communityId, defaultPostType]);

  // Auto-save draft
  useEffect(() => {
    const hasContent = title.trim() || description.trim();
    if (!hasContent) {
      return;
    }

    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      imageUrl,
      isProject,
      savedAt: new Date().toISOString(),
    };

    const draftKey = getDraftKey(communityId);
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [title, description, postType, hashtags, imageUrl, isProject, communityId]);

  const saveDraft = () => {
    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      imageUrl,
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
        setImageUrl(draft.imageUrl || '');
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
    setImageUrl('');
    setIsProject(false);
    addToast(t('draftCleared'), 'success');
  };

  const handleSubmit = async () => {
    if (!validate()) {
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      // Ensure postType is 'project' if isProject is true
      const finalPostType = isProject ? 'project' : postType;

      const publication = await createPublication.mutateAsync({
        communityId,
        title: title.trim(),
        description: description.trim(),
        content: description.trim(), // Оставляем для обратной совместимости
        type: 'text',
        postType: finalPostType,
        isProject: isProject,
        hashtags,
        imageUrl: imageUrl || undefined,
      });

      // Clear draft after successful publication
      const draftKey = getDraftKey(communityId);
      localStorage.removeItem(draftKey);
      setHasDraft(false);

      if (onSuccess) {
        onSuccess(publication.id);
      } else {
        router.push(`/meriter/communities/${communityId}/posts/${publication.id}`);
      }
    } catch (error: any) {
      setErrors({
        submit: error?.message || t('errors.submitFailed'),
      });
    } finally {
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
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <BrandButton
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="p-0"
            >
              <ArrowLeft size={24} />
            </BrandButton>
            <h1 className="text-xl font-bold text-brand-text-primary">{t('title')}</h1>
          </div>
          {hasDraft && (
            <BrandButton variant="outline" size="sm" onClick={loadDraft} leftIcon={<FileText size={16} />}>
              {t('loadDraft')}
            </BrandButton>
          )}
        </div>

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

        {/* Post Type selector - hide if PROJECT is selected */}
        {!isProject && (
          <BrandFormControl
            label={t('fields.postType')}
            helperText={t('fields.postTypeHelp')}
          >
            <BrandSelect
              value={postType}
              onChange={(value) => {
                setPostType(value as PublicationPostType);
                if (value === 'project') {
                  setIsProject(true);
                } else {
                  setIsProject(false);
                }
              }}
              options={[
                { label: t('postTypes.basic'), value: 'basic' },
                { label: t('postTypes.poll'), value: 'poll' },
                { label: t('postTypes.project'), value: 'project' },
              ]}
              placeholder={t('fields.postTypePlaceholder')}
              disabled={isSubmitting}
              fullWidth
            />
          </BrandFormControl>
        )}

        <BrandFormControl
          label={t('fields.imageUrl')}
          error={errors.imageUrl}
          helperText={t('fields.imageUrlHelp')}
        >
          <BrandInput
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t('fields.imageUrlPlaceholder')}
            disabled={isSubmitting}
            fullWidth
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
            {(title.trim() || description.trim()) && (
              <BrandButton variant="outline" onClick={saveDraft} disabled={isSubmitting} leftIcon={<Save size={16} />}>
                {t('saveDraft')}
              </BrandButton>
            )}
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
              onClick={handleSubmit}
              disabled={!title.trim() || !description.trim() || isSubmitting}
              isLoading={isSubmitting}
            >
              {t('create')}
            </BrandButton>
          </div>
        </div>
      </div>
    </div>
  );
};
