/**
 * ResourcePermissions interface
 * 
 * Represents the permissions a user has for a specific resource (publication, comment, poll).
 * All permission checks are performed server-side and embedded in API responses.
 */
export interface ResourcePermissions {
  /**
   * Whether the user can vote on this resource
   */
  canVote: boolean;

  /**
   * Whether the user can edit this resource
   */
  canEdit: boolean;

  /**
   * Whether the user can delete this resource
   */
  canDelete: boolean;

  /**
   * Whether the user can comment on this resource
   */
  canComment: boolean;

  /**
   * Reason why voting is disabled (translation key for frontend)
   * Only present if canVote is false
   */
  voteDisabledReason?: string;

  /**
   * Reason why editing is disabled (translation key for frontend)
   * Only present if canEdit is false
   */
  editDisabledReason?: string;

  /**
   * Reason why deletion is disabled (translation key for frontend)
   * Only present if canDelete is false
   */
  deleteDisabledReason?: string;
}

