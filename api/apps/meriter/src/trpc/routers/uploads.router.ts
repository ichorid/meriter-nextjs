import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';

/**
 * Upload router for handling file uploads via tRPC
 * Accepts base64-encoded file data and converts to Buffer for processing
 */
export const uploadsRouter = router({
  /**
   * Upload a general image (for posts, comments)
   * POST /trpc/uploads.uploadImage
   */
  uploadImage: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // base64-encoded file data
        fileName: z.string(),
        mimeType: z.string(),
        maxWidth: z.number().int().positive().optional().default(1920),
        maxHeight: z.number().int().positive().optional().default(1080),
        quality: z.number().int().min(1).max(100).optional().default(85),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.uploadsService.isConfigured()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Image upload is not available. S3 storage is not configured.',
        });
      }

      // Convert base64 to Buffer
      let fileBuffer: Buffer;
      try {
        // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
        const base64Data = input.fileData.includes(',')
          ? input.fileData.split(',')[1]
          : input.fileData;
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid base64 file data',
        });
      }

      // Create Express.Multer.File-like object
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: input.fileName,
        encoding: '7bit',
        mimetype: input.mimeType,
        size: fileBuffer.length,
        buffer: fileBuffer,
        destination: '',
        filename: input.fileName,
        path: '',
        stream: null as any,
      };

      const result = await ctx.uploadsService.uploadImage(file, {
        folder: 'posts',
        maxWidth: input.maxWidth,
        maxHeight: input.maxHeight,
        quality: input.quality,
      });

      return result;
    }),

  /**
   * Upload user avatar with optional crop
   * POST /trpc/uploads.uploadAvatar
   */
  uploadAvatar: protectedProcedure
    .input(
      z.object({
        fileData: z.string(), // base64-encoded file data
        fileName: z.string(),
        mimeType: z.string(),
        crop: z
          .object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.uploadsService.isConfigured()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Image upload is not available. S3 storage is not configured.',
        });
      }

      const userId = ctx.user.id;

      // Convert base64 to Buffer
      let fileBuffer: Buffer;
      try {
        const base64Data = input.fileData.includes(',')
          ? input.fileData.split(',')[1]
          : input.fileData;
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid base64 file data',
        });
      }

      // Create Express.Multer.File-like object
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: input.fileName,
        encoding: '7bit',
        mimetype: input.mimeType,
        size: fileBuffer.length,
        buffer: fileBuffer,
        destination: '',
        filename: input.fileName,
        path: '',
        stream: null as any,
      };

      const result = await ctx.uploadsService.uploadAvatar(
        file,
        userId,
        input.crop,
      );

      return result;
    }),

  /**
   * Upload community avatar (lead only)
   * POST /trpc/uploads.uploadCommunityAvatar
   */
  uploadCommunityAvatar: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        fileData: z.string(), // base64-encoded file data
        fileName: z.string(),
        mimeType: z.string(),
        crop: z
          .object({
            x: z.number(),
            y: z.number(),
            width: z.number(),
            height: z.number(),
          })
          .optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      if (!ctx.uploadsService.isConfigured()) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Image upload is not available. S3 storage is not configured.',
        });
      }

      // Check if user is lead in the community
      const userRole = await ctx.permissionService.getUserRoleInCommunity(
        ctx.user.id,
        input.communityId,
      );

      if (userRole !== 'lead' && ctx.user.globalRole !== 'superadmin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only community leads can upload community avatars',
        });
      }

      // Convert base64 to Buffer
      let fileBuffer: Buffer;
      try {
        const base64Data = input.fileData.includes(',')
          ? input.fileData.split(',')[1]
          : input.fileData;
        fileBuffer = Buffer.from(base64Data, 'base64');
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Invalid base64 file data',
        });
      }

      // Create Express.Multer.File-like object
      const file: Express.Multer.File = {
        fieldname: 'file',
        originalname: input.fileName,
        encoding: '7bit',
        mimetype: input.mimeType,
        size: fileBuffer.length,
        buffer: fileBuffer,
        destination: '',
        filename: input.fileName,
        path: '',
        stream: null as any,
      };

      const result = await ctx.uploadsService.uploadCommunityAvatar(
        file,
        input.communityId,
        input.crop,
      );

      return result;
    }),
});

