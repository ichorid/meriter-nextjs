'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useCreatePublication, useUpdatePublication } from '@/hooks/api/usePublications';
import type { Publication } from '@/types/api-v1';
import { useCommunity } from '@/hooks/api/useCommunities';
import { useWallet } from '@/hooks/api/useWallet';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { AlertTriangle, Loader2 } from 'lucide-react';
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
import { useTaxonomyTranslations } from '@/hooks/useTaxonomyTranslations';
import { ENABLE_PROJECT_POSTS, ENABLE_HASHTAGS } from '@/lib/constants/features';
import { GLOBAL_COMMUNITY_ID } from '@/lib/constants/app';
import { CategorySelector } from '@/shared/components/category-selector';
import config from '@/config';

export type PublicationPostType = 'basic' | 'poll' | 'project';

interface PublicationDraft {
  title: string;
  description: string;
  postType: PublicationPostType;
  hashtags: string[];
  categories?: string[]; // Array of category IDs
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

/** Generate placeholder image URLs (dev only). Uses picsum.photos with seed for unique images. */
function getPlaceholderUrls(width: number, height: number, count: number): string[] {
  return Array.from(
    { length: count },
    (_, i) => `https://picsum.photos/seed/dev-${width}-${height}-${i}/${width}/${height}`,
  );
}

const DEV_PLACEHOLDER_SIZES = [
  { w: 200, h: 200, label: '200×200' },
  { w: 800, h: 800, label: '800×800' },
  { w: 1200, h: 400, label: '1200×400' },
  { w: 400, h: 1200, label: '400×1200' },
] as const;

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
  const {
    translateImpactArea,
    translateStage,
    translateBeneficiary,
    translateMethod,
    translateHelpNeeded,
  } = useTaxonomyTranslations();
  const router = useRouter();
  const createPublication = useCreatePublication();
  const updatePublication = useUpdatePublication();
  const { data: community } = useCommunity(communityId);
  // FR-4: Fee is always paid from global wallet (all communities)
  const { data: feeWallet } = useWallet(GLOBAL_COMMUNITY_ID);

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
  // Feature flag: projects are currently disabled
  const isGoodDeedsMarathon = community?.typeTag === 'marathon-of-good';
  const isTeamCommunity = community?.typeTag === 'team';
  const isFutureVision = community?.typeTag === 'future-vision';
  const canCreateProjects = ENABLE_PROJECT_POSTS && (isGoodDeedsMarathon || isTeamCommunity);
  const communityInvestingEnabled = community?.settings?.investingEnabled ?? false;
  const investorShareMin = community?.settings?.investorShareMin ?? 1;
  const investorShareMax = community?.settings?.investorShareMax ?? 99;
  const requireTTLForInvestPosts = community?.settings?.requireTTLForInvestPosts ?? false;
  const tappalkaEnabled = (community as { tappalkaSettings?: { enabled?: boolean } })?.tappalkaSettings?.enabled ?? false;
  // Get post cost from community settings (default to 1 if not set)
  const postCost = community?.settings?.postCost ?? 1;

  // Check if payment is required (cost > 0)
  const requiresPayment = postCost > 0;
  const walletBalance = feeWallet?.balance ?? 0;

  // Fee always paid from global wallet (FR-4)
  const hasInsufficientPayment = requiresPayment && walletBalance < postCost;

