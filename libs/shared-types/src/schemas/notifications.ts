/**
 * Phase 1 Option B subpath entry (@meriter/shared-types/schemas/notifications).
 */
import { z } from 'zod';
import { NotificationTypeSchema } from '../notification.schema';

export { NotificationTypeSchema } from '../notification.schema';

export type { NotificationType } from '../notification.schema';

/** One row of the inv-25 notification subtitle/link routing matrix. */
export const NotificationRoutingRowSchema = z.object({
  type: NotificationTypeSchema,
  /** Template id for subtitle rendering (NotificationsClient / i18n). */
  subtitleKey: z.string().min(1),
  /** Template id for deep-link construction (NotificationService.buildRedirectUrl). */
  linkPattern: z.string().min(1),
});

export type NotificationRoutingRow = z.infer<typeof NotificationRoutingRowSchema>;

/**
 * Phase 1 stub: exactly 47 rows, one per NotificationTypeSchema literal (inv-25 gate).
 */
export const NotificationRoutingSchema = z
  .array(NotificationRoutingRowSchema)
  .length(47)
  .superRefine((rows, ctx) => {
    const types = rows.map((row) => row.type);
    if (new Set(types).size !== types.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'NotificationRoutingSchema rows must have unique type values',
      });
    }
    for (const expected of NotificationTypeSchema.options) {
      if (!types.includes(expected)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `NotificationRoutingSchema missing row for type "${expected}"`,
        });
      }
    }
  });

export type NotificationRoutingMatrix = z.infer<typeof NotificationRoutingSchema>;
