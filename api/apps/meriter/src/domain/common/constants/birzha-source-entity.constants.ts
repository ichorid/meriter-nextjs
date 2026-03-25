/**
 * PRD: docs/prd/PRD-BIRZHA-SOURCE-ENTITY.md §1 / §6-4
 *
 * `typeTag` values for communities that are **not** local membership hubs (auto-joined / system).
 * Such communities cannot use `communities.publishToBirzha` as a non-project source.
 * Projects always publish via `project.publishToBirzha` (`isProject === true`).
 */
export const TYPE_TAGS_INELIGIBLE_NON_PROJECT_BIRZHA_SOURCE = [
  'global',
  'marathon-of-good',
  'future-vision',
  'team-projects',
  'support',
] as const;

export type TypeTagIneligibleNonProjectBirzhaSource =
  (typeof TYPE_TAGS_INELIGIBLE_NON_PROJECT_BIRZHA_SOURCE)[number];

const INELIGIBLE_SET = new Set<string>(TYPE_TAGS_INELIGIBLE_NON_PROJECT_BIRZHA_SOURCE);

/** Local team/custom communities that may hold a Birzha source wallet (`publishToBirzha`). */
export function isEligibleNonProjectBirzhaSourceCommunity(
  comm: { typeTag?: string | null; isProject?: boolean | null } | null | undefined,
): boolean {
  if (!comm || comm.isProject) {
    return false;
  }
  const tag = comm.typeTag ?? '';
  return !INELIGIBLE_SET.has(tag);
}
