'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateProject } from '@/hooks/api/useProjects';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { ValuesFormPickerFields } from '@/shared/components/value-rubricator/ValuesFormPickerFields';
import { usePlatformValueRubricatorSections } from '@/shared/hooks/usePlatformValueRubricator';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { ImageUploader } from '@/components/ui/ImageUploader/ImageUploader';
import { FutureVisionCoverDevPlaceholders } from '@/shared/components/FutureVisionCoverDevPlaceholders';
import { AmountStepper } from '@/components/ui/shadcn/amount-stepper';
import { BrandFormControl } from '@/components/ui/BrandFormControl';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/utils';
import { AlertTriangle } from 'lucide-react';

const NEW_COMMUNITY_VALUE = '__new__';
const PRIORITY_TYPE_TAGS = ['future-vision', 'marathon-of-good', 'team-projects', 'support'] as const;

const SECTION_HEADING =
  'text-xs font-semibold uppercase tracking-wide text-base-content/50';

export function CreateProjectForm() {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('communities');
  const { user } = useAuth();
  const createProject = useCreateProject();
  const { sections: rubricatorSections } = usePlatformValueRubricatorSections();

  const { communities: allCommunities } = useUserCommunities();
  const { data: userRoles = [] } = useUserRoles(user?.id || '');

  const { administeredCommunities, memberCommunities } = useMemo(() => {
    const privateOnly = allCommunities.filter(
      (c) => !PRIORITY_TYPE_TAGS.includes(c.typeTag as (typeof PRIORITY_TYPE_TAGS)[number])
    );
    const leadIds = new Set(userRoles.filter((r) => r.role === 'lead').map((r) => r.communityId));
    const administered = privateOnly.filter((c) => leadIds.has(c.id));
    const member = privateOnly.filter((c) => !leadIds.has(c.id));
    return { administeredCommunities: administered, memberCommunities: member };
  }, [allCommunities, userRoles]);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectDuration, setProjectDuration] = useState<'finite' | 'ongoing' | undefined>(undefined);
  const [founderSharePercent, setFounderSharePercent] = useState<number>(0);
  const [investorSharePercent, setInvestorSharePercent] = useState<number>(0);
  const [investingEnabled, setInvestingEnabled] = useState(false);
  const [personalProject, setPersonalProject] = useState(false);
  const [parentChoice, setParentChoice] = useState<string>('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityFutureVision, setNewCommunityFutureVision] = useState('');
  const [valueTags, setValueTags] = useState<string[]>([]);
  const [newCommunityCover, setNewCommunityCover] = useState('');

  const isNewCommunity = parentChoice === NEW_COMMUNITY_VALUE;

  const setPersonalProjectChecked = (checked: boolean) => {
    setPersonalProject(checked);
    if (checked) {
      setParentChoice('');
      setNewCommunityName('');
      setNewCommunityFutureVision('');
      setNewCommunityCover('');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!personalProject && !parentChoice) return;
    if (!personalProject && isNewCommunity && !newCommunityName.trim()) return;
    if (!personalProject && isNewCommunity && !newCommunityFutureVision.trim()) return;

    const tagsPayload = valueTags.length > 0 ? valueTags : undefined;
    if (personalProject) {
      createProject.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        projectDuration,
        founderSharePercent: founderSharePercent || 0,
        investorSharePercent: investingEnabled ? (investorSharePercent || 0) : 0,
        investingEnabled,
        personalProject: true,
        futureVisionTags: tagsPayload,
      });
      return;
    }

    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      projectDuration,
      founderSharePercent: founderSharePercent || 0,
      investorSharePercent: investingEnabled ? (investorSharePercent || 0) : 0,
      investingEnabled,
      parentCommunityId: isNewCommunity ? undefined : parentChoice,
      futureVisionTags: tagsPayload,
      newCommunity: isNewCommunity
        ? {
            name: newCommunityName.trim(),
            futureVisionText: newCommunityFutureVision.trim(),
            futureVisionTags: tagsPayload,
            futureVisionCover: newCommunityCover.trim() || undefined,
            typeTag: 'custom',
          }
        : undefined,
    });
  };

  const pending = createProject.isPending;
  const canSubmit =
    !!name.trim() &&
    (personalProject ||
      (!!parentChoice &&
        (!isNewCommunity || (!!newCommunityName.trim() && !!newCommunityFutureVision.trim()))));

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-8 sm:gap-10 max-w-2xl w-full"
    >
      {/* —— Basics —— */}
      <section aria-labelledby="create-project-basics-heading" className="space-y-4">
        <h2 id="create-project-basics-heading" className={SECTION_HEADING}>
          {t('formSectionBasics')}
        </h2>
        <BrandFormControl label={t('name')} required>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('projectNamePlaceholder')}
            required
            disabled={pending}
            className="h-11 rounded-xl w-full text-base"
          />
        </BrandFormControl>
        <BrandFormControl label={t('description')}>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={t('shortDescriptionPlaceholder')}
            rows={4}
            disabled={pending}
            className="rounded-xl w-full min-h-[104px] resize-y text-base leading-relaxed"
          />
        </BrandFormControl>
      </section>

      {/* —— Ownership (personal vs parent community) —— */}
      <section
        aria-labelledby="create-project-ownership-heading"
        className="rounded-2xl border border-base-300/80 bg-base-200/35 dark:bg-base-300/20 p-4 sm:p-6 space-y-5 shadow-sm"
      >
        <header className="space-y-2">
          <h2 id="create-project-ownership-heading" className={SECTION_HEADING}>
            {t('formSectionOwnership')}
          </h2>
          <p className="text-sm text-base-content/65 leading-relaxed max-w-prose">
            {t('formSectionOwnershipHint')}
          </p>
        </header>

        <div
          className={cn(
            'rounded-xl border-2 p-4 sm:p-4 transition-colors',
            personalProject
              ? 'border-primary/45 bg-primary/[0.07] dark:bg-primary/[0.09]'
              : 'border-base-300/80 bg-base-100/55 dark:bg-base-100/10'
          )}
        >
          <div className="flex items-start gap-3.5">
            <Checkbox
              id="personalProject"
              checked={personalProject}
              onCheckedChange={(c) => setPersonalProjectChecked(c === true)}
              disabled={pending}
              className="mt-1 shrink-0"
            />
            <div className="space-y-1 min-w-0 flex-1">
              <Label
                htmlFor="personalProject"
                className="text-sm font-semibold cursor-pointer leading-snug text-base-content"
              >
                {t('personalProject')}
              </Label>
              <p className="text-xs sm:text-sm text-base-content/60 leading-snug">
                {t('personalProjectHint')}
              </p>
            </div>
          </div>
        </div>

        {!personalProject && (
          <div className="space-y-2.5 pt-1 border-t border-base-300/70">
            <Label htmlFor="parent-community-trigger" className="text-sm font-medium">
              {t('parentCommunity')} <span className="text-destructive">*</span>
            </Label>
            <Select value={parentChoice} onValueChange={setParentChoice} required disabled={pending}>
              <SelectTrigger
                id="parent-community-trigger"
                className="h-11 w-full rounded-xl text-base"
              >
                <SelectValue placeholder={t('selectCommunityPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {administeredCommunities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{tCommunities('administeredCommunities')}</SelectLabel>
                    {administeredCommunities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                {memberCommunities.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>{tCommunities('communitiesIMemberOf')}</SelectLabel>
                    {memberCommunities.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}
                <SelectSeparator className="my-2" />
                <SelectItem
                  value={NEW_COMMUNITY_VALUE}
                  className="font-semibold border-t border-base-200 pt-2 mt-1 bg-base-200/50 dark:bg-base-300/50"
                >
                  {t('createNewCommunity')}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {isNewCommunity && !personalProject && (
          <div className="rounded-xl border border-dashed border-primary/35 bg-base-100/70 dark:bg-base-100/10 p-4 sm:p-5 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-base-content">{t('formSectionNewCommunity')}</h3>
              <p className="text-xs text-base-content/60 mt-1 leading-snug">{t('formSectionNewCommunityHint')}</p>
            </div>
            <BrandFormControl label={t('newCommunityName')} required={isNewCommunity}>
              <Input
                id="newName"
                value={newCommunityName}
                onChange={(e) => setNewCommunityName(e.target.value)}
                placeholder={t('communityNamePlaceholder')}
                required={isNewCommunity}
                disabled={pending}
                className="h-11 rounded-xl w-full text-base"
              />
            </BrandFormControl>
            <BrandFormControl label={t('futureVisionRequired')} required={isNewCommunity}>
              <Textarea
                id="futureVision"
                value={newCommunityFutureVision}
                onChange={(e) => setNewCommunityFutureVision(e.target.value)}
                placeholder={t('futureVisionPlaceholder')}
                rows={4}
                required={isNewCommunity}
                disabled={pending}
                className="rounded-xl w-full min-h-[104px] resize-y text-base leading-relaxed"
              />
            </BrandFormControl>
            <div className="space-y-2">
              <span className="text-sm font-medium text-base-content">{t('futureVisionCoverLabel')}</span>
              <ImageUploader
                value={newCommunityCover || undefined}
                onUpload={setNewCommunityCover}
                onRemove={() => setNewCommunityCover('')}
                disabled={pending}
                aspectRatio={16 / 9}
                compact
                allowUrlFallback
              />
              <FutureVisionCoverDevPlaceholders onSelectUrl={setNewCommunityCover} disabled={pending} />
            </div>
          </div>
        )}
      </section>

      {(personalProject || !!parentChoice) && (
        <section aria-labelledby="create-project-values-heading" className="space-y-3">
          <h2 id="create-project-values-heading" className={SECTION_HEADING}>
            {t('formSectionValues')}
          </h2>
          <ValuesFormPickerFields
            decree809Tags={rubricatorSections.decree809}
            adminExtrasTags={rubricatorSections.adminExtras}
            valueTags={valueTags}
            onChange={setValueTags}
            disabled={pending}
          />
        </section>
      )}

      {/* —— Shares, investing option, duration —— */}
      <section aria-labelledby="create-project-shares-heading" className="space-y-5">
        <h2 id="create-project-shares-heading" className={SECTION_HEADING}>
          {t('formSectionSharesAndTiming')}
        </h2>
        <BrandFormControl label={`${t('founderShare')} %`}>
          <AmountStepper
            id="founderShare"
            value={founderSharePercent}
            onChange={setFounderSharePercent}
            min={0}
            max={100}
            step={1}
            disabled={pending}
            className="w-full max-w-lg"
            inputClassName="flex-1 min-w-0 tabular-nums"
          />
        </BrandFormControl>

        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <Checkbox
              id="investingEnabled"
              checked={investingEnabled}
              onCheckedChange={(checked) => setInvestingEnabled(checked === true)}
              disabled={pending}
              className="mt-0.5 shrink-0"
            />
            <div className="min-w-0 flex-1 flex flex-col gap-2">
              <Label htmlFor="investingEnabled" className="text-sm font-medium cursor-pointer leading-snug">
                {t('investingEnable')}
              </Label>
              <p
                className="flex items-start gap-1.5 text-xs leading-snug text-amber-600 dark:text-amber-500"
                title={t('immutableHint')}
              >
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                <span>{t('immutableHint')}</span>
              </p>
            </div>
          </div>
          {investingEnabled && (
            <div className="space-y-2 pl-9 sm:pl-10 border-l-2 border-base-300/80 ml-0.5">
              <Label htmlFor="investorShare" className="text-sm font-medium">
                {t('investorShare')} %
              </Label>
              <AmountStepper
                id="investorShare"
                value={investorSharePercent}
                onChange={setInvestorSharePercent}
                min={0}
                max={100}
                step={1}
                disabled={pending}
                className="w-full max-w-lg"
                inputClassName="flex-1 min-w-0 tabular-nums"
              />
            </div>
          )}
        </div>

        <BrandFormControl label={t('duration')}>
          <Select
            value={projectDuration ?? ''}
            onValueChange={(v) => setProjectDuration(v === '' ? undefined : (v as 'finite' | 'ongoing'))}
            disabled={pending}
          >
            <SelectTrigger id="project-duration" className="h-11 w-full max-w-md rounded-xl text-base">
              <SelectValue placeholder={t('durationOptional')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="finite">{t('durationFinite')}</SelectItem>
              <SelectItem value="ongoing">{t('durationOngoing')}</SelectItem>
            </SelectContent>
          </Select>
        </BrandFormControl>
      </section>

      <div className="flex flex-col sm:flex-row sm:justify-end gap-3 pt-2 border-t border-base-300/60">
        <Button
          type="submit"
          disabled={pending || !canSubmit}
          variant="default"
          size="lg"
          className="w-full sm:w-auto min-w-[200px] h-12 rounded-xl font-semibold active:scale-[0.98]"
        >
          {pending ? t('creating') : t('create')}
        </Button>
      </div>
    </form>
  );
}
