import { useQuery, useMutation, useInfiniteQuery, _UseQueryOptions, UseMutationOptions, _UseInfiniteQueryOptions } from '@tanstack/react-query';
import { _z, ZodTypeAny } from 'zod';
import { validateData, validateApiResponse, validatePaginatedResponse, ValidationError } from './validation';

/**
 * Wrapper for useQuery with Zod validation
 * Avoids deep type instantiation by using a simple options interface
 */
export function useValidatedQuery<TError = Error>(
  options: {
    queryKey: readonly unknown[];
    queryFn: () => Promise<unknown>;
    schema: ZodTypeAny;
    context?: string;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: boolean | number;
  }
): ReturnType<typeof useQuery<unknown, TError>> {
  const { queryFn, schema, context, enabled, staleTime, gcTime, refetchOnWindowFocus, retry } = options;

  return useQuery({
    queryKey: options.queryKey,
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry,
    queryFn: async () => {
      try {
        const response = await queryFn();
        return validateApiResponse(schema, response, context);
      } catch {
        if (error instanceof ValidationError) {
          console.error('Validation error:', error.zodError, error.context);
          throw error;
        }
        throw error;
      }
    },
  }) as unknown;
}

/**
 * Wrapper for useMutation with Zod validation for input
 * Avoids deep type instantiation by accepting schemas as ZodTypeAny without generics
 */
export function useValidatedMutation<TError = Error>(
  options: Omit<UseMutationOptions<unknown, TError, unknown>, 'mutationFn'> & {
    mutationFn: (variables: unknown) => Promise<unknown>;
    inputSchema?: ZodTypeAny;
    outputSchema: ZodTypeAny;
    context?: string;
  }
): ReturnType<typeof useMutation<unknown, TError, unknown>> {
  const { mutationFn, inputSchema, outputSchema, context, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables: unknown) => {
      try {
        // Validate input if schema provided
        const validatedInput = inputSchema ? validateData(inputSchema, variables, `${context || 'mutation'}.input`) : variables;
        
        // Execute mutation
        const response = await mutationFn(validatedInput);
        
        // Validate output
        return validateApiResponse(outputSchema, response, `${context || 'mutation'}.output`);
      } catch {
        if (error instanceof ValidationError) {
          console.error('Validation error:', error.zodError, error.context);
          throw error;
        }
        throw error;
      }
    },
  });
}

/**
 * Wrapper for useInfiniteQuery with Zod validation
 * Avoids deep type instantiation by accepting schema as ZodTypeAny without generics
 */
export function useValidatedInfiniteQuery<TError = Error>(
  options: {
    queryKey: readonly unknown[];
    queryFn: (pageParam: unknown) => Promise<unknown>;
    schema: ZodTypeAny;
    context?: string;
    enabled?: boolean;
    staleTime?: number;
    gcTime?: number;
    refetchOnWindowFocus?: boolean;
    retry?: boolean | number;
    getNextPageParam: (lastPage: unknown, allPages: unknown[]) => number | undefined;
    initialPageParam: number;
  }
): ReturnType<typeof useInfiniteQuery<unknown, TError>> {
  const { queryFn, schema, context, enabled, staleTime, gcTime, refetchOnWindowFocus, retry, getNextPageParam, initialPageParam } = options;

  return useInfiniteQuery({
    queryKey: options.queryKey,
    enabled,
    staleTime,
    gcTime,
    refetchOnWindowFocus,
    retry,
    getNextPageParam,
    initialPageParam,
    queryFn: async ({ pageParam }) => {
      try {
        const response = await queryFn(pageParam);
        // For infinite queries, we expect paginated responses
        const validated = validatePaginatedResponse(schema, response, context);
        return validated.data;
      } catch {
        if (error instanceof ValidationError) {
          console.error('Validation error:', error.zodError, error.context);
          throw error;
        }
        throw error;
      }
    },
  }) as unknown;
}
