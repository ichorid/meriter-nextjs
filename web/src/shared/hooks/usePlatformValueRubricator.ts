'use client';

import { useMemo } from 'react';
import { trpc } from '@/lib/trpc/client';
import { buildEffectiveRubricatorSections } from '@meriter/shared-types';

export function usePlatformValueRubricatorSections() {
  const { data, isLoading } = trpc.platformSettings.get.useQuery(undefined, {
    staleTime: 60_000,
  });

  const sections = useMemo(() => {
    if (!data) {
      return { decree809: [] as string[], adminExtras: [] as string[] };
    }
    return buildEffectiveRubricatorSections({
      decree809Enabled: data.decree809Enabled,
      decree809Tags: data.decree809Tags ?? undefined,
      availableFutureVisionTags: data.availableFutureVisionTags,
    });
  }, [data]);

  const flatTags = useMemo(
    () => [...sections.decree809, ...sections.adminExtras],
    [sections.decree809, sections.adminExtras],
  );

  return { sections, flatTags, isLoading, platformSettings: data };
}
