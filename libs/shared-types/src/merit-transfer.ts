import { z } from 'zod';

export const MeritTransferWalletTypeSchema = z.enum(['global', 'community', 'project']);

/** Plain object — use `.superRefine` on this or `.omit()` before refining (Zod 4 forbids `.omit()` after refinements). */
export const MeritTransferCreateObjectSchema = z.object({
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
});

type MeritTransferWalletContextInput = Pick<
  z.infer<typeof MeritTransferCreateObjectSchema>,
  | 'sourceWalletType'
  | 'sourceContextId'
  | 'targetWalletType'
  | 'targetContextId'
  | 'communityContextId'
>;

function refineMeritTransferWalletContext(val: MeritTransferWalletContextInput, ctx: z.core.$RefinementCtx): void {
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
}

export const MeritTransferCreateInputSchema = MeritTransferCreateObjectSchema.superRefine((val, ctx) => {
  if (val.senderId === val.receiverId) {
    ctx.addIssue({
      code: 'custom',
      message: 'senderId and receiverId must differ',
      path: ['receiverId'],
    });
  }
  refineMeritTransferWalletContext(val, ctx);
});

/** tRPC `meritTransfer.create` input (caller is sender; `senderId` is injected server-side). */
export const MeritTransferCreateProcedureInputSchema = MeritTransferCreateObjectSchema.omit({
  senderId: true,
}).superRefine((val, ctx) => {
  refineMeritTransferWalletContext(val, ctx);
});

export type MeritTransferWalletType = z.infer<typeof MeritTransferWalletTypeSchema>;
export type MeritTransferCreateInput = z.infer<typeof MeritTransferCreateInputSchema>;
export type MeritTransferCreateProcedureInput = z.infer<typeof MeritTransferCreateProcedureInputSchema>;
