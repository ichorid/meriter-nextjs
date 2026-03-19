'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';
import { useCreateProject } from '@/hooks/api/useProjects';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useFutureVisionTags } from '@/hooks/api/useFutureVisions';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import { Checkbox } from '@/components/ui/shadcn/checkbox';
import { ImageUploader } from '@/components/ui/ImageUploader/ImageUploader';
import { FutureVisionCoverDevPlaceholders } from '@/shared/components/FutureVisionCoverDevPlaceholders';
import {
  Slider,
  SliderTrack,
  SliderFilledTrack,
  SliderThumb,
} from '@/components/ui/slider';
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
import { CollapsibleSection } from '@/components/ui/taxonomy';
import { AlertTriangle } from 'lucide-react';

const NEW_COMMUNITY_VALUE = '__new__';
const PRIORITY_TYPE_TAGS = ['future-vision', 'marathon-of-good', 'team-projects', 'support'] as const;

const submitButtonClass =
  'inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50 border border-input bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 hover:text-base-content text-base-content dark:text-base-content/70 h-9 rounded-xl px-4 gap-2';

export function CreateProjectForm() {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('communities');
  const { user } = useAuth();
  const createProject = useCreateProject();
  const { data: platformSettings } = useFutureVisionTags();
  const availableTags = platformSettings?.availableFutureVisionTags ?? [];

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
  const [founderShareInput, setFounderShareInput] = useState('0');
  const [investorShareInput, setInvestorShareInput] = useState('0');
  const [investingEnabled, setInvestingEnabled] = useState(false);
  const [openAdvancedSettings, setOpenAdvancedSettings] = useState(false);
  const [parentChoice, setParentChoice] = useState<string>('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityFutureVision, setNewCommunityFutureVision] = useState('');
  const [newCommunitySelectedTags, setNewCommunitySelectedTags] = useState<string[]>([]);
  const [newCommunityCover, setNewCommunityCover] = useState('');

  const isNewCommunity = parentChoice === NEW_COMMUNITY_VALUE;

  const toggleNewCommunityTag = (tag: string) => {
    setNewCommunitySelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag],
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    if (!parentChoice) return;
    if (isNewCommunity && !newCommunityName.trim()) return;
    if (isNewCommunity && !newCommunityFutureVision.trim()) return;

    createProject.mutate({
      name: name.trim(),
      description: description.trim() || undefined,
      projectDuration,
      founderSharePercent: founderSharePercent || 0,
      investorSharePercent: investingEnabled ? (investorSharePercent || 0) : 0,
      investingEnabled,
      parentCommunityId: isNewCommunity ? undefined : parentChoice,
      newCommunity: isNewCommunity
        ? {
            name: newCommunityName.trim(),
            futureVisionText: newCommunityFutureVision.trim(),
            futureVisionTags: newCommunitySelectedTags.length > 0 ? newCommunitySelectedTags : undefined,
            futureVisionCover: newCommunityCover.trim() || undefined,
            typeTag: 'custom',
          }
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl">
      <div>
        <Label htmlFor="name">{t('name')} *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('projectNamePlaceholder')}
          required
        />
      </div>
      <div>
        <Label htmlFor="description">{t('description')}</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t('shortDescriptionPlaceholder')}
          rows={3}
        />
      </div>
      <div>
        <Label>{t('parentCommunity')} *</Label>
        <Select value={parentChoice} onValueChange={setParentChoice} required>
          <SelectTrigger>
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
      {isNewCommunity && (
        <>
          <div>
            <Label htmlFor="newName">{t('newCommunityName')} *</Label>
            <Input
              id="newName"
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              placeholder={t('communityNamePlaceholder')}
              required={isNewCommunity}
            />
          </div>
          <div>
            <Label htmlFor="futureVision">{t('futureVisionRequired')} *</Label>
            <Textarea
              id="futureVision"
              value={newCommunityFutureVision}
              onChange={(e) => setNewCommunityFutureVision(e.target.value)}
              placeholder={t('futureVisionPlaceholder')}
              rows={3}
              required={isNewCommunity}
            />
          </div>
          {availableTags.length > 0 && (
            <div className="space-y-2">
              <span className="text-sm font-medium">{t('valueTagsLabel')}</span>
              <div className="flex flex-wrap gap-2">
                {availableTags.map((tag) => (
                  <label key={tag} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={newCommunitySelectedTags.includes(tag)}
                      onCheckedChange={() => toggleNewCommunityTag(tag)}
                      disabled={createProject.isPending}
                    />
                    <span className="text-sm">{tag}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div className="space-y-2">
            <span className="text-sm font-medium">{t('futureVisionCoverLabel')}</span>
            <ImageUploader
              value={newCommunityCover || undefined}
              onUpload={setNewCommunityCover}
              onRemove={() => setNewCommunityCover('')}
              disabled={createProject.isPending}
              aspectRatio={16 / 9}
              compact
              allowUrlFallback
            />
            <FutureVisionCoverDevPlaceholders
              onSelectUrl={setNewCommunityCover}
              disabled={createProject.isPending}
            />
          </div>
        </>
      )}
      <div className="space-y-2">
        <Label htmlFor="founderShare">{t('founderShare')} %</Label>
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <Slider
              minValue={0}
              maxValue={100}
              value={founderSharePercent}
              onChange={(v) => {
                setFounderSharePercent(v);
                setFounderShareInput(String(v));
              }}
            >
              <SliderTrack
                style={{
                  height: 8,
                  borderRadius: 8,
                  backgroundColor: 'oklch(var(--b3) / 0.8)',
                  borderWidth: 1,
                  borderColor: 'oklch(var(--bc) / 0.3)',
                }}
              >
                <SliderFilledTrack
                  style={{
                    height: 8,
                    borderRadius: 8,
                    backgroundColor: 'oklch(var(--p) / 0.9)',
                  }}
                />
              </SliderTrack>
              <SliderThumb
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 11,
                  backgroundColor: 'oklch(var(--bc) / 1)',
                  borderWidth: 2,
                  borderColor: 'oklch(var(--b1) / 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </Slider>
          </div>
          <Input
            id="founderShare"
            type="text"
            inputMode="numeric"
            value={founderShareInput}
            onChange={(e) => setFounderShareInput(e.target.value.replace(/\D/g, '').slice(0, 3))}
            onBlur={() => {
              const n = parseInt(founderShareInput, 10);
              const committed = Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
              setFounderSharePercent(committed);
              setFounderShareInput(String(committed));
            }}
            className="w-14 h-10 text-center text-base tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            aria-label={t('founderShare')}
          />
        </div>
      </div>
      <CollapsibleSection
        title={t('advancedTitle')}
        open={openAdvancedSettings}
        setOpen={setOpenAdvancedSettings}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Checkbox
              id="investingEnabled"
              checked={investingEnabled}
              onCheckedChange={(checked) => setInvestingEnabled(checked === true)}
              disabled={createProject.isPending}
            />
            <Label htmlFor="investingEnabled" className="text-sm font-medium cursor-pointer">
              {t('investingEnable')}
            </Label>
            <span
              className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-500"
              title={t('immutableHint')}
            >
              <AlertTriangle className="h-4 w-4" aria-hidden />
              <span className="text-xs">{t('immutableHint')}</span>
            </span>
          </div>
          {investingEnabled && (
            <div className="space-y-2 pl-6">
              <Label htmlFor="investorShare">{t('investorShare')} %</Label>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <Slider
                    minValue={0}
                    maxValue={100}
                    value={investorSharePercent}
                    onChange={(v) => {
                      setInvestorSharePercent(v);
                      setInvestorShareInput(String(v));
                    }}
                  >
                    <SliderTrack
                      style={{
                        height: 8,
                        borderRadius: 8,
                        backgroundColor: 'oklch(var(--b3) / 0.8)',
                        borderWidth: 1,
                        borderColor: 'oklch(var(--bc) / 0.3)',
                      }}
                    >
                      <SliderFilledTrack
                        style={{
                          height: 8,
                          borderRadius: 8,
                          backgroundColor: 'oklch(var(--p) / 0.9)',
                        }}
                      />
                    </SliderTrack>
                    <SliderThumb
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: 'oklch(var(--bc) / 1)',
                        borderWidth: 2,
                        borderColor: 'oklch(var(--b1) / 1)',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                      }}
                    />
                  </Slider>
                </div>
                <Input
                  id="investorShare"
                  type="text"
                  inputMode="numeric"
                  value={investorShareInput}
                  onChange={(e) =>
                    setInvestorShareInput(e.target.value.replace(/\D/g, '').slice(0, 3))
                  }
                  onBlur={() => {
                    const n = parseInt(investorShareInput, 10);
                    const committed = Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
                    setInvestorSharePercent(committed);
                    setInvestorShareInput(String(committed));
                  }}
                  className="w-14 h-10 text-center text-base tabular-nums [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                  aria-label={t('investorShare')}
                />
              </div>
            </div>
          )}
        </div>
      </CollapsibleSection>
      <div>
        <Label>{t('duration')}</Label>
        <Select
          value={projectDuration ?? ''}
          onValueChange={(v) => setProjectDuration(v === '' ? undefined : (v as 'finite' | 'ongoing'))}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('durationOptional')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="finite">{t('durationFinite')}</SelectItem>
            <SelectItem value="ongoing">{t('durationOngoing')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={createProject.isPending} variant="outline" size="sm" className={submitButtonClass}>
        {createProject.isPending ? t('creating') : t('create')}
      </Button>
    </form>
  );
}
