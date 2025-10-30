/**
 * Example usage of validated query hooks
 * 
 * This file demonstrates how to migrate from regular TanStack Query hooks
 * to validated hooks that automatically validate API responses with Zod schemas.
 * 
 * Migration example:
 * 
 * BEFORE:
 * ```typescript
 * export function usePublication(id: string) {
 *   return useQuery({
 *     queryKey: queryKeys.publications.detail(id),
 *     queryFn: () => publicationsApiV1.getPublication(id),
 *     enabled: !!id,
 *   });
 * }
 * ```
 * 
 * AFTER (with validation):
 * ```typescript
 * import { useValidatedQuery } from '@/lib/api/validated-query';
 * import { PublicationSchema } from '@/types/api-v1';
 * 
 * export function usePublication(id: string) {
 *   return useValidatedQuery({
 *     queryKey: queryKeys.publications.detail(id),
 *     queryFn: () => publicationsApiV1.getPublication(id),
 *     schema: PublicationSchema,
 *     context: `usePublication(${id})`,
 *     enabled: !!id,
 *   });
 * }
 * ```
 * 
 * For mutations:
 * ```typescript
 * import { useValidatedMutation } from '@/lib/api/validated-query';
 * import { PublicationSchema, CreatePublicationDtoSchema } from '@/types/api-v1';
 * 
 * export function useCreatePublication() {
 *   const queryClient = useQueryClient();
 *   
 *   return useValidatedMutation({
 *     mutationFn: (data) => publicationsApiV1.createPublication(data),
 *     inputSchema: CreatePublicationDtoSchema,  // Validates input
 *     outputSchema: PublicationSchema,          // Validates output
 *     context: 'useCreatePublication',
 *     onSuccess: () => {
 *       queryClient.invalidateQueries({ queryKey: queryKeys.publications.lists() });
 *     },
 *   });
 * }
 * ```
 * 
 * Error handling:
 * Validation errors are automatically logged and can be caught in component error boundaries.
 * Use the validation error handler utilities for user-friendly error messages:
 * 
 * ```typescript
 * import { getUserFriendlyError } from '@/lib/api/validation-error-handler';
 * import { ValidationError } from '@/lib/api/validation';
 * 
 * try {
 *   await mutation.mutateAsync(data);
 * } catch (error) {
 *   if (error instanceof ValidationError) {
 *     const message = getUserFriendlyError(error.zodError);
 *     toast.error(message);
 *   }
 * }
 * ```
 */

export {};

