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
