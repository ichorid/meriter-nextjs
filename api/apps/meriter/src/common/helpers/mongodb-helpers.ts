import { UpdateQuery } from 'mongoose';

/**
 * MongoDB helper utilities for common update operations
 */
export class MongoDbHelpers {
  /**
   * Update an array field in a MongoDB document
   * Supports both $addToSet (add) and $pull (remove) operations
   * 
   * @param model Mongoose model instance
   * @param filter Query filter to find the document
   * @param fieldPath Path to the array field (supports dot notation for nested fields)
   * @param value Value to add or remove
   * @param operation 'add' for $addToSet, 'remove' for $pull
   * @returns Update query object ready to use with findOneAndUpdate
   */
  static updateArrayField<T>(
    fieldPath: string,
    value: any,
    operation: 'add' | 'remove',
  ): UpdateQuery<T> {
    const updateData: UpdateQuery<T> = {
      $set: { updatedAt: new Date() },
    };

    if (operation === 'add') {
      updateData.$addToSet = { [fieldPath]: value } as any;
    } else {
      updateData.$pull = { [fieldPath]: value } as any;
    }

    return updateData;
  }

  /**
   * Build an update query for array field operations
   * This is a convenience method that combines updateArrayField with the filter
   * 
   * @param fieldPath Path to the array field
   * @param value Value to add or remove
   * @param operation 'add' or 'remove'
   * @returns Update query object
   */
  static buildArrayFieldUpdate<T>(
    fieldPath: string,
    value: any,
    operation: 'add' | 'remove',
  ): UpdateQuery<T> {
    return this.updateArrayField<T>(fieldPath, value, operation);
  }
}
