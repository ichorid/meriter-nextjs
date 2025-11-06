import { NotFoundException } from '@nestjs/common';
import { Model } from 'mongoose';

/**
 * Helper class for MongoDB array field operations (add/remove)
 */
export class MongoArrayUpdateHelper {
  /**
   * Add an item to an array field in a MongoDB document
   * @param model Mongoose model
   * @param filter Filter to find the document
   * @param fieldName Name of the array field
   * @param value Value to add to the array
   * @param entityName Name of the entity (for error messages)
   * @returns Updated document
   */
  static async addToArray<T>(
    model: Model<any>,
    filter: any,
    fieldName: string,
    value: any,
    entityName: string = 'Entity'
  ): Promise<T> {
    const updated = await model.findOneAndUpdate(
      filter,
      {
        $addToSet: { [fieldName]: value },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new NotFoundException(`${entityName} not found`);
    }

    return updated as T;
  }

  /**
   * Remove an item from an array field in a MongoDB document
   * @param model Mongoose model
   * @param filter Filter to find the document
   * @param fieldName Name of the array field
   * @param value Value to remove from the array
   * @param entityName Name of the entity (for error messages)
   * @returns Updated document
   */
  static async removeFromArray<T>(
    model: Model<any>,
    filter: any,
    fieldName: string,
    value: any,
    entityName: string = 'Entity'
  ): Promise<T> {
    const updated = await model.findOneAndUpdate(
      filter,
      {
        $pull: { [fieldName]: value },
        $set: { updatedAt: new Date() },
      },
      { new: true }
    ).lean();

    if (!updated) {
      throw new NotFoundException(`${entityName} not found`);
    }

    return updated as T;
  }
}

