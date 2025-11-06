import { UserId } from '../../value-objects';

/**
 * Interface for entities that can be edited and deleted by users
 * Provides common permission checking methods
 */
export interface EditableEntity {
  /**
   * Check if the entity can be edited by the given user
   */
  canBeEditedBy(userId: UserId): boolean;

  /**
   * Check if the entity can be deleted by the given user
   */
  canBeDeletedBy(userId: UserId): boolean;

  /**
   * Get the effective beneficiary of the entity
   * This is the user who receives votes/benefits for this entity
   */
  getEffectiveBeneficiary(): UserId;
}