  // If project type is requested but projects are disabled, fallback to basic
  const requestedPostType = initialData?.postType === 'project' || initialData?.isProject
    ? 'project'
    : (initialData?.postType || defaultPostType);
  const initialPostType: PublicationPostType =
    (requestedPostType === 'project' && !ENABLE_PROJECT_POSTS) ? 'basic' : requestedPostType;

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(
    initialData?.description || initialData?.content || '',
  );
  const [postType, setPostType] = useState<PublicationPostType>(initialPostType);
  const [hashtags, setHashtags] = useState<string[]>(initialData?.hashtags || []);
  const [categories, setCategories] = useState<string[]>((initialData as any)?.categories || []);
  const [investingEnabled, setInvestingEnabled] = useState<boolean>((initialData as any)?.investingEnabled ?? false);
  const [investorSharePercent, setInvestorSharePercent] = useState<number>((initialData as any)?.investorSharePercent ?? 30);
  const [ttlDays, setTtlDays] = useState<7 | 14 | 30 | 60 | 90 | null>((initialData as any)?.ttlDays ?? null);
  const [stopLoss, setStopLoss] = useState<number>((initialData as any)?.stopLoss ?? 0);
  const [noAuthorWalletSpend, setNoAuthorWalletSpend] = useState<boolean>((initialData as any)?.noAuthorWalletSpend ?? false);
  const [openAdvancedSettings, setOpenAdvancedSettings] = useState(true);
  // Support both legacy single image and new multi-image
  const initialImages = initialData?.imageUrl
    ? [initialData.imageUrl]
    : ((initialData as any)?.images || []);
  const [images, setImages] = useState<string[]>(initialImages);
  const [devPlaceholderCounts, setDevPlaceholderCounts] = useState<Record<string, number>>({
    '200x200': 0,
    '800x800': 0,
    '1200x400': 0,
    '400x1200': 0,
  });
  // Derive isProject from postType instead of separate checkbox
  // Feature flag: projects are currently disabled
  const isProject = ENABLE_PROJECT_POSTS && (postType === 'project' || initialData?.isProject || false);
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

