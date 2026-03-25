'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useProjectParentCommunityChoices } from '@/hooks/useProjectParentCommunityChoices';
import {
  useCancelParentLinkRequest,
  useRequestParentChange,
} from '@/hooks/api/useProjects';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Label } from '@/components/ui/shadcn/label';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/shadcn/select';
import { cn } from '@/lib/utils';

const PERSONAL_VALUE = '__personal__';

export interface PendingParentLinkInfo {
  requestId: string;
  targetParentCommunityId: string;
  parentName: string | null;
}

interface ProjectParentSettingsCardProps {
  projectId: string;
  parentCommunityId?: string | null;
  isPersonalProject?: boolean;
  pendingParentLink?: PendingParentLinkInfo | null;
  readOnly?: boolean;
}

export function ProjectParentSettingsCard({
  projectId,
  parentCommunityId,
  isPersonalProject,
  pendingParentLink,
  readOnly = false,
}: ProjectParentSettingsCardProps) {
  const t = useTranslations('projects');
  const tCommunities = useTranslations('communities');
  const { administeredCommunities, memberCommunities } = useProjectParentCommunityChoices();
  const requestParentChange = useRequestParentChange();
  const cancelRequest = useCancelParentLinkRequest();

  const [sectionOpen, setSectionOpen] = useState(false);

  useEffect(() => {
    if (pendingParentLink) {
      setSectionOpen(true);
    }
  }, [pendingParentLink?.requestId]);

  const derivedValue =
    !parentCommunityId || isPersonalProject === true ? PERSONAL_VALUE : parentCommunityId;

  const [choice, setChoice] = useState(derivedValue);
  useEffect(() => {
    setChoice(derivedValue);
  }, [derivedValue]);

  const leadParentIds = useMemo(
    () => new Set(administeredCommunities.map((c) => c.id)),
    [administeredCommunities],
  );

  const memberOnlySelected =
    choice !== PERSONAL_VALUE && choice.length > 0 && !leadParentIds.has(choice);

  const dirty = choice !== derivedValue;

  const apply = () => {
    if (!dirty || readOnly) return;
    const nextParent = choice === PERSONAL_VALUE ? null : choice;
    requestParentChange.mutate({ projectId, newParentCommunityId: nextParent });
  };

  const pending = requestParentChange.isPending || cancelRequest.isPending;

  return (
    <section
      className="rounded-xl border border-base-300/80 bg-base-200/25 dark:bg-base-300/15 p-4 sm:p-5"
      aria-labelledby="project-parent-settings-heading"
    >
      <button
        type="button"
        id="project-parent-settings-trigger"
        aria-expanded={sectionOpen}
        aria-controls="project-parent-settings-panel"
        onClick={() => setSectionOpen((o) => !o)}
        className="flex w-full items-start justify-between gap-3 text-left rounded-lg -m-1 p-1 hover:bg-base-300/20 dark:hover:bg-base-100/10 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="min-w-0 space-y-1">
          <h2
            id="project-parent-settings-heading"
            className="text-xs font-semibold uppercase tracking-wide text-base-content/50"
          >
            {t('parentChangeSectionTitle')}
          </h2>
          <p className="text-xs text-base-content/50 leading-snug">
            {t('parentSettingsVisibleToLeadOnly')}
          </p>
        </div>
        <ChevronDown
          className={cn(
            'h-5 w-5 shrink-0 text-base-content/45 transition-transform mt-0.5',
            sectionOpen && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {sectionOpen ? (
        <div
          id="project-parent-settings-panel"
          role="region"
          aria-labelledby="project-parent-settings-heading"
          className="mt-4 pt-4 border-t border-base-300/60 space-y-4"
        >
          {pendingParentLink && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-base-content/90 space-y-2">
              <p>
                {t('pendingLinkToParent', {
                  parentName: pendingParentLink.parentName ?? t('unknownCommunity'),
                })}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={readOnly || pending}
                  onClick={() => cancelRequest.mutate({ requestId: pendingParentLink.requestId })}
                >
                  {t('cancelParentLinkRequest')}
                </Button>
                {pendingParentLink.targetParentCommunityId ? (
                  <Button variant="ghost" size="sm" className="rounded-lg" asChild>
                    <Link href={`/meriter/communities/${pendingParentLink.targetParentCommunityId}`}>
                      {t('openParentCommunity')}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="project-parent-select" className="text-sm font-medium">
              {t('parentCommunitySelectLabel')}
            </Label>
            <Select
              value={choice}
              onValueChange={setChoice}
              disabled={readOnly || pending}
            >
              <SelectTrigger id="project-parent-select" className="h-11 w-full rounded-xl text-base">
                <SelectValue placeholder={t('personalProjectOption')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={PERSONAL_VALUE}>{t('personalProjectOption')}</SelectItem>
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
              </SelectContent>
            </Select>
          </div>

          {memberOnlySelected && (
            <p className={cn('text-sm text-amber-600 dark:text-amber-500 leading-snug')}>
              {t('parentChangeMemberWarning')}
            </p>
          )}

          <Button
            type="button"
            className="rounded-xl"
            disabled={readOnly || !dirty || pending}
            onClick={apply}
          >
            {pending ? t('savingParent') : t('applyParentChange')}
          </Button>
        </div>
      ) : null}
    </section>
  );
}
