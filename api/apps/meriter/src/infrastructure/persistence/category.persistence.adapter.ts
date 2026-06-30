import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CategorySchemaClass,
  CategoryDocument,
} from '../../domain/models/category/category.schema';
import {
  CATEGORY_PERSISTENCE_PORT,
  type CategoryPersistencePort,
  type CategoryRecord,
  type CreateCategoryInput,
} from '../../domain/ports/category.persistence.port';

@Injectable()
export class CategoryPersistenceAdapter implements CategoryPersistencePort {
  constructor(
    @InjectModel(CategorySchemaClass.name)
    private readonly categoryModel: Model<CategoryDocument>,
  ) {}

  async findAllOrdered(): Promise<CategoryRecord[]> {
    const rows = await this.categoryModel.find().sort({ order: 1, createdAt: 1 }).exec();
    return rows.map((cat) => cat.toObject() as CategoryRecord);
  }

  async findById(id: string): Promise<CategoryRecord | null> {
    const row = await this.categoryModel.findOne({ id }).exec();
    return row ? (row.toObject() as CategoryRecord) : null;
  }

  async findBySlug(slug: string): Promise<CategoryRecord | null> {
    const row = await this.categoryModel.findOne({ slug }).exec();
    return row ? (row.toObject() as CategoryRecord) : null;
  }

  async findBySlugExcludingId(slug: string, excludeId: string): Promise<CategoryRecord | null> {
    const row = await this.categoryModel.findOne({ slug, id: { $ne: excludeId } }).exec();
    return row ? (row.toObject() as CategoryRecord) : null;
  }

  async findMaxOrder(): Promise<number | null> {
    const row = await this.categoryModel.findOne().sort({ order: -1 }).exec();
    return row ? row.order : null;
  }

  async countAll(): Promise<number> {
    return this.categoryModel.countDocuments().exec();
  }

  async create(input: CreateCategoryInput): Promise<CategoryRecord> {
    const category = new this.categoryModel(input);
    await category.save();
    return category.toObject() as CategoryRecord;
  }

  async save(record: CategoryRecord): Promise<CategoryRecord> {
    const existing = await this.categoryModel.findOne({ id: record.id }).exec();
    if (!existing) {
      throw new Error(`Category ${record.id} not found`);
    }
    existing.name = record.name;
    existing.slug = record.slug;
    existing.order = record.order;
    await existing.save();
    return existing.toObject() as CategoryRecord;
  }

  async deleteById(id: string): Promise<void> {
    await this.categoryModel.deleteOne({ id }).exec();
  }
}

export const categoryPersistenceProvider = {
  provide: CATEGORY_PERSISTENCE_PORT,
  useClass: CategoryPersistenceAdapter,
};
