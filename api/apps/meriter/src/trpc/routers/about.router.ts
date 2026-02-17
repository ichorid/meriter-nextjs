import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

const CreateAboutCategorySchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(500).optional(),
  order: z.number().int().optional(),
});

const UpdateAboutCategorySchema = z.object({
  id: z.string(),
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(500).optional(),
  order: z.number().int().optional(),
});

const CreateAboutArticleSchema = z.object({
  categoryId: z.string(),
  title: z.string().min(1).max(200),
  content: z.string().min(1),
  order: z.number().int().optional(),
});

const UpdateAboutArticleSchema = z.object({
  id: z.string(),
  categoryId: z.string().optional(),
  title: z.string().min(1).max(200).optional(),
  content: z.string().min(1).optional(),
  order: z.number().int().optional(),
});

export const aboutRouter = router({
  /**
   * Get all categories with articles (public - anyone can read)
   */
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.aboutService.getAllCategoriesWithArticles();
  }),

  /**
   * Get introduction text (public)
   */
  getIntroduction: publicProcedure.query(async ({ ctx }) => {
    return await ctx.aboutService.getIntroduction();
  }),

  /**
   * Get category by ID with articles (public)
   */
  getCategoryById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.aboutService.getCategoryWithArticlesById(input.id);
    }),

  /**
   * Get article by ID (public)
   */
  getArticleById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.aboutService.getArticleById(input.id);
    }),

  /**
   * Create a new category (superadmin only)
   */
  createCategory: protectedProcedure
    .input(CreateAboutCategorySchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can create about categories',
        });
      }

      return await ctx.aboutService.createCategory(input);
    }),

  /**
   * Update a category (superadmin only)
   */
  updateCategory: protectedProcedure
    .input(UpdateAboutCategorySchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update about categories',
        });
      }

      const { id, ...dto } = input;
      return await ctx.aboutService.updateCategory(id, dto);
    }),

  /**
   * Delete a category and all its articles (superadmin only)
   */
  deleteCategory: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can delete about categories',
        });
      }

      await ctx.aboutService.deleteCategory(input.id);
      return { success: true };
    }),

  /**
   * Create a new article (superadmin only)
   */
  createArticle: protectedProcedure
    .input(CreateAboutArticleSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can create about articles',
        });
      }

      return await ctx.aboutService.createArticle(input);
    }),

  /**
   * Update an article (superadmin only)
   */
  updateArticle: protectedProcedure
    .input(UpdateAboutArticleSchema)
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update about articles',
        });
      }

      const { id, ...dto } = input;
      return await ctx.aboutService.updateArticle(id, dto);
    }),

  /**
   * Delete an article (superadmin only)
   */
  deleteArticle: protectedProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can delete about articles',
        });
      }

      await ctx.aboutService.deleteArticle(input.id);
      return { success: true };
    }),

  /**
   * Set introduction text (superadmin only)
   */
  setIntroduction: protectedProcedure
    .input(z.object({ content: z.string() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can set introduction',
        });
      }

      await ctx.aboutService.setIntroduction(input.content);
      return { success: true };
    }),

  /**
   * Initialize demo data (superadmin only, when no content exists)
   */
  initializeDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only superadmin can initialize demo data',
      });
    }

    await ctx.aboutService.initializeDemoData();
    return { success: true };
  }),

  /**
   * Reset "О проекте" to demo data: replace all content with default (superadmin only).
   */
  resetToDemoData: protectedProcedure.mutation(async ({ ctx }) => {
    if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only superadmin can reset about to demo data',
      });
    }

    await ctx.aboutService.resetToDemoData();
    return { success: true };
  }),
});

