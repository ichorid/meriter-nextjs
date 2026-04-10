import { z } from 'zod';

export const MeritTransferWalletTypeSchema = z.enum(['global', 'community', 'project']);

export const MeritTransferCreateInputSchema = z
  .object({
    senderId: z.string().min(1),
    receiverId: z.string().min(1),
    amount: z.number().int().positive(),
    comment: z.string().max(4000).optional(),
    sourceWalletType: MeritTransferWalletTypeSchema,
    sourceContextId: z.string().nullish(),
    targetWalletType: MeritTransferWalletTypeSchema,
    targetContextId: z.string().nullish(),
    communityContextId: z.string().min(1),
    eventPostId: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.senderId === val.receiverId) {
      ctx.addIssue({
        code: 'custom',
        message: 'senderId and receiverId must differ',
        path: ['receiverId'],
      });
    }
    if (val.sourceWalletType === 'global') {
      if (val.sourceContextId != null && val.sourceContextId !== '') {
        ctx.addIssue({
          code: 'custom',
          message: 'sourceContextId must be omitted when sourceWalletType is global',
          path: ['sourceContextId'],
        });
      }
    } else {
      if (val.sourceContextId == null || val.sourceContextId === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'sourceContextId is required when sourceWalletType is not global',
          path: ['sourceContextId'],
        });
      } else if (val.sourceContextId !== val.communityContextId) {
        ctx.addIssue({
          code: 'custom',
          message: 'sourceContextId must equal communityContextId for non-global source',
          path: ['sourceContextId'],
        });
      }
    }
    if (val.targetWalletType === 'global') {
      if (val.targetContextId != null && val.targetContextId !== '') {
        ctx.addIssue({
          code: 'custom',
          message: 'targetContextId must be omitted when targetWalletType is global',
          path: ['targetContextId'],
        });
      }
    } else {
      if (val.targetContextId == null || val.targetContextId === '') {
        ctx.addIssue({
          code: 'custom',
          message: 'targetContextId is required when targetWalletType is not global',
          path: ['targetContextId'],
        });
      } else if (val.targetContextId !== val.communityContextId) {
        ctx.addIssue({
          code: 'custom',
          message: 'targetContextId must equal communityContextId for non-global target',
          path: ['targetContextId'],
        });
      }
    }
  });

export type MeritTransferWalletType = z.infer<typeof MeritTransferWalletTypeSchema>;
export type MeritTransferCreateInput = z.infer<typeof MeritTransferCreateInputSchema>;
