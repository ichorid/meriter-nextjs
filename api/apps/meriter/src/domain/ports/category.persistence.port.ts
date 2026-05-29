export const CATEGORY_PERSISTENCE_PORT = Symbol('CATEGORY_PERSISTENCE_PORT');

export interface CategoryRecord {
  id: string;
  name: string;
  slug: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateCategoryInput {
  id: string;
  name: string;
  slug: string;
  order: number;
}

export interface UpdateCategoryInput {
  name?: string;
  slug?: string;
  order?: number;
}

/**
 * CategoryPersistencePort — platform publication categories (V-12).
 */
export interface CategoryPersistencePort {
  findAllOrdered(): Promise<CategoryRecord[]>;

  findById(id: string): Promise<CategoryRecord | null>;

  findBySlug(slug: string): Promise<CategoryRecord | null>;

  findBySlugExcludingId(slug: string, excludeId: string): Promise<CategoryRecord | null>;

  findMaxOrder(): Promise<number | null>;

  countAll(): Promise<number>;

  create(input: CreateCategoryInput): Promise<CategoryRecord>;

  save(record: CategoryRecord): Promise<CategoryRecord>;

  deleteById(id: string): Promise<void>;
}
