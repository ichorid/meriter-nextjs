'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { useTaxonomyTranslations } from '@/hooks/useTaxonomyTranslations';
import { useCategories } from '@/hooks/api/useCategories';
import {
  IMPACT_AREAS,
  BENEFICIARIES,
  METHODS,
  STAGES,
  HELP_NEEDED,
} from '@/lib/constants/taxonomy';
import { ENABLE_PROJECT_POSTS, ENABLE_HASHTAGS } from '@/lib/constants/features';

interface PostSettingsReadOnlyProps {
  title?: string | null;
  description?: string | null;
  postType?: string;
  hashtags?: string[];
  categories?: string[];
  impactArea?: string;
  beneficiaries?: string[];
  methods?: string[];
  stage?: string;
  helpNeeded?: string[];
}

export function PostSettingsReadOnly({
  title,
  description,
  postType = 'basic',
  hashtags = [],
  categories = [],
  impactArea,
  beneficiaries = [],
  methods = [],
  stage,
  helpNeeded = [],
}: PostSettingsReadOnlyProps) {
  const t = useTranslations('publications.create');
  const tTaxonomy = useTranslations('publications.create.taxonomy');
  const { data: allCategories } = useCategories();
  const categoryNames = React.useMemo(() => {
    if (!allCategories) return {};
    return Object.fromEntries(allCategories.map((c) => [c.id, c.name]));
  }, [allCategories]);
  const {
    translateImpactArea,
    translateStage,
    translateBeneficiary,
    translateMethod,
    translateHelpNeeded,
  } = useTaxonomyTranslations();

  const postTypeLabel =
    postType === 'project'
      ? t('postTypes.project', { defaultValue: 'Project' })
      : postType === 'poll'
        ? t('postTypes.poll', { defaultValue: 'Poll' })
        : t('postTypes.basic', { defaultValue: 'Publication' });

  const hasTaxonomy =
    ENABLE_PROJECT_POSTS &&
    (impactArea || beneficiaries.length > 0 || methods.length > 0 || stage || helpNeeded.length > 0);

  const impactAreaLabel = impactArea && IMPACT_AREAS.includes(impactArea as never)
    ? translateImpactArea(impactArea as never)
    : impactArea;

  return (
    <div className="space-y-4 rounded-lg border border-base-300 bg-base-200/50 p-4">
      <h3 className="text-sm font-medium text-base-content/80">
        {t('postSettings', { defaultValue: 'Post settings' })}
      </h3>

      <dl className="space-y-3 text-sm">
        {(title || description) && (
          <>
            {title && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {t('fields.title', { defaultValue: 'Title' })}
                </dt>
                <dd className="text-base-content/90">{title}</dd>
              </div>
            )}
            {description && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {t('fields.description', { defaultValue: 'Description' })}
                </dt>
                <dd className="text-base-content/80 whitespace-pre-wrap">{description}</dd>
              </div>
            )}
          </>
        )}

        <div>
          <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
            {t('fields.postType', { defaultValue: 'Type' })}
          </dt>
          <dd className="text-base-content/80">{postTypeLabel}</dd>
        </div>

        {ENABLE_HASHTAGS && hashtags.length > 0 && (
          <div>
            <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
              {t('fields.hashtags', { defaultValue: 'Hashtags' })}
            </dt>
            <dd className="flex flex-wrap gap-1">
              {hashtags.map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded bg-base-300 text-base-content/80 text-xs"
                >
                  #{tag}
                </span>
              ))}
            </dd>
          </div>
        )}

        {categories.length > 0 && (
          <div>
            <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
              {t('fields.categories', { defaultValue: 'Categories' })}
            </dt>
            <dd className="flex flex-wrap gap-1">
              {categories.map((id) => (
                <span
                  key={id}
                  className="px-2 py-0.5 rounded bg-base-300 text-base-content/80 text-xs"
                >
                  {categoryNames[id] ?? id}
                </span>
              ))}
            </dd>
          </div>
        )}

        {hasTaxonomy && (
          <>
            {impactArea && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {tTaxonomy('impactArea', { defaultValue: 'Impact area' })}
                </dt>
                <dd className="text-base-content/80">{impactAreaLabel}</dd>
              </div>
            )}
            {stage && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {tTaxonomy('stage', { defaultValue: 'Stage' })}
                </dt>
                <dd className="text-base-content/80">
                  {STAGES.includes(stage as never) ? translateStage(stage as never) : stage}
                </dd>
              </div>
            )}
            {beneficiaries.length > 0 && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {tTaxonomy('beneficiaries', { defaultValue: 'Beneficiaries' })}
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {beneficiaries.map((b) => (
                    <span
                      key={b}
                      className="px-2 py-0.5 rounded bg-base-300 text-base-content/80 text-xs"
                    >
                      {BENEFICIARIES.includes(b as never) ? translateBeneficiary(b as never) : b}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {methods.length > 0 && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {tTaxonomy('methods', { defaultValue: 'Methods' })}
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {methods.map((m) => (
                    <span
                      key={m}
                      className="px-2 py-0.5 rounded bg-base-300 text-base-content/80 text-xs"
                    >
                      {METHODS.includes(m as never) ? translateMethod(m as never) : m}
                    </span>
                  ))}
                </dd>
              </div>
            )}
            {helpNeeded.length > 0 && (
              <div>
                <dt className="text-xs text-base-content/50 uppercase tracking-wide mb-0.5">
                  {tTaxonomy('helpNeeded', { defaultValue: 'Help needed' })}
                </dt>
                <dd className="flex flex-wrap gap-1">
                  {helpNeeded.map((h) => (
                    <span
                      key={h}
                      className="px-2 py-0.5 rounded bg-base-300 text-base-content/80 text-xs"
                    >
                      {HELP_NEEDED.includes(h as never) ? translateHelpNeeded(h as never) : h}
                    </span>
                  ))}
                </dd>
              </div>
            )}
          </>
        )}
      </dl>
    </div>
  );
}
