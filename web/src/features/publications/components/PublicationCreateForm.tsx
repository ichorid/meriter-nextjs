'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreatePublication, useUpdatePublication } from '@/hooks/api/usePublications';
import type { Publication } from '@/types/api-v1';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useUserQuota } from '@/hooks/api/useQuota';
import { useWallet } from '@/hooks/api/useWallet';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { Loader2 } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/shadcn/select';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import { cn } from '@/lib/utils';
import { HashtagInput } from '@/shared/components/hashtag-input';
import { PublicationContent } from '@/components/organisms/Publication/PublicationContent';
import { useToastStore } from '@/shared/stores/toast.store';
import { FileText } from 'lucide-react';
import { RichTextEditor } from '@/components/molecules/RichTextEditor';
import { ImageGallery } from '@/components/ui/ImageGallery';
import { Checklist, CollapsibleSection } from '@/components/ui/taxonomy';
import {
  IMPACT_AREAS,
  BENEFICIARIES,
  METHODS,
  STAGES,
  HELP_NEEDED,
  type ImpactArea,
  type Beneficiary,
  type Method,
  type Stage,
  type HelpNeeded,
} from '@/lib/constants/taxonomy';

export type PublicationPostType = 'basic' | 'poll' | 'project';

interface PublicationDraft {
  title: string;
  description: string;
  postType: PublicationPostType;
  hashtags: string[];
  imageUrl?: string; // Legacy support
  images?: string[]; // New multi-image support
  isProject: boolean;
  // Taxonomy fields
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
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

// Helper function to toggle items in array
function toggleInArray<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
}

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

  const normalizeEntityId = (id: string | undefined): string | null => {
    const trimmed = (id ?? '').trim();
    if (!trimmed || trimmed === 'undefined' || trimmed === 'null') return null;
    return trimmed;
  };
  const isEditMode = !!initialData;
  
  // In edit mode, we must have a publication ID.
  // Prefer the publicationId prop, but if missing, use initialData.id (which should always be present from API)
  const effectivePublicationId = publicationId || initialData?.id;
  const normalizedPublicationId = normalizeEntityId(effectivePublicationId);

  // Check if this is Good Deeds Marathon or Team community (both allow project creation)
  const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';
  const isTeamCommunity = community?.typeTag === 'team';
  const isFutureVision = community?.typeTag === 'future-vision';
  const canCreateProjects = isGoodDeedsMarathon || isTeamCommunity;
  
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

  const initialPostType: PublicationPostType =
    initialData?.postType === 'project' || initialData?.isProject
      ? 'project'
      : (initialData?.postType || defaultPostType);

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(
    initialData?.description || initialData?.content || '',
  );
  const [postType, setPostType] = useState<PublicationPostType>(initialPostType);
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags || []);
  // Support both legacy single image and new multi-image
  const initialImages = initialData?.imageUrl 
    ? [initialData.imageUrl] 
    : ((initialData as any)?.images || []);
  const [images, setImages] = useState<string[]>(initialImages);
  // Derive isProject from postType instead of separate checkbox
  const isProject = postType === 'project' || initialData?.isProject || false;
  // Taxonomy fields
  const [impactArea, setImpactArea] = useState<ImpactArea | ''>((initialData as any)?.impactArea || '');
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>((initialData as any)?.beneficiaries || []);
  const [methods, setMethods] = useState<Method[]>((initialData as any)?.methods || []);
  const [stage, setStage] = useState<Stage | ''>((initialData as any)?.stage || '');
  const [helpNeeded, setHelpNeeded] = useState<HelpNeeded[]>((initialData as any)?.helpNeeded || []);
  // Collapsible sections state (folded by default)
  const [openBeneficiaries, setOpenBeneficiaries] = useState(false);
  const [openMethods, setOpenMethods] = useState(false);
  const [openHelp, setOpenHelp] = useState(false);
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

    // Validate taxonomy fields for project posts
    const finalPostType = isProject ? 'project' : postType;
    if (finalPostType === 'project') {
      if (!impactArea) {
        newErrors.impactArea = t('errors.impactAreaRequired') || 'Impact area is required for project posts';
      }
      if (!stage) {
        newErrors.stage = t('errors.stageRequired') || 'Stage is required for project posts';
      }
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
        // If draft has isProject but no postType, set postType to 'project' for backwards compatibility
        const draftPostType = draft.postType || (draft.isProject ? 'project' : defaultPostType);
        setPostType(draftPostType);
        setHashtags(draft.hashtags || []);
        setImages(draft.images || (draft.imageUrl ? [draft.imageUrl] : []));
        setImpactArea((draft.impactArea as ImpactArea) || '');
        setBeneficiaries(draft.beneficiaries || []);
        setMethods(draft.methods || []);
        setStage((draft.stage as Stage) || '');
        setHelpNeeded(draft.helpNeeded || []);
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
      impactArea: impactArea || undefined,
      beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
      methods: methods.length > 0 ? methods : undefined,
      stage: stage || undefined,
      helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
      savedAt: new Date().toISOString(),
    };

    const draftKey = getDraftKey(communityId);
    localStorage.setItem(draftKey, JSON.stringify(draft));
  }, [title, description, postType, hashtags, images, isProject, impactArea, beneficiaries, methods, stage, helpNeeded, communityId, isEditMode]);

  const saveDraft = () => {
    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      images,
      isProject,
      impactArea: impactArea || undefined,
      beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
      methods: methods.length > 0 ? methods : undefined,
      stage: stage || undefined,
      helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
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
        // If draft has isProject but no postType, set postType to 'project' for backwards compatibility
        const draftPostType = draft.postType || (draft.isProject ? 'project' : defaultPostType);
        setPostType(draftPostType);
        setHashtags(draft.hashtags || []);
        setImages(draft.images || (draft.imageUrl ? [draft.imageUrl] : []));
        setImpactArea((draft.impactArea as ImpactArea) || '');
        setBeneficiaries(draft.beneficiaries || []);
        setMethods(draft.methods || []);
        setStage((draft.stage as Stage) || '');
        setHelpNeeded(draft.helpNeeded || []);
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
    setPostType(defaultPostType);
    setImpactArea('');
    setBeneficiaries([]);
    setMethods([]);
    setStage('');
    setHelpNeeded([]);
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

    // In edit mode, we must have a real publication ID.
    if (isEditMode && !normalizedPublicationId) {
      const message = 'Publication ID is required for editing';
      addToast(message, 'error');
      setErrors({ submit: message });
      return;
    }

    // Set both ref and state immediately to prevent double submission
    isSubmittingRef.current = true;
    setIsSubmitting(true);
    setErrors({});

    try {
      // Use postType directly (isProject is derived from it)
      const finalPostType = postType;

      let publication;
      if (isEditMode) {
        // Double-check that we have a valid publication ID before updating
        if (!normalizedPublicationId) {
          const message = 'Publication ID is required for editing';
          addToast(message, 'error');
          setErrors({ submit: message });
          isSubmittingRef.current = false;
          setIsSubmitting(false);
          return;
        }
        
        // Update existing publication
        publication = await updatePublication.mutateAsync({
          id: normalizedPublicationId,
          data: {
            title: title.trim(),
            description: description.trim(),
            content: description.trim(), // Оставляем для обратной совместимости
            hashtags,
            imageUrl: images.length > 0 ? images[0] : undefined, // Legacy: use first image
            // NOTE: backend UpdatePublicationDtoSchema is strict and currently does not support `images`.
            // We intentionally only send `imageUrl` when editing.
            // Taxonomy fields (editable)
            impactArea: impactArea || undefined,
            beneficiaries,
            methods,
            stage: stage || undefined,
            helpNeeded,
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
          isProject: finalPostType === 'project',
          hashtags,
          imageUrl: images.length > 0 ? images[0] : undefined, // Legacy: use first image
          images: images.length > 0 ? images : undefined, // New: support multiple images
          quotaAmount: quotaAmount > 0 ? quotaAmount : undefined,
          walletAmount: walletAmount > 0 ? walletAmount : undefined,
          impactArea: impactArea || undefined,
          beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
          methods: methods.length > 0 ? methods : undefined,
          stage: stage || undefined,
          helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
        } as any); // Type assertion needed until types regenerate

        // Clear draft after successful publication
        const draftKey = getDraftKey(communityId);
        localStorage.removeItem(draftKey);
        setHasDraft(false);
      }

      // Navigate after successful creation/update
      if (onSuccess) {
        onSuccess({ id: publication.id, slug: publication.slug });
      } else {
        // Redirect to community list with highlight to show the post in the list
        // Use slug if available, otherwise fall back to id
        const postIdentifier = publication.slug || publication.id;
        router.push(`/meriter/communities/${communityId}?highlight=${postIdentifier}`);
      }
      
      // Don't reset state here - navigation will unmount component
      // If navigation doesn't happen, state will remain but that's okay since we're navigating away
    } catch (error: any) {
      const errorMessage = error?.message || t('errors.submitFailed');
      console.error(isEditMode ? 'Publication update error:' : 'Publication creation error:', error);
      setErrors({
        submit: errorMessage,
      });
      addToast(errorMessage, 'error');
      // Reset state on error so user can retry
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };


  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Scrollable form content */}
      <div className="flex-1 overflow-y-auto pb-24 min-h-0">
        <div className="space-y-6">
          {/* Draft restore button */}
          {hasDraft && (
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={loadDraft} className="rounded-xl active:scale-[0.98]">
                <FileText size={16} />
                {t('loadDraft')}
              </Button>
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
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('fields.titlePlaceholder')}
              disabled={isSubmitting}
              maxLength={200}
              className="h-11 rounded-xl w-full"
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

          {/* Taxonomy fields - show for project posts */}
          {postType === 'project' && (
            <>
              <div className="text-xs text-muted-foreground mb-2">
                {t('taxonomy.requiredForProjects') || 'Required fields for project posts'}
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <BrandFormControl
                  label={t('taxonomy.impactArea') || 'Impact Area'}
                  error={errors.impactArea}
                  required
                >
                  <Select
                    value={impactArea}
                    onValueChange={(value) => setImpactArea(value as ImpactArea)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                      <SelectValue placeholder={t('taxonomy.selectImpactArea') || 'Choose one'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(IMPACT_AREAS) ? [...IMPACT_AREAS] : []).map((area: ImpactArea) => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </BrandFormControl>

                <BrandFormControl
                  label={t('taxonomy.stage') || 'Stage'}
                  error={errors.stage}
                  required
                >
                  <Select
                    value={stage}
                    onValueChange={(value) => setStage(value as Stage)}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger className={cn('h-11 rounded-xl w-full')}>
                      <SelectValue placeholder={t('taxonomy.selectStage') || 'Choose one'} />
                    </SelectTrigger>
                    <SelectContent>
                      {(Array.isArray(STAGES) ? [...STAGES] : []).map((s: Stage) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </BrandFormControl>
              </div>

              <div className="text-xs text-muted-foreground mt-4 mb-2">
                {t('taxonomy.optionalFacets') || 'Optional facets (folded by default). Add them only if they help discovery.'}
              </div>

              <CollapsibleSection
                title={`${t('taxonomy.beneficiaries') || 'Beneficiaries'} (≤2)${beneficiaries.length ? ` • ${beneficiaries.length}` : ''}`}
                open={openBeneficiaries}
                setOpen={setOpenBeneficiaries}
                summary={beneficiaries.length ? beneficiaries.join(', ') : t('taxonomy.beneficiariesHint') || 'Who benefits directly?'}
                right={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setBeneficiaries([]);
                    }}
                    disabled={!beneficiaries.length || isSubmitting}
                  >
                    {t('taxonomy.clear') || 'Clear'}
                  </Button>
                }
              >
                <div className="pt-1">
                  <Checklist
                    options={Array.isArray(BENEFICIARIES) ? [...BENEFICIARIES] : []}
                    selected={beneficiaries}
                    cap={2}
                    hint={t('taxonomy.beneficiariesHint') || 'Who benefits directly?'}
                    onToggle={(v: Beneficiary) => setBeneficiaries((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={`${t('taxonomy.methods') || 'What you do'} (≤3)${methods.length ? ` • ${methods.length}` : ''}`}
                open={openMethods}
                setOpen={setOpenMethods}
                summary={methods.length ? methods.join(', ') : t('taxonomy.methodsHint') || 'How does the project create impact?'}
                right={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setMethods([]);
                    }}
                    disabled={!methods.length || isSubmitting}
                  >
                    {t('taxonomy.clear') || 'Clear'}
                  </Button>
                }
              >
                <div className="pt-1">
                  <Checklist
                    options={Array.isArray(METHODS) ? [...METHODS] : []}
                    selected={methods}
                    cap={3}
                    hint={t('taxonomy.methodsHint') || 'How does the project create impact?'}
                    onToggle={(v) => setMethods((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={`${t('taxonomy.helpNeeded') || 'Help needed'} (≤3)${helpNeeded.length ? ` • ${helpNeeded.length}` : ''}`}
                open={openHelp}
                setOpen={setOpenHelp}
                summary={helpNeeded.length ? helpNeeded.join(', ') : t('taxonomy.helpNeededHint') || 'What are you collecting right now?'}
                right={
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setHelpNeeded([]);
                    }}
                    disabled={!helpNeeded.length || isSubmitting}
                  >
                    {t('taxonomy.clear') || 'Clear'}
                  </Button>
                }
              >
                <div className="pt-1">
                  <Checklist
                    options={Array.isArray(HELP_NEEDED) ? [...HELP_NEEDED] : []}
                    selected={helpNeeded}
                    cap={3}
                    hint={t('taxonomy.helpNeededHint') || 'What are you collecting right now?'}
                    onToggle={(v: HelpNeeded) => setHelpNeeded((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>
            </>
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
          <Button
            variant="outline"
            onClick={() => setShowPreview(!showPreview)}
            className="rounded-xl active:scale-[0.98] self-start"
          >
            {showPreview ? t('hidePreview') : t('showPreview')}
          </Button>

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
                    postType: postType,
                    impactArea: impactArea && impactArea.trim() ? impactArea : undefined,
                    stage: stage && stage.trim() ? stage : undefined,
                    beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
                    methods: methods.length > 0 ? methods : undefined,
                    helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
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
        </div>
      </div>

      {/* Sticky footer with action buttons */}
      <div className="sticky bottom-0 z-10 bg-base-100 border-t border-brand-border shadow-lg mt-auto">
        <div className="px-4 py-4 safe-area-inset-bottom">
          <div className="flex items-center justify-between gap-4">
            <div className="flex gap-2">
              {hasDraft && (
                <Button variant="outline" onClick={clearDraft} disabled={isSubmitting} className="rounded-xl active:scale-[0.98]">
                  {t('clearDraft')}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {onCancel && (
                <Button variant="outline" onClick={onCancel} disabled={isSubmitting} className="rounded-xl active:scale-[0.98]">
                  {t('cancel')}
                </Button>
              )}
              <Button
                variant="default"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleSubmit();
                }}
                disabled={
                  !title.trim() ||
                  !description.trim() ||
                  isSubmitting ||
                  isSubmittingRef.current ||
                  hasInsufficientPayment ||
                  (isEditMode && !normalizedPublicationId) ||
                  (postType === 'project' && (!impactArea || !stage))
                }
                className="rounded-xl active:scale-[0.98]"
              >
                {(isSubmitting || isSubmittingRef.current) && <Loader2 className="h-4 w-4 animate-spin" />}
                {isEditMode ? (t('update') || 'Update') : t('create')}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
