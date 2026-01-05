import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  AboutCategorySchemaClass,
  AboutCategoryDocument,
  AboutCategory,
} from '../models/about/about-category.schema';
import {
  AboutArticleSchemaClass,
  AboutArticleDocument,
  AboutArticle,
} from '../models/about/about-article.schema';
import { uid } from 'uid';

export interface CreateAboutCategoryDto {
  title: string;
  description?: string;
  order?: number;
}

export interface UpdateAboutCategoryDto {
  title?: string;
  description?: string;
  order?: number;
}

export interface CreateAboutArticleDto {
  categoryId: string;
  title: string;
  content: string;
  order?: number;
}

export interface UpdateAboutArticleDto {
  categoryId?: string;
  title?: string;
  content?: string;
  order?: number;
}

export interface AboutCategoryWithArticles extends AboutCategory {
  articles: AboutArticle[];
}

@Injectable()
export class AboutService {
  private readonly logger = new Logger(AboutService.name);

  constructor(
    @InjectModel(AboutCategorySchemaClass.name)
    private categoryModel: Model<AboutCategoryDocument>,
    @InjectModel(AboutArticleSchemaClass.name)
    private articleModel: Model<AboutArticleDocument>,
  ) {}

  /**
   * Get all categories with their articles, ordered by order field
   * Excludes the special 'introduction' category
   */
  async getAllCategoriesWithArticles(): Promise<AboutCategoryWithArticles[]> {
    const categories = await this.categoryModel
      .find({ id: { $ne: 'introduction' } }) // Exclude introduction category
      .sort({ order: 1, createdAt: 1 })
      .exec();

    const categoriesWithArticles = await Promise.all(
      categories.map(async (cat) => {
        const articles = await this.articleModel
          .find({ categoryId: cat.id })
          .sort({ order: 1, createdAt: 1 })
          .exec();

        return {
          ...cat.toObject(),
          articles: articles.map((art) => art.toObject()),
        };
      }),
    );

    return categoriesWithArticles;
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<AboutCategory[]> {
    const categories = await this.categoryModel
      .find()
      .sort({ order: 1, createdAt: 1 })
      .exec();
    return categories.map((cat) => cat.toObject());
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<AboutCategory> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }
    return category.toObject();
  }

  /**
   * Get category with articles by ID
   */
  async getCategoryWithArticlesById(id: string): Promise<AboutCategoryWithArticles> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    const articles = await this.articleModel
      .find({ categoryId: id })
      .sort({ order: 1, createdAt: 1 })
      .exec();

