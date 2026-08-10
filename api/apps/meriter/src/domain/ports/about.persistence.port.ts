export const ABOUT_PERSISTENCE_PORT = Symbol('ABOUT_PERSISTENCE_PORT');

export interface AboutCategoryRecord {
  id: string;
  title: string;
  description?: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface AboutArticleRecord {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  order: number;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAboutCategoryInput {
  id: string;
  title: string;
  description?: string;
  order: number;
}

export interface CreateAboutArticleInput {
  id: string;
  categoryId: string;
  title: string;
  content: string;
  order: number;
}

/**
 * AboutPersistencePort — «О проекте» CMS content (V-12).
 */
export interface AboutPersistencePort {
  findCategoriesExcludingIntroduction(): Promise<AboutCategoryRecord[]>;

  findAllCategoriesOrdered(): Promise<AboutCategoryRecord[]>;

  findCategoryById(id: string): Promise<AboutCategoryRecord | null>;

  findArticlesByCategoryId(categoryId: string): Promise<AboutArticleRecord[]>;

  findArticleById(id: string): Promise<AboutArticleRecord | null>;

  findMaxCategoryOrder(): Promise<number | null>;

  findMaxArticleOrderInCategory(categoryId: string): Promise<number | null>;

  countCategories(): Promise<number>;

  createCategory(input: CreateAboutCategoryInput): Promise<AboutCategoryRecord>;

  saveCategory(record: AboutCategoryRecord): Promise<AboutCategoryRecord>;

  deleteCategoryById(id: string): Promise<void>;

  deleteArticlesByCategoryId(categoryId: string): Promise<void>;

  createArticle(input: CreateAboutArticleInput): Promise<AboutArticleRecord>;

  saveArticle(record: AboutArticleRecord): Promise<AboutArticleRecord>;

  deleteArticleById(id: string): Promise<void>;

  deleteAllArticles(): Promise<void>;

  deleteAllCategories(): Promise<void>;
}
