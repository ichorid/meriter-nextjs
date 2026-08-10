import {
  Injectable,
  Logger,
  NotFoundException,
  Inject,
} from '@nestjs/common';
import {
  AboutCategory,
} from '../models/about/about-category.schema';
import {
  AboutArticle,
} from '../models/about/about-article.schema';
import { uid } from 'uid';
import {
  ABOUT_PERSISTENCE_PORT,
  type AboutPersistencePort,
} from '../ports/about.persistence.port';

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
    @Inject(ABOUT_PERSISTENCE_PORT)
    private readonly aboutPersistence: AboutPersistencePort,
  ) {}

  /**
   * Get all categories with their articles, ordered by order field
   * Excludes the special 'introduction' category
   */
  async getAllCategoriesWithArticles(): Promise<AboutCategoryWithArticles[]> {
    const categories =
      await this.aboutPersistence.findCategoriesExcludingIntroduction();

    const categoriesWithArticles = await Promise.all(
      categories.map(async (category) => {
        const articles = await this.aboutPersistence.findArticlesByCategoryId(
          category.id,
        );

        return {
          ...(category as AboutCategory),
          articles: articles as AboutArticle[],
        };
      }),
    );

    return categoriesWithArticles;
  }

  /**
   * Get all categories
   */
  async getAllCategories(): Promise<AboutCategory[]> {
    return (await this.aboutPersistence.findAllCategoriesOrdered()) as AboutCategory[];
  }

  /**
   * Get category by ID
   */
  async getCategoryById(id: string): Promise<AboutCategory> {
    const category = await this.aboutPersistence.findCategoryById(id);
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }
    return category as AboutCategory;
  }

  /**
   * Get category with articles by ID
   */
  async getCategoryWithArticlesById(id: string): Promise<AboutCategoryWithArticles> {
    const category = await this.aboutPersistence.findCategoryById(id);
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    const articles = await this.aboutPersistence.findArticlesByCategoryId(id);

    return {
      ...(category as AboutCategory),
      articles: articles as AboutArticle[],
    };
  }

  /**
   * Create a new category
   */
  async createCategory(dto: CreateAboutCategoryDto): Promise<AboutCategory> {
    // Get max order if not provided
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.aboutPersistence.findMaxCategoryOrder();
      order = maxOrder !== null ? maxOrder + 1 : 0;
    }

    const category = await this.aboutPersistence.createCategory({
      id: uid(),
      title: dto.title,
      description: dto.description,
      order,
    });

    this.logger.log(`Created about category: ${category.id} (${category.title})`);
    return category as AboutCategory;
  }

  /**
   * Update a category
   */
  async updateCategory(id: string, dto: UpdateAboutCategoryDto): Promise<AboutCategory> {
    const category = await this.aboutPersistence.findCategoryById(id);
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    const updated = await this.aboutPersistence.saveCategory({
      ...category,
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.description !== undefined ? { description: dto.description } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    });
    this.logger.log(`Updated about category: ${category.id} (${category.title})`);
    return updated as AboutCategory;
  }

  /**
   * Delete a category and all its articles
   */
  async deleteCategory(id: string): Promise<void> {
    const category = await this.aboutPersistence.findCategoryById(id);
    if (!category) {
      throw new NotFoundException(`About category with id ${id} not found`);
    }

    // Delete all articles in this category
    await this.aboutPersistence.deleteArticlesByCategoryId(id);

    // Delete the category
    await this.aboutPersistence.deleteCategoryById(id);
    this.logger.log(`Deleted about category: ${id} (${category.title})`);
  }

  /**
   * Get all articles for a category
   */
  async getArticlesByCategoryId(categoryId: string): Promise<AboutArticle[]> {
    return (await this.aboutPersistence.findArticlesByCategoryId(
      categoryId,
    )) as AboutArticle[];
  }

  /**
   * Get article by ID
   */
  async getArticleById(id: string): Promise<AboutArticle> {
    const article = await this.aboutPersistence.findArticleById(id);
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }
    return article as AboutArticle;
  }

  /**
   * Create a new article
   */
  async createArticle(dto: CreateAboutArticleDto): Promise<AboutArticle> {
    // Verify category exists
    const category = await this.aboutPersistence.findCategoryById(dto.categoryId);
    if (!category) {
      throw new NotFoundException(`About category with id ${dto.categoryId} not found`);
    }

    // Get max order if not provided
    let order = dto.order;
    if (order === undefined) {
      const maxOrder = await this.aboutPersistence.findMaxArticleOrderInCategory(
        dto.categoryId,
      );
      order = maxOrder !== null ? maxOrder + 1 : 0;
    }

    const article = await this.aboutPersistence.createArticle({
      id: uid(),
      categoryId: dto.categoryId,
      title: dto.title,
      content: dto.content,
      order,
    });

    this.logger.log(`Created about article: ${article.id} (${article.title})`);
    return article as AboutArticle;
  }

  /**
   * Update an article
   */
  async updateArticle(id: string, dto: UpdateAboutArticleDto): Promise<AboutArticle> {
    const article = await this.aboutPersistence.findArticleById(id);
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }

    // Verify new category exists if changing
    if (dto.categoryId && dto.categoryId !== article.categoryId) {
      const category = await this.aboutPersistence.findCategoryById(dto.categoryId);
      if (!category) {
        throw new NotFoundException(`About category with id ${dto.categoryId} not found`);
      }
    }

    const updated = await this.aboutPersistence.saveArticle({
      ...article,
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      ...(dto.content !== undefined ? { content: dto.content } : {}),
      ...(dto.order !== undefined ? { order: dto.order } : {}),
    });
    this.logger.log(`Updated about article: ${article.id} (${article.title})`);
    return updated as AboutArticle;
  }

  /**
   * Delete an article
   */
  async deleteArticle(id: string): Promise<void> {
    const article = await this.aboutPersistence.findArticleById(id);
    if (!article) {
      throw new NotFoundException(`About article with id ${id} not found`);
    }

    await this.aboutPersistence.deleteArticleById(id);
    this.logger.log(`Deleted about article: ${id} (${article.title})`);
  }

  /**
   * Get introduction text (stored as a special category with id 'introduction')
   */
  async getIntroduction(): Promise<string | null> {
    const introCategory = await this.aboutPersistence.findCategoryById(
      'introduction',
    );
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
    const introCategory = await this.aboutPersistence.findCategoryById(
      'introduction',
    );
    if (!introCategory) {
      await this.aboutPersistence.createCategory({
        id: 'introduction',
        title: 'Introduction',
        description: content,
        order: -1, // Always first
      });
      return;
    }
    await this.aboutPersistence.saveCategory({
      ...introCategory,
      description: content,
    });
  }

  /**
   * Demo data for "О проекте" (user-facing, reflects current platform: Marathon of Good, merits, tappalka, communities).
   * Used by initializeDemoData (when no content exists) and resetToDemoData (superadmin reset to defaults).
   */
  private static readonly DEMO_INTRODUCTION =
    '<p>Добро пожаловать на платформу <strong>Meriter</strong> — «Марафон добра»!</p>' +
    '<p>Здесь вы собираете заслуги за добрые дела и поддержку других, а затем тратите их на продвижение понравившихся «образов будущего». Чем больше заслуг — тем выше ваш вклад в общий рейтинг. Ниже — как устроена платформа и как ею пользоваться.</p>';

  private static readonly DEMO_CATEGORIES: ReadonlyArray<{
    title: string;
    description: string;
    articles: ReadonlyArray<{ title: string; content: string }>;
  }> = [
    {
      title: 'О платформе Meriter',
      description: 'Что это и для кого',
      articles: [
        {
          title: 'Что такое Meriter',
          content:
            '<p>Meriter — платформа на основе заслуг (внутренней валюты) для игры «Марафон добра». Участники публикуют посты о добрых делах и «образы будущего», голосуют за других и зарабатывают заслуги. Цель — набрать как можно больше заслуг и потратить их на продвижение своих или чужих идей в разделе «Образ будущего» (ОБ).</p>',
        },
        {
          title: 'Глобальные сообщества',
          content:
            '<p>На платформе четыре глобальных сообщества с общим кошельком заслуг:</p>' +
            '<ul><li><strong>Марафон добра (МД)</strong> — отчёты о добрых делах, здесь можно зарабатывать и снимать заслуги.</li>' +
            '<li><strong>Образ будущего (ОБ)</strong> — публикация и продвижение «образов будущего».</li>' +
            '<li><strong>Проекты</strong> — идеи и проекты в работе, заслуги с постов можно вывести только после переноса в МД.</li>' +
            '<li><strong>Обратная связь</strong> — вопросы и предложения администрации, без голосования пользователей.</li></ul>',
        },
        {
          title: 'Локальные команды',
          content:
            '<p>Вы можете создавать или вступать в локальные команды (сообщества). У команды свой лид и свои настройки; заслуги в командах отдельные от глобальных. Перенос постов между сообществами из локальных групп всегда без заслуг.</p>',
        },
      ],
    },
    {
      title: 'Заслуги и кошелёк',
      description: 'Валюта платформы',
      articles: [
        {
          title: 'Что такое заслуги',
          content:
            '<p>Заслуги — внутренняя валюта платформы. В глобальных сообществах (МД, ОБ, Проекты, Обратная связь) один общий кошелёк. Заслуги тратятся на плату за публикации и комментарии и на голосование за посты. Зарабатывать заслуги можно голосами за ваши посты и участием в майнинге.</p>',
        },
        {
          title: 'Приветственные заслуги',
          content:
            '<p>При первой регистрации новые пользователи получают стартовые заслуги на глобальный кошелёк (сумму задаёт администрация платформы). Эти заслуги можно сразу тратить на публикации и голосование.</p>',
        },
        {
          title: 'Как тратить заслуги',
          content:
            '<p>Публикация поста стоит 1 заслуга, комментарий — 0,1 заслуги (в Обратной связи публикация и комментарии бесплатные). Голосование «за» пост списывает заслуги с вашего кошелька; голосование «против» тоже списывается с кошелька. Каждый голос должен быть подкреплён комментарием.</p>',
        },
        {
          title: 'Как зарабатывать и снимать заслуги',
          content:
            '<p>Заслуги начисляются, когда другие голосуют за ваши посты (в МД и Проектах). Дополнительно заслуги можно получать в майнинге за сравнение постов.</p>' +
            '<p>Снять заслуги с поста на кошелёк можно только там, где это разрешено:</p>' +
            '<ul><li>в МД и в Обратной связи — снятие разрешено;</li>' +
            '<li>в ОБ и в Проектах — снятие запрещено; из Проектов завершённый пост можно перенести в МД и там вывести заработанное.</li></ul>',
        },
      ],
    },
    {
      title: 'Публикации и голосование',
      description: 'Посты и рейтинг',
      articles: [
        {
          title: 'Создание поста',
          content:
            '<p>Выберите сообщество и нажмите «Создать пост». Укажите заголовок, описание и содержание. С кошелька спишется плата (1 заслуга за пост, 0,1 за комментарий — если в сообществе установлены сборы). Редактировать пост можно в течение ограниченного времени после публикации.</p>',
        },
        {
          title: 'Голосование за и против',
          content:
            '<p>Голос «за» пост увеличивает его рейтинг и списывает заслуги с вашего кошелька. Голос «против» уменьшает рейтинг; против можно голосовать только заслугами с кошелька. К каждому голосу нужно оставить комментарий. В некоторых сообществах разрешено голосовать за свой пост (ОБ, Проекты), в других — нет (МД).</p>',
        },
        {
          title: 'Рейтинг и последствия',
          content:
            '<p>Рейтинг поста — сумма голосов «за» минус «против». Если рейтинг становится отрицательным, через 24 часа с кошелька автора списываются заслуги. Автор может закрыть пост до истечения 24 часов, чтобы избежать списания; закрытый пост уходит в архив и повторно опубликовать его нельзя.</p>',
        },
      ],
    },
    {
      title: 'Майнинг',
      description: 'Сравнение постов и начисление заслуг',
      articles: [
        {
          title: 'Что такое майнинг',
          content:
            '<p>Майнинг — режим, в котором вам показывают два поста из сообщества, и вы выбираете тот, который считаете лучше. За участие начисляются заслуги (например, 1 заслуга за 10 сравнений). Майнинг доступен в сообществах Марафон добра и Проекты.</p>',
        },
        {
          title: 'Как участвовать',
          content:
            '<p>Откройте раздел майнинга в одном из сообществ, где он включён. Выбирайте лучший из двух постов; после нескольких сравнений вам начислят заслуги на глобальный кошелёк.</p>',
        },
      ],
    },
    {
      title: 'Инвестирование',
      description: 'Вложение заслуг в посты',
      articles: [
        {
          title: 'Что такое инвестирование',
          content:
            '<p>Инвестирование — это вложение ваших заслуг в пост другого автора. Заслуги списываются с вашего кошелька и увеличивают «поддержку» поста. В сообществах с майнингом часть заслуг идёт на оплату показов поста в майнинге. Возврата инвестиций нет: ваши заслуги не возвращаются обратно на кошелёк.</p>',
        },
        {
          title: 'Распределение при закрытии поста',
          content:
            '<p>При закрытии поста остатки инвестиций (то, что осталось после оплаты показов в майнинге) и доход, собранный постом, распределяются между инвесторами и автором в соответствии с контрактом и пропорционально вкладу инвесторов.</p>',
        },
        {
          title: 'Зачем инвестировать',
          content:
            '<p>Инвестируя в посты, вы поддерживаете авторов и идеи, которые вам близки. Ваши заслуги влияют на рейтинг поста и его видимость в майнинге. При закрытии поста вы можете получить долю от остатков пула и дохода поста — по контракту и пропорционально вашему вкладу.</p>',
        },
      ],
    },
    {
      title: 'Сообщества',
      description: 'Глобальные и локальные',
      articles: [
        {
          title: 'Глобальные сообщества',
          content:
            '<ul>' +
            '<li><strong>МД (Марафон добра)</strong> — отчёты о добрых делах, можно зарабатывать заслуги и снимать их.</li>' +
            '<li><strong>ОБ (Образ будущего)</strong> — ваши «образы будущего», можно голосовать за свой пост, снятие заслуг с поста запрещено.</li>' +
            '<li><strong>Проекты</strong> — идеи в работе, можно голосовать за свой пост; снятие только после переноса в МД.</li>' +
            '<li><strong>Обратная связь</strong> — вопросы и предложения, без голосования пользователей; заслуги начисляет только администрация.</li>' +
            '</ul>',
        },
        {
          title: 'Локальные команды',
          content:
            '<p>Локальные команды создают пользователи; создатель становится лидом. В команде свои настройки и своя валюта заслуг. Перенос постов из локальной команды в любое другое сообщество выполняется без переноса заслуг.</p>',
        },
      ],
    },
    {
      title: 'Профиль и настройки',
      description: 'Учётная запись',
      articles: [
        {
          title: 'Профиль',
          content:
            '<p>В профиле отображаются имя, «о себе», аватар и участие в сообществах. Профиль видят другие пользователи.</p>',
        },
        {
          title: 'Редактирование профиля',
          content:
            '<p>Имя и раздел «о себе» можно изменить в разделе «Профиль» → «Редактировать». Изменения сохраняются и сразу отображаются другим пользователям.</p>',
        },
      ],
    },
    {
      title: 'Вопросы и ответы',
      description: 'Частые вопросы',
      articles: [
        {
          title: 'Как восстановить доступ?',
          content: '<p>Если вы потеряли доступ к аккаунту, обратитесь в поддержку через Telegram или другой канал, указанный на платформе.</p>',
        },
        {
          title: 'Почему нельзя снять заслуги с поста?',
          content:
            '<p>Возможность снять заслуги с поста зависит от правил сообщества. В ОБ и в Проектах снятие отключено: заслуги остаются на постах. В МД и в Обратной связи снятие разрешено.</p>',
        },
        {
          title: 'Куда писать предложения по платформе?',
          content: '<p>Публикуйте пост в сообществе «Обратная связь». Там нет платы за публикацию и комментарии; ценные предложения могут быть отмечены заслугами администрацией.</p>',
        },
      ],
    },
  ];

  /**
   * Inserts demo introduction and all demo categories with articles. Idempotent only in the sense of "what" is inserted; does not check for existing data.
   */
  private async insertDemoData(): Promise<void> {
    await this.setIntroduction(AboutService.DEMO_INTRODUCTION);

    for (let i = 0; i < AboutService.DEMO_CATEGORIES.length; i++) {
      const catData = AboutService.DEMO_CATEGORIES[i];
      const category = await this.aboutPersistence.createCategory({
        id: uid(),
        title: catData.title,
        description: catData.description,
        order: i,
      });

      for (let j = 0; j < catData.articles.length; j++) {
        const artData = catData.articles[j];
        await this.aboutPersistence.createArticle({
          id: uid(),
          categoryId: category.id,
          title: artData.title,
          content: artData.content,
          order: j,
        });
      }
    }

    this.logger.log(
      `Inserted demo data: introduction + ${AboutService.DEMO_CATEGORIES.length} categories with articles`,
    );
  }

  /**
   * Initialize demo data when no about content exists (e.g. first run).
   */
  async initializeDemoData(): Promise<void> {
    const existingCategories = await this.aboutPersistence.countCategories();
    if (existingCategories > 0) {
      this.logger.log('About content already exists, skipping demo data initialization');
      return;
    }
    await this.insertDemoData();
  }

  /**
   * Reset "О проекте" to demo data: delete all categories and articles, then insert demo content.
   * Superadmin only. Use for "Сбросить «О проекте» к демо-данным" in platform settings.
   */
  async resetToDemoData(): Promise<void> {
    await this.aboutPersistence.deleteAllArticles();
    await this.aboutPersistence.deleteAllCategories();
    this.logger.log('About content cleared, inserting demo data');
    await this.insertDemoData();
  }
}

