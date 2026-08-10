import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import {
  Category,
} from '../models/category/category.schema';
import { uid } from 'uid';
import {
  CATEGORY_PERSISTENCE_PORT,
  type CategoryPersistencePort,
} from '../ports/category.persistence.port';
import {
  PUBLICATION_PERSISTENCE_PORT,
  type PublicationPersistencePort,
} from '../ports/publication.persistence.port';

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
    @Inject(CATEGORY_PERSISTENCE_PORT)
    private readonly categoryPersistence: CategoryPersistencePort,
    @Inject(PUBLICATION_PERSISTENCE_PORT)
    private readonly publicationPersistence: PublicationPersistencePort,
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
    return (await this.categoryPersistence.findAllOrdered()) as Category[];
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<Category> {
    const category = await this.categoryPersistence.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }
    return category as Category;
  }

  /**
   * Get category by slug
   */
  async getCategoryBySlug(slug: string): Promise<Category | null> {
    const category = await this.categoryPersistence.findBySlug(slug);
    return category ? (category as Category) : null;
  }

  /**
   * Create a new category
   */
  async createCategory(dto: CreateCategoryDto): Promise<Category> {
    // Generate slug if not provided
    const slug = dto.slug || this.generateSlug(dto.name);

    // Check if slug already exists
    const existing = await this.categoryPersistence.findBySlug(slug);
    if (existing) {
      throw new BadRequestException(`Category with slug "${slug}" already exists`);
    }

    // Get max order if not provided
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.categoryPersistence.findMaxOrder();
      order = maxOrder !== null ? maxOrder + 1 : 0;
    }

    const category = await this.categoryPersistence.create({
      id: uid(),
      name: dto.name,
      slug,
      order,
    });

    this.logger.log(`Created category: ${category.id} (${category.name})`);
    return category as Category;
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, dto: UpdateCategoryDto): Promise<Category> {
    const category = await this.categoryPersistence.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    // Check slug uniqueness if changing
    if (dto.slug && dto.slug !== category.slug) {
      const existing = await this.categoryPersistence.findBySlugExcludingId(
        dto.slug,
        id,
      );
      if (existing) {
        throw new BadRequestException(`Category with slug "${dto.slug}" already exists`);
      }
    }

    // Update fields
    const updated = await this.categoryPersistence.save({
      ...category,
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.slug !== undefined ? { slug: dto.slug } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    });
    this.logger.log(`Updated category: ${category.id} (${category.name})`);
    return updated as Category;
  }

  /**
   * Delete a category
   * Also removes the category from all publications that have it
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryPersistence.findById(id);
    if (!category) {
      throw new NotFoundException(`Category with id ${id} not found`);
    }

    const publications = await this.publicationPersistence.findByQuery({
      query: { categories: id },
      select: { id: 1, categories: 1 },
    });
    await Promise.all(
      publications.map(async (publication) => {
        const categories = Array.isArray(publication.categories)
          ? publication.categories
          : [];
        await this.publicationPersistence.patchById(publication.id, {
          set: { categories: categories.filter((catId) => catId !== id) },
        });
      }),
    );

    // Delete the category
    await this.categoryPersistence.deleteById(id);
    this.logger.log(`Deleted category: ${id} (${category.name})`);
  }

  /**
   * Initialize default categories (for first-time setup)
   */
  async initializeDefaultCategories(): Promise<Category[]> {
    const existingCategories = await this.categoryPersistence.countAll();
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
      const category = await this.categoryPersistence.create({
        id: uid(),
        name: cat.name,
        slug: cat.slug,
        order: cat.order,
      });
      created.push(category as Category);
    }

    this.logger.log(`Initialized ${created.length} default categories`);
    return created;
  }
}

