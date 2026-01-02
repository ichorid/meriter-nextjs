import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CategorySchemaClass,
  CategoryDocument,
  Category,
} from '../models/category/category.schema';
import { uid } from 'uid';
import { PublicationSchemaClass, PublicationDocument } from '../models/publication/publication.schema';

export interface CreateCategoryDto {
  name: string;
  slug?: string;
  order?: number;
}

export interface UpdateCategoryDto {
  name?: string;
  slug?: string;
  order?: number;
}

@Injectable()
export class CategoryService {
  private readonly logger = new Logger(CategoryService.name);

  constructor(
    @InjectModel(CategorySchemaClass.name)
    private categoryModel: Model<CategoryDocument>,
    @InjectModel(PublicationSchemaClass.name)
    private publicationModel: Model<PublicationDocument>,
  ) {}

  /**
   * Generate slug from name
   */
  private generateSlug(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  }

  /**
   * Get all categories, ordered by order field
   */
  async getAllCategories(): Promise<Category[]> {
    const categories = await this.categoryModel
      .find()
      .sort({ order: 1, createdAt: 1 })
      .exec();
    return categories.map((cat) => cat.toObject());
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category.toObject();
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const category = await this.categoryModel.findOne({ slug }).exec();
    return category ? category.toObject() : null;
  }

  /**
   * Create a new category
   */
  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.categoryModel.findOne({ slug }).exec();
    if (existing) {
      throw new BadRequestException(`Category with slug "${slug}" already exists`);
    }

    // Get max order if not provided
    let order = dto.order;
    if (order === undefined) {
      const maxOrderCategory = await this.categoryModel
        .findOne()
        .sort({ order: -1 })
        .exec();
      order = maxOrderCategory ? maxOrderCategory.order + 1 : 0;
    }

    const category = new this.categoryModel({
      id: uid(),
      name: dto.name,
      slug,
      order,
    });

    await category.save();
    this.logger.log(`Created category: ${category.id} (${category.name})`);
    return category.toObject();
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.categoryModel
        .findOne({ slug: dto.slug, id: { $ne: id } })
        .exec();
      if (existing) {
        throw new BadRequestException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    // Update fields
    if (dto.name !== undefined) category.name = dto.name;
    if (dto.slug !== undefined) category.slug = dto.slug;
    if (dto.order !== undefined) category.order = dto.order;

    await category.save();
    this.logger.log(`Updated category: ${category.id} (${category.name})`);
    return category.toObject();
  }

  /**
   * Delete a category
   * Also removes the category from all publications that have it
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    // Remove category from all publications
    await this.publicationModel.updateMany(
      { categories: id },
      { $pull: { categories: id } },
    ).exec();

    // Delete the category
    await this.categoryModel.deleteOne({ id }).exec();
    this.logger.log(`Deleted category: ${id} (${category.name})`);
  }

  /**
   * Initialize default categories (for first-time setup)
   */
  async initializeDefaultCategories(): Promise<Category[]> {
    const existingCategories = await this.categoryModel.countDocuments().exec();
    if (existingCategories > 0) {
      this.logger.log('Categories already exist, skipping initialization');
      return this.getAllCategories();
    }

    const defaultCategories = [
      { name: 'Социум', slug: 'socium', order: 0 },
      { name: 'Животные', slug: 'animals', order: 1 },
      { name: 'Техника', slug: 'technology', order: 2 },
      { name: 'Экономика', slug: 'economy', order: 3 },
      { name: 'Экология', slug: 'ecology', order: 4 },
      { name: 'Образование', slug: 'education', order: 5 },
      { name: 'Здоровье', slug: 'health', order: 6 },
      { name: 'Культура', slug: 'culture', order: 7 },
      { name: 'Спорт', slug: 'sport', order: 8 },
      { name: 'Другое', slug: 'other', order: 9 },
    ];

    const created = [];
    for (const cat of defaultCategories) {
      const category = new this.categoryModel({
        id: uid(),
        name: cat.name,
        slug: cat.slug,
        order: cat.order,
      });
      await category.save();
      created.push(category.toObject());
    }

    this.logger.log(`Initialized ${created.length} default categories`);
    return created;
  }
}

