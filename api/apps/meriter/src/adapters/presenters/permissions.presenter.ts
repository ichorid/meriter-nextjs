import type { ResourcePermissions } from '@meriter/shared-types/schemas/permissions';

/**
 * Raw permission facts from EvaluateResourcePermissionsUseCase (BC-05).
 * Gate logic lives in the use case; presenter only shapes API output (inv-11).
 */
export type ResourcePermissionFacts = {
  canVote: boolean;
  canEdit: boolean;
  canDelete: boolean;
  canComment: boolean;
  canTopUpFromSourceEntityWallet?: boolean;
  /** i18n translation keys (e.g. voteDisabled.notLoggedIn). */
  voteDisabledReason?: string;
  editDisabledReason?: string;
  deleteDisabledReason?: string;
};

const ANONYMOUS_PUBLICATION_PERMISSIONS: ResourcePermissions = {
  canVote: false,
  canEdit: false,
  canDelete: false,
  canComment: false,
  canTopUpFromSourceEntityWallet: false,
  voteDisabledReason: 'voteDisabled.notLoggedIn',
};

const ANONYMOUS_COMMENT_OR_POLL_PERMISSIONS: ResourcePermissions = {
  canVote: false,
  canEdit: false,
  canDelete: false,
  canComment: false,
  voteDisabledReason: 'voteDisabled.notLoggedIn',
};

const MISSING_RESOURCE_PERMISSIONS: ResourcePermissions = {
  canVote: false,
  canEdit: false,
  canDelete: false,
  canComment: false,
  canTopUpFromSourceEntityWallet: false,
};

/**
 * Map evaluation facts to canonical ResourcePermissions (inv-11).
 * Omits disabled-reason keys when the corresponding action is allowed.
 */
export function presentResourcePermissions(
  facts: ResourcePermissionFacts,
): ResourcePermissions {
  const permissions: ResourcePermissions = {
    canVote: facts.canVote,
    canEdit: facts.canEdit,
    canDelete: facts.canDelete,
    canComment: facts.canComment,
  };

  if (facts.canTopUpFromSourceEntityWallet !== undefined) {
    permissions.canTopUpFromSourceEntityWallet = facts.canTopUpFromSourceEntityWallet;
  }

  if (!facts.canVote && facts.voteDisabledReason) {
    permissions.voteDisabledReason = facts.voteDisabledReason;
  }
  if (!facts.canEdit && facts.editDisabledReason) {
    permissions.editDisabledReason = facts.editDisabledReason;
  }
  if (!facts.canDelete && facts.deleteDisabledReason) {
    permissions.deleteDisabledReason = facts.deleteDisabledReason;
  }

  return permissions;
}

/** Default permissions for unauthenticated publication reads. */
export function presentAnonymousPublicationPermissions(): ResourcePermissions {
  return ANONYMOUS_PUBLICATION_PERMISSIONS;
}

/** Default permissions for unauthenticated comment/poll reads. */
export function presentAnonymousCommentOrPollPermissions(): ResourcePermissions {
  return ANONYMOUS_COMMENT_OR_POLL_PERMISSIONS;
}

/** Default permissions when the target resource does not exist. */
export function presentMissingResourcePermissions(): ResourcePermissions {
  return MISSING_RESOURCE_PERMISSIONS;
}

/**
 * Attach permissions to a mapped API DTO after EntityMappers (Phase 5 adapter flow).
 */
export function attachResourcePermissions<T extends object>(
  dto: T,
  permissions: ResourcePermissions,
): T & { permissions: ResourcePermissions } {
  return { ...dto, permissions };
}
