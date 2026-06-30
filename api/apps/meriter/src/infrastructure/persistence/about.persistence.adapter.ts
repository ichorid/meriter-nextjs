import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AboutCategorySchemaClass,
  AboutCategoryDocument,
} from '../../domain/models/about/about-category.schema';
import {
  AboutArticleSchemaClass,
  AboutArticleDocument,
} from '../../domain/models/about/about-article.schema';
import {
  ABOUT_PERSISTENCE_PORT,
  type AboutArticleRecord,
  type AboutCategoryRecord,
  type AboutPersistencePort,
  type CreateAboutArticleInput,
  type CreateAboutCategoryInput,
} from '../../domain/ports/about.persistence.port';

@Injectable()
export class AboutPersistenceAdapter implements AboutPersistencePort {
  constructor(
    @InjectModel(AboutCategorySchemaClass.name)
    private readonly categoryModel: Model<AboutCategoryDocument>,
    @InjectModel(AboutArticleSchemaClass.name)
    private readonly articleModel: Model<AboutArticleDocument>,
  ) {}

  async findCategoriesExcludingIntroduction(): Promise<AboutCategoryRecord[]> {
    const rows = await this.categoryModel
      .find({ id: { $ne: 'introduction' } })
      .sort({ order: 1, createdAt: 1 })
      .exec();
    return rows.map((cat) => cat.toObject() as AboutCategoryRecord);
  }

  async findAllCategoriesOrdered(): Promise<AboutCategoryRecord[]> {
    const rows = await this.categoryModel.find().sort({ order: 1, createdAt: 1 }).exec();
    return rows.map((cat) => cat.toObject() as AboutCategoryRecord);
  }

  async findCategoryById(id: string): Promise<AboutCategoryRecord | null> {
    const row = await this.categoryModel.findOne({ id }).exec();
    return row ? (row.toObject() as AboutCategoryRecord) : null;
  }

  async findArticlesByCategoryId(categoryId: string): Promise<AboutArticleRecord[]> {
    const rows = await this.articleModel
      .find({ categoryId })
      .sort({ order: 1, createdAt: 1 })
      .exec();
    return rows.map((art) => art.toObject() as AboutArticleRecord);
  }

  async findArticleById(id: string): Promise<AboutArticleRecord | null> {
    const row = await this.articleModel.findOne({ id }).exec();
    return row ? (row.toObject() as AboutArticleRecord) : null;
  }

  async findMaxCategoryOrder(): Promise<number | null> {
    const row = await this.categoryModel.findOne().sort({ order: -1 }).exec();
    return row ? row.order : null;
  }

  async findMaxArticleOrderInCategory(categoryId: string): Promise<number | null> {
    const row = await this.articleModel.findOne({ categoryId }).sort({ order: -1 }).exec();
    return row ? row.order : null;
  }

  async countCategories(): Promise<number> {
    return this.categoryModel.countDocuments().exec();
  }

  async createCategory(input: CreateAboutCategoryInput): Promise<AboutCategoryRecord> {
    const category = new this.categoryModel(input);
    await category.save();
    return category.toObject() as AboutCategoryRecord;
  }

  async saveCategory(record: AboutCategoryRecord): Promise<AboutCategoryRecord> {
    const existing = await this.categoryModel.findOne({ id: record.id }).exec();
    if (!existing) {
      throw new Error(`About category ${record.id} not found`);
    }
    existing.title = record.title;
    existing.description = record.description;
    existing.order = record.order;
    await existing.save();
    return existing.toObject() as AboutCategoryRecord;
  }

  async deleteCategoryById(id: string): Promise<void> {
    await this.categoryModel.deleteOne({ id }).exec();
  }

  async deleteArticlesByCategoryId(categoryId: string): Promise<void> {
    await this.articleModel.deleteMany({ categoryId }).exec();
  }

  async createArticle(input: CreateAboutArticleInput): Promise<AboutArticleRecord> {
    const article = new this.articleModel(input);
    await article.save();
    return article.toObject() as AboutArticleRecord;
  }

  async saveArticle(record: AboutArticleRecord): Promise<AboutArticleRecord> {
    const existing = await this.articleModel.findOne({ id: record.id }).exec();
    if (!existing) {
      throw new Error(`About article ${record.id} not found`);
    }
    existing.categoryId = record.categoryId;
    existing.title = record.title;
    existing.content = record.content;
    existing.order = record.order;
    await existing.save();
    return existing.toObject() as AboutArticleRecord;
  }

  async deleteArticleById(id: string): Promise<void> {
    await this.articleModel.deleteOne({ id }).exec();
  }

  async deleteAllArticles(): Promise<void> {
    await this.articleModel.deleteMany({}).exec();
  }

  async deleteAllCategories(): Promise<void> {
    await this.categoryModel.deleteMany({}).exec();
  }
}

export const aboutPersistenceProvider = {
  provide: ABOUT_PERSISTENCE_PORT,
  useClass: AboutPersistenceAdapter,
};
