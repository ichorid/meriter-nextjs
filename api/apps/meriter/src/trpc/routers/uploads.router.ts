import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import { TRPCError } from '@trpc/server';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  createUploadMediaUseCase,
  UploadNotConfiguredError,
} from '../../application/use-cases/uploads/upload-media.use-case';

function mapUploadError(error: unknown): never {
  if (error instanceof UploadNotConfiguredError) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof BadRequestException) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: error.message,
    });
  }
  if (error instanceof ForbiddenException) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: error.message,
    });
  }
  throw error;
}

function createUploadMedia(ctx: {
  uploadsService: Parameters<typeof createUploadMediaUseCase>[0]['uploadsService'];
  permissionService?: Parameters<typeof createUploadMediaUseCase>[0]['permissionService'];
  user: { id: string; globalRole?: string };
}) {
  return createUploadMediaUseCase({
    uploadsService: ctx.uploadsService,
    permissionService: ctx.permissionService,
    user: ctx.user,
  });
}

/**
 * Upload router — delegates to UploadMediaUseCase (BC-12 / P-7).
 */
export const uploadsRouter = router({
  uploadImage: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
        fileName: z.string(),
        mimeType: z.string(),
        maxWidth: z.number().int().positive().optional().default(1920),
        maxHeight: z.number().int().positive().optional().default(1080),
        quality: z.number().int().min(1).max(100).optional().default(85),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createUploadMedia(ctx).uploadImage(input);
      } catch (error) {
        mapUploadError(error);
      }
    }),

  uploadAvatar: protectedProcedure
    .input(
      z.object({
        fileData: z.string(),
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
      try {
        return await createUploadMedia(ctx).uploadAvatar({
          ...input,
          userId: ctx.user.id,
        });
      } catch (error) {
        mapUploadError(error);
      }
    }),

  uploadCommunityAvatar: protectedProcedure
    .input(
      z.object({
        communityId: z.string(),
        fileData: z.string(),
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
      try {
        return await createUploadMedia(ctx).uploadCommunityAvatar(input);
      } catch (error) {
        mapUploadError(error);
      }
    }),
});
