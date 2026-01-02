import { z } from 'zod';
import { router, protectedProcedure, publicProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { GLOBAL_ROLE_SUPERADMIN } from '../../domain/common/constants/roles.constants';

const CreateCategorySchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(100).optional(),
  order: z.number().int().optional(),
});

const UpdateCategorySchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100).optional(),
  slug: z.string().min(1).max(100).optional(),
  order: z.number().int().optional(),
});

const DeleteCategorySchema = z.object({
  id: z.string(),
});

export const categoriesRouter = router({
  /**
   * Get all categories (public - anyone can read)
   */
  getAll: publicProcedure.query(async ({ ctx }) => {
    return await ctx.categoryService.getAllCategories();
  }),

  /**
   * Get category by ID (public - anyone can read)
   */
  getById: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      return await ctx.categoryService.getCategoryById(input.id);
    }),

  /**
   * Create a new category (superadmin only)
   */
  create: protectedProcedure
    .input(CreateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is superadmin
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can create categories',
        });
      }

      return await ctx.categoryService.createCategory(input);
    }),

  /**
   * Update a category (superadmin only)
   */
  update: protectedProcedure
    .input(UpdateCategorySchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is superadmin
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can update categories',
        });
      }

      const { id, ...dto } = input;
      return await ctx.categoryService.updateCategory(id, dto);
    }),

  /**
   * Delete a category (superadmin only)
   * Also removes the category from all publications
   */
  delete: protectedProcedure
    .input(DeleteCategorySchema)
    .mutation(async ({ ctx, input }) => {
      // Check if user is superadmin
      if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only superadmin can delete categories',
        });
      }

      await ctx.categoryService.deleteCategory(input.id);
      return { success: true };
    }),

  /**
   * Initialize default categories (superadmin only)
   * Only works if no categories exist yet
   */
  initializeDefaults: protectedProcedure.mutation(async ({ ctx }) => {
    // Check if user is superadmin
    if (ctx.user?.globalRole !== GLOBAL_ROLE_SUPERADMIN) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only superadmin can initialize default categories',
      });
    }

    return await ctx.categoryService.initializeDefaultCategories();
  }),
});