    // Advanced: TTL required when community requires it for invest posts
    if (requireTTLForInvestPosts && investingEnabled && (ttlDays == null || ttlDays === undefined)) {
      newErrors.ttlDays = t('advanced.ttlRequiredForInvest', { defaultValue: 'TTL is required for posts with investing in this community' });
    }
    if (stopLoss < 0) {
      newErrors.stopLoss = t('advanced.stopLossMin', { defaultValue: 'Stop-loss must be 0 or greater' });
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
        setCategories(draft.categories || []);
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
      categories,
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
  }, [title, description, postType, hashtags, categories, images, isProject, impactArea, beneficiaries, methods, stage, helpNeeded, communityId, isEditMode]);

  const saveDraft = () => {
    const draft: PublicationDraft = {
      title,
      description,
      postType,
      hashtags,
      categories,
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
        setCategories(draft.categories || []);
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
    setCategories([]);
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
            hashtags: ENABLE_HASHTAGS ? hashtags : [],
            categories: ENABLE_HASHTAGS ? [] : categories,
            images: images.length > 0 ? images : [], // Always send array, even if empty
            // Taxonomy fields (editable)
            impactArea: impactArea || undefined,
            beneficiaries,
            methods,
            stage: stage || undefined,
            helpNeeded,
            // Mutable advanced settings (author-only enforced by backend)
            stopLoss,
            noAuthorWalletSpend,
            ttlDays: ttlDays ?? undefined,
          },
        });
      } else {
        // Create new publication with wallet payment
        publication = await createPublication.mutateAsync({
          communityId,
          title: title.trim(),
          description: description.trim(),
          content: description.trim(), // Оставляем для обратной совместимости
          type: 'text',
          postType: finalPostType === 'project' && !ENABLE_PROJECT_POSTS ? 'basic' : finalPostType,
          isProject: ENABLE_PROJECT_POSTS && finalPostType === 'project',
          hashtags: ENABLE_HASHTAGS ? hashtags : [],
          categories: ENABLE_HASHTAGS ? [] : categories,
          images: images.length > 0 ? images : undefined, // Always use array
          impactArea: impactArea || undefined,
          beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
          methods: methods.length > 0 ? methods : undefined,
          stage: stage || undefined,
          helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
          investingEnabled: investingEnabled || undefined,
          investorSharePercent: investingEnabled ? investorSharePercent : undefined,
          ttlDays: ttlDays ?? undefined,
          stopLoss: stopLoss ?? 0,
          noAuthorWalletSpend: noAuthorWalletSpend || undefined,
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
    <div className="flex-1 px-4 flex flex-col min-h-0">
      {/* Scrollable form content */}
      <div className="flex-1 overflow-x-visible overflow-y-auto pb-24 min-h-0">
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
            <div className="p-3 bg-blue-50 shadow-none rounded-lg mb-4 flex items-center justify-between">
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
            <div className={`p-3 rounded-lg border ${hasInsufficientPayment
              ? 'bg-red-50 border-red-200'
              : 'bg-blue-50 border-blue-200'
              }`}>
              {hasInsufficientPayment ? (
                <p className="text-red-700 text-sm">
                  {t('insufficientPayment', { cost: postCost })}
                </p>
              ) : postCost > 0 ? (
                <p className="text-blue-700 text-sm">
                  {t('willPayWithWallet', { balance: walletBalance, cost: postCost })}
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
                          {translateImpactArea(area)}
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
                          {translateStage(s)}
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
                summary={beneficiaries.length ? beneficiaries.map(translateBeneficiary).join(', ') : t('taxonomy.beneficiariesHint') || 'Who benefits directly?'}
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
                    translateValue={translateBeneficiary}
                    onToggle={(v: Beneficiary) => setBeneficiaries((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={`${t('taxonomy.methods') || 'What you do'} (≤3)${methods.length ? ` • ${methods.length}` : ''}`}
                open={openMethods}
                setOpen={setOpenMethods}
                summary={methods.length ? methods.map(translateMethod).join(', ') : t('taxonomy.methodsHint') || 'How does the project create impact?'}
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
                    translateValue={translateMethod}
                    onToggle={(v) => setMethods((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>

              <CollapsibleSection
                title={`${t('taxonomy.helpNeeded') || 'Help needed'} (≤3)${helpNeeded.length ? ` • ${helpNeeded.length}` : ''}`}
                open={openHelp}
                setOpen={setOpenHelp}
                summary={helpNeeded.length ? helpNeeded.map(translateHelpNeeded).join(', ') : t('taxonomy.helpNeededHint') || 'What are you collecting right now?'}
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
                    translateValue={translateHelpNeeded}
                    onToggle={(v: HelpNeeded) => setHelpNeeded((s) => toggleInArray(s, v))}
                  />
                </div>
              </CollapsibleSection>
            </>
          )}

          {/* Advanced Settings - collapsible when community has investing or tappalka (create + edit) */}
          {(communityInvestingEnabled || tappalkaEnabled) && (
            <CollapsibleSection
              title={t('advanced.title', { defaultValue: 'Advanced settings' })}
              open={openAdvancedSettings}
              setOpen={setOpenAdvancedSettings}
            >
              <div className="space-y-6 pt-1">
                {/* Investing: only when community allows. In edit mode: read-only with explanation */}
                {communityInvestingEnabled && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Checkbox
                        id="investingEnabled"
                        checked={investingEnabled}
                        onCheckedChange={(checked) => !isEditMode && setInvestingEnabled(checked === true)}
                        disabled={isSubmitting || isEditMode}
                      />
                      <Label htmlFor="investingEnabled" className="text-sm font-medium cursor-pointer">
                        {t('investing.enable', { defaultValue: 'Open for investments' })}
                      </Label>
                      <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500" title={t('advanced.immutableHint', { defaultValue: 'Cannot be changed after publishing' })}>
                        <AlertTriangle className="h-4 w-4" aria-hidden />
                        <span className="text-xs">{t('advanced.immutableHint', { defaultValue: 'Cannot be changed after publishing' })}</span>
                      </span>
                    </div>
                    {investingEnabled && (
                      <div className="pl-6 space-y-2">
                        <BrandFormControl
                          label={t('investing.shareLabel', { defaultValue: 'Investor share (%)' }) + (isEditMode ? '' : ` (${investorShareMin}–${investorShareMax})`)}
                          helperText={isEditMode ? t('advanced.investorShareReadOnly', { defaultValue: 'Investment contract percentage is immutable.' }) : t('advanced.investorShareHelp', { defaultValue: 'Percentage of withdrawn merits distributed to investors. Cannot be changed after publishing.' })}
                        >
                          <div className="flex items-center gap-4">
                            <input
                              type="range"
                              min={investorShareMin}
                              max={investorShareMax}
                              value={investorSharePercent}
                              onChange={(e) => !isEditMode && setInvestorSharePercent(parseInt(e.target.value, 10))}
                              className="flex-1 h-2 rounded-lg appearance-none cursor-pointer bg-base-content/20"
                              disabled={isSubmitting || isEditMode}
                            />
                            <Input
                              type="number"
                              min={investorShareMin}
                              max={investorShareMax}
                              value={investorSharePercent}
                              onChange={(e) => {
                                if (isEditMode) return;
                                const v = parseInt(e.target.value, 10);
                                if (!Number.isNaN(v)) setInvestorSharePercent(Math.min(investorShareMax, Math.max(investorShareMin, v)));
                              }}
                              className="w-20 h-9"
                              disabled={isSubmitting || isEditMode}
                            />
                          </div>
                        </BrandFormControl>
                      </div>
                    )}
                  </div>
                )}

                {/* TTL, stop-loss, wallet: only when tappalka enabled. Edit mode: TTL increase-only */}
                {tappalkaEnabled && (
                  <>
                    <BrandFormControl
                      label={t('advanced.ttlLabel', { defaultValue: 'Time to live (TTL)' })}
                      helperText={t('advanced.ttlHelp', { defaultValue: 'Post will automatically close after this period. Cannot be reduced after publishing.' })}
                      error={errors.ttlDays}
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <Select
                          value={ttlDays == null ? 'indefinite' : String(ttlDays)}
                          onValueChange={(v) => setTtlDays(v === 'indefinite' ? null : (Number(v) as 7 | 14 | 30 | 60 | 90))}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger className="w-[180px]">
                            <SelectValue placeholder={t('advanced.ttlPlaceholder', { defaultValue: 'Select TTL' })} />
                          </SelectTrigger>
                          <SelectContent>
                            {(() => {
                              const all: (7 | 14 | 30 | 60 | 90)[] = [7, 14, 30, 60, 90];
                              const current = ttlDays ?? 0;
                              const allowed = isEditMode ? all.filter((d) => d >= current) : all;
                              return (
                                <>
                                  {allowed.map((d) => (
                                    <SelectItem key={d} value={String(d)}>
                                      {t('advanced.ttlDays', { n: d, defaultValue: `${d} days` })}
                                    </SelectItem>
                                  ))}
                                  <SelectItem
                                    value="indefinite"
                                    disabled={
                                      (requireTTLForInvestPosts && investingEnabled) ||
                                      (isEditMode && ttlDays != null)
                                    }
                                  >
                                    {t('advanced.ttlIndefinite', { defaultValue: 'Indefinite' })}
                                  </SelectItem>
                                </>
                              );
                            })()}
                          </SelectContent>
                        </Select>
                        {(requireTTLForInvestPosts && investingEnabled) && (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500 text-xs">
                            <AlertTriangle className="h-4 w-4" aria-hidden />
                            {t('advanced.immutableHint', { defaultValue: 'Cannot be changed after publishing' })}
                          </span>
                        )}
                      </div>
                    </BrandFormControl>

                    <BrandFormControl
                      label={t('advanced.stopLossLabel', { defaultValue: 'Minimum rating for post carousel (0 = disabled)' })}
                      helperText={t('advanced.stopLossHelp', { defaultValue: 'Post exits the carousel if rating drops below this value. Can be changed later.' })}
                      error={errors.stopLoss}
                    >
                      <Input
                        type="number"
                        min={0}
                        value={stopLoss}
                        onChange={(e) => {
                          const v = parseInt(e.target.value, 10);
                          if (!Number.isNaN(v) && v >= 0) setStopLoss(v);
                        }}
                        className="w-32"
                        disabled={isSubmitting}
                      />
                    </BrandFormControl>

                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="noAuthorWalletSpend"
                        checked={noAuthorWalletSpend}
                        onCheckedChange={(checked) => setNoAuthorWalletSpend(checked === true)}
                        disabled={isSubmitting}
                      />
                      <Label htmlFor="noAuthorWalletSpend" className="text-sm font-medium cursor-pointer">
                        {t('advanced.noAuthorWalletSpendLabel', { defaultValue: "Don't spend from my wallet on post carousel shows" })}
                      </Label>
                    </div>
                    <p className="text-xs text-muted-foreground pl-6">
                      {t('advanced.noAuthorWalletSpendHelp', { defaultValue: 'If enabled, shows stop when investment pool and rating are depleted, without touching your wallet. Can be changed later.' })}
                    </p>
                  </>
                )}
              </div>
            </CollapsibleSection>
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

          {config.app.isDevelopment && (
            <div className="rounded-xl border border-dashed border-base-300 bg-base-200/30 p-4 space-y-3">
              <p className="text-sm font-medium text-base-content/80">
                {t('fields.devPlaceholdersTitle', { defaultValue: 'Add placeholders (dev only)' })}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {DEV_PLACEHOLDER_SIZES.map(({ w, h, label }) => {
                  const key = `${w}x${h}`;
                  const value = devPlaceholderCounts[key] ?? 0;
                  return (
                    <div key={key} className="flex flex-col gap-1">
                      <Label className="text-xs text-base-content/70">{label}</Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={value}
                        onChange={(e) => {
                          const n = Math.max(0, Math.min(10, parseInt(e.target.value, 10) || 0));
                          setDevPlaceholderCounts((prev) => ({ ...prev, [key]: n }));
                        }}
                        className="h-9"
                      />
                    </div>
                  );
                })}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() => {
                  const urls: string[] = [];
                  DEV_PLACEHOLDER_SIZES.forEach(({ w, h }) => {
                    const key = `${w}x${h}`;
                    const count = devPlaceholderCounts[key] ?? 0;
                    urls.push(...getPlaceholderUrls(w, h, count));
                  });
                  if (urls.length === 0) return;
                  const total = images.length + urls.length;
                  if (total > 10) {
                    addToast(t('fields.devPlaceholdersMax', { max: 10 }) ?? 'Max 10 images per post', 'error');
                    return;
                  }
                  setImages((prev) => [...prev, ...urls]);
                }}
              >
                {t('fields.devPlaceholdersAdd', { defaultValue: 'Add placeholders' })}
              </Button>
            </div>
          )}

          {ENABLE_HASHTAGS ? (
            <HashtagInput
              value={hashtags}
              onChange={setHashtags}
              label={t('fields.hashtags')}
              placeholder={t('fields.hashtagsPlaceholder')}
              helperText={t('fields.hashtagsHelp')}
            />
          ) : (
            <CategorySelector
              value={categories}
              onChange={setCategories}
              label={t('fields.categories')}
              helperText={t('fields.categoriesHelp')}
              maxCategories={2}
            />
          )}

          {errors.submit && (
            <div className="p-3 bg-red-50 shadow-none rounded-lg">
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
            <div className="shadow-none rounded-xl overflow-hidden bg-base-100">
              <div className="p-4 space-y-4">
                <h3 className="text-lg font-semibold text-brand-text-primary">{t('preview')}</h3>
                <PublicationContent
                  publication={{
                    id: 'preview',
                    createdAt: new Date().toISOString(),
                    title,
                    description,
                    content: description,
                    images: images.length > 0 ? images : undefined,
                    isProject,
                    postType: postType,
                    impactArea: impactArea && impactArea.trim() ? impactArea : undefined,
                    stage: stage && stage.trim() ? stage : undefined,
                    beneficiaries: beneficiaries.length > 0 ? beneficiaries : undefined,
                    methods: methods.length > 0 ? methods : undefined,
                    helpNeeded: helpNeeded.length > 0 ? helpNeeded : undefined,
                    categories: ENABLE_HASHTAGS ? [] : categories,
                    meta: {},
                  }}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer with action buttons */}
      <div className="sticky bottom-0 z-10 pb-24 bg-base-100 border-t border-brand-border mt-auto">
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