    return {
      ...category.toObject(),
      articles: articles.map((art) => art.toObject()),
    };
  }

  /**
   * Create a new category
   */
  async createCategory(dto: CreateAboutCategoryDto): Promise<AboutCategory> {
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
      title: dto.title,
      description: dto.description,
      order,
    });

    await category.save();
    this.logger.log(`Created about category: ${category.id} (${category.title})`);
    return category.toObject();
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, dto: UpdateAboutCategoryDto): Promise<AboutCategory> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    // Update fields
    if (dto.title !== undefined) category.title = dto.title;
    if (dto.description !== undefined) category.description = dto.description;
    if (dto.order !== undefined) category.order = dto.order;

    await category.save();
    this.logger.log(`Updated about category: ${category.id} (${category.title})`);
    return category.toObject();
  }

  /**
   * Delete a category and all its articles
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.categoryModel.findOne({ id }).exec();
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    // Delete all articles in this category
    await this.articleModel.deleteMany({ categoryId: id }).exec();

    // Delete the category
    await this.categoryModel.deleteOne({ id }).exec();
    this.logger.log(`Deleted about category: ${id} (${category.title})`);
  }

  /**
   * Get all articles for a category
   */
  async getArticlesByCategoryId(categoryId: string): Promise<AboutArticle[]> {
    const articles = await this.articleModel
      .find({ categoryId })
      .sort({ order: 1, createdAt: 1 })
      .exec();
    return articles.map((art) => art.toObject());
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<AboutArticle> {
    const article = await this.articleModel.findOne({ id }).exec();
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }
    return article.toObject();
  }

  /**
   * Create a new article
   */
  async createArticle(dto: CreateAboutArticleDto): Promise<AboutArticle> {
    // Verify category exists
    const category = await this.categoryModel.findOne({ id: dto.categoryId }).exec();
    if (!category) {
      throw new NotFoundException(`About category with id ${dto.categoryId} not found`);
    }

    // Get max order if not provided
    let order = dto.order;
    if (order === undefined) {
      const maxOrderArticle = await this.articleModel
        .findOne({ categoryId: dto.categoryId })
        .sort({ order: -1 })
        .exec();
      order = maxOrderArticle ? maxOrderArticle.order + 1 : 0;
    }

    const article = new this.articleModel({
      id: uid(),
      categoryId: dto.categoryId,
      title: dto.title,
      content: dto.content,
      order,
    });

    await article.save();
    this.logger.log(`Created about article: ${article.id} (${article.title})`);
    return article.toObject();
  }

  /**
   * Update an article
   */
  async updateArticle(id: string, dto: UpdateAboutArticleDto): Promise<AboutArticle> {
    const article = await this.articleModel.findOne({ id }).exec();
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }

    // Verify new category exists if changing
    if (dto.categoryId && dto.categoryId !== article.categoryId) {
      const category = await this.categoryModel.findOne({ id: dto.categoryId }).exec();
      if (!category) {
        throw new NotFoundException(`About category with id ${dto.categoryId} not found`);
      }
    }

    // Update fields
    if (dto.categoryId !== undefined) article.categoryId = dto.categoryId;
    if (dto.title !== undefined) article.title = dto.title;
    if (dto.content !== undefined) article.content = dto.content;
    if (dto.order !== undefined) article.order = dto.order;

    await article.save();
    this.logger.log(`Updated about article: ${article.id} (${article.title})`);
    return article.toObject();
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string): Promise<void> {
    const article = await this.articleModel.findOne({ id }).exec();
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }

    await this.articleModel.deleteOne({ id }).exec();
    this.logger.log(`Deleted about article: ${id} (${article.title})`);
  }

  /**
   * Get introduction text (stored as a special category with id 'introduction')
   */
  async getIntroduction(): Promise<string | null> {
    const introCategory = await this.categoryModel.findOne({ id: 'introduction' }).exec();
    if (!introCategory) {
      return null;
    }
    // Return description as HTML content
    return introCategory.description || null;
  }

  /**
   * Set introduction text
   */
  async setIntroduction(content: string): Promise<void> {
    let introCategory = await this.categoryModel.findOne({ id: 'introduction' }).exec();
    if (!introCategory) {
      introCategory = new this.categoryModel({
        id: 'introduction',
        title: 'Introduction',
        description: content,
        order: -1, // Always first
      });
    } else {
      introCategory.description = content;
    }
    await introCategory.save();
  }

  /**
   * Initialize demo data for fake mode
   */
  async initializeDemoData(): Promise<void> {
    const existingCategories = await this.categoryModel.countDocuments().exec();
    if (existingCategories > 0) {
      this.logger.log('About content already exists, skipping demo data initialization');
      return;
    }

    // Set introduction
    await this.setIntroduction(
      '<p>Добро пожаловать на платформу Meriter! Это демонстрационная версия системы управления меритами и голосованием.</p><p>Здесь вы найдёте информацию о том, как пользоваться платформой, правила голосования и другие полезные материалы.</p>'
    );

    // Create demo categories and articles
    const categories = [
      {
        title: 'Начало работы',
        description: 'Основы работы с платформой',
        articles: [
          {
            title: 'Регистрация и вход',
            content: '<p>Для начала работы с платформой необходимо зарегистрироваться через Telegram или другой поддерживаемый способ аутентификации.</p><p>После регистрации вы получите доступ к базовым функциям платформы.</p>',
          },
          {
            title: 'Создание поста',
            content: '<p>Чтобы создать пост, перейдите в нужное сообщество и нажмите кнопку "Создать пост".</p><p>Заполните все обязательные поля: заголовок, описание и содержание.</p>',
          },
          {
            title: 'Голосование за посты',
            content: '<p>Вы можете голосовать за посты, используя свои мериты. Мериты тратятся из дневной квоты, а затем из накопленных.</p><p>Для голосования против поста можно использовать только накопленные мериты.</p>',
          },
        ],
      },
      {
        title: 'Мериты и голосование',
        description: 'Как работают мериты и система голосования',
        articles: [
          {
            title: 'Что такое мериты?',
            content: '<p>Мериты — это внутренняя валюта платформы, которая используется для голосования за посты.</p><p>Существует два типа меритов: дневная квота (обновляется ежедневно) и накопленные мериты (заработанные в других постах).</p>',
          },
          {
            title: 'Как получить мериты?',
            content: '<p>Мериты можно получить, создавая качественные посты и получая положительные голоса от других пользователей.</p><p>Чем больше положительных голосов получает ваш пост, тем больше меритов вы зарабатываете.</p>',
          },
          {
            title: 'Правила голосования',
            content: '<p>При голосовании за пост сначала тратятся мериты из дневной квоты, затем из накопленных.</p><p>Для голосования против поста можно использовать только накопленные мериты с кошелька.</p><p>Каждый голос требует обязательного комментария.</p>',
          },
        ],
      },
      {
        title: 'Сообщества',
        description: 'Работа с сообществами',
        articles: [
          {
            title: 'Что такое сообщества?',
            content: '<p>Сообщества — это группы пользователей, объединённые общей тематикой или целью.</p><p>В каждом сообществе можно создавать посты, голосовать и обсуждать различные вопросы.</p>',
          },
          {
            title: 'Создание сообщества',
            content: '<p>Создать новое сообщество может только суперадминистратор платформы.</p><p>После создания сообщества можно настроить его параметры, правила и внешний вид.</p>',
          },
        ],
      },
      {
        title: 'Модерация',
        description: 'Правила модерации контента',
        articles: [
          {
            title: 'Правила публикации',
            content: '<p>При публикации поста убедитесь, что контент соответствует правилам сообщества и платформы.</p><p>Запрещено публиковать спам, оскорбления, незаконный контент и другую неподходящую информацию.</p>',
          },
          {
            title: 'Жалобы и модерация',
            content: '<p>Если вы обнаружили нарушение правил, вы можете сообщить об этом модераторам сообщества.</p><p>Модераторы имеют право удалять посты и комментарии, нарушающие правила.</p>',
          },
        ],
      },
      {
        title: 'FAQ',
        description: 'Часто задаваемые вопросы',
        articles: [
          {
            title: 'Как восстановить доступ?',
            content: '<p>Если вы потеряли доступ к аккаунту, обратитесь в поддержку через Telegram или другой доступный канал связи.</p>',
          },
          {
            title: 'Как изменить настройки профиля?',
            content: '<p>Настройки профиля можно изменить в разделе "Профиль" в меню пользователя.</p><p>Там вы можете изменить имя, аватар и другие параметры.</p>',
          },
        ],
      },
    ];

    for (let i = 0; i < categories.length; i++) {
      const catData = categories[i];
      const category = new this.categoryModel({
        id: uid(),
        title: catData.title,
        description: catData.description,
        order: i,
      });
      await category.save();

      for (let j = 0; j < catData.articles.length; j++) {
        const artData = catData.articles[j];
        const article = new this.articleModel({
          id: uid(),
          categoryId: category.id,
          title: artData.title,
          content: artData.content,
          order: j,
        });
        await article.save();
      }
    }

    this.logger.log(`Initialized ${categories.length} demo categories with articles`);
  }
}

