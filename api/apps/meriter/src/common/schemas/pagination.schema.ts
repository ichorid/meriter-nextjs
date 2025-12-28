import { z } from 'zod';

export const PaginationInputSchema = z.object({
  page: z.number().int().min(1).optional(),
  pageSize: z.number().int().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  skip: z.number().int().min(0).optional(),
});
