'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useCreateProject } from '@/hooks/api/useProjects';
import { trpc } from '@/lib/trpc/client';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { Label } from '@/components/ui/shadcn/label';
import { Textarea } from '@/components/ui/shadcn/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';

const NEW_COMMUNITY_VALUE = '__new__';

export function CreateProjectForm() {
  const t = useTranslations('projects');
  const createProject = useCreateProject();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [projectDuration, setProjectDuration] = useState<'finite' | 'ongoing' | undefined>(undefined);
  const [founderSharePercent, setFounderSharePercent] = useState<number>(0);
  const [investorSharePercent, setInvestorSharePercent] = useState<number>(0);
  const [parentChoice, setParentChoice] = useState<string>('');
  const [newCommunityName, setNewCommunityName] = useState('');
  const [newCommunityFutureVision, setNewCommunityFutureVision] = useState('');

  const { data: communitiesData } = trpc.communities.getAll.useQuery({});
  const communities = (communitiesData?.data ?? []).filter(
    (c: { typeTag?: string }) => c.typeTag !== 'project' && c.typeTag !== 'global',
  );

  const isNewCommunity = parentChoice === NEW_COMMUNITY_VALUE;

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
      investorSharePercent: investorSharePercent || 0,
      parentCommunityId: isNewCommunity ? undefined : parentChoice,
      newCommunity: isNewCommunity
        ? {
            name: newCommunityName.trim(),
            futureVisionText: newCommunityFutureVision.trim(),
            typeTag: 'custom',
          }
        : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 max-w-xl">
      <div>
        <Label htmlFor="name">{t('createProject')} — {t('name')}</Label>
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
        <Label>{t('parentCommunity')}</Label>
        <Select value={parentChoice} onValueChange={setParentChoice} required>
          <SelectTrigger>
            <SelectValue placeholder={t('selectCommunityPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {communities.map((c: { id: string; name: string }) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
            <SelectItem value={NEW_COMMUNITY_VALUE}>{t('createNewCommunity')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {isNewCommunity && (
        <>
          <div>
            <Label htmlFor="newName">{t('newCommunityName')}</Label>
            <Input
              id="newName"
              value={newCommunityName}
              onChange={(e) => setNewCommunityName(e.target.value)}
              placeholder={t('communityNamePlaceholder')}
              required={isNewCommunity}
            />
          </div>
          <div>
            <Label htmlFor="futureVision">{t('futureVisionRequired')}</Label>
            <Textarea
              id="futureVision"
              value={newCommunityFutureVision}
              onChange={(e) => setNewCommunityFutureVision(e.target.value)}
              placeholder={t('futureVisionPlaceholder')}
              rows={3}
              required={isNewCommunity}
            />
          </div>
        </>
      )}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="founderShare">{t('founderShare')} %</Label>
          <Input
            id="founderShare"
            type="number"
            min={0}
            max={100}
            value={founderSharePercent}
            onChange={(e) => setFounderSharePercent(Number(e.target.value) || 0)}
          />
        </div>
        <div>
          <Label htmlFor="investorShare">{t('investorShare')} %</Label>
          <Input
            id="investorShare"
            type="number"
            min={0}
            max={100}
            value={investorSharePercent}
            onChange={(e) => setInvestorSharePercent(Number(e.target.value) || 0)}
          />
        </div>
      </div>
      <div>
        <Label>Duration</Label>
        <Select
          value={projectDuration ?? ''}
          onValueChange={(v) => setProjectDuration(v === '' ? undefined : (v as 'finite' | 'ongoing'))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Optional" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="finite">Finite</SelectItem>
            <SelectItem value="ongoing">Ongoing</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button type="submit" disabled={createProject.isPending}>
        {createProject.isPending ? 'Creating...' : t('create')}
      </Button>
    </form>
  );
}
