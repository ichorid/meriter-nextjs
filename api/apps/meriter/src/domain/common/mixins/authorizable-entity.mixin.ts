import { UserId } from '../../value-objects';

/**
 * Mixin function that provides authorization methods for entities with an authorId
 * @param Base The base class to extend
 * @returns A class with canBeEditedBy and canBeDeletedBy methods
 */
export function AuthorizableEntityMixin<T extends new (...args: any[]) => { authorId: UserId }>(Base: T) {
  return class extends Base {
    canBeEditedBy(userId: UserId): boolean {
      return this.authorId.equals(userId);
    }

    canBeDeletedBy(userId: UserId): boolean {
      return this.authorId.equals(userId);
    }
  };
}

/**
 * Helper class with static methods for authorization checks
 * Can be used when mixins are not suitable
 */
export class AuthorizationHelper {
  /**
   * Check if an entity can be edited by a user
   * @param authorId The author ID of the entity
   * @param userId The user ID to check
   * @returns true if the user can edit the entity
   */
  static canBeEditedBy(authorId: UserId, userId: UserId): boolean {
    return authorId.equals(userId);
  }

  /**
   * Check if an entity can be deleted by a user
   * @param authorId The author ID of the entity
   * @param userId The user ID to check
   * @returns true if the user can delete the entity
   */
  static canBeDeletedBy(authorId: UserId, userId: UserId): boolean {
    return authorId.equals(userId);
  }
}

