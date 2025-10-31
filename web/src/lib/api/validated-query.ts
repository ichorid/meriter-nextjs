import { useQuery, useMutation, useInfiniteQuery, UseQueryOptions, UseMutationOptions, UseInfiniteQueryOptions } from '@tanstack/react-query';
import { ZodSchema } from 'zod';
import { validateData, validateApiResponse, validatePaginatedResponse, ValidationError } from './validation';

/**
 * Wrapper for useQuery with Zod validation
 */
export function useValidatedQuery<TData, TError = Error>(
  options: Omit<UseQueryOptions<TData, TError>, 'queryFn'> & {
    queryFn: () => Promise<unknown>;
    schema: ZodSchema<TData>;
    context?: string;
  }
) {
  const { queryFn, schema, context, ...queryOptions } = options;

  return useQuery({
    ...queryOptions,
    queryFn: async () => {
      try {
        const response = await queryFn();
        return validateApiResponse(schema, response, context);
      } catch (error) {
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
 * Wrapper for useMutation with Zod validation for input
 */
export function useValidatedMutation<TData, TVariables, TError = Error>(
  options: Omit<UseMutationOptions<TData, TError, TVariables>, 'mutationFn'> & {
    mutationFn: (variables: TVariables) => Promise<unknown>;
    inputSchema?: ZodSchema<TVariables>;
    outputSchema: ZodSchema<TData>;
    context?: string;
  }
) {
  const { mutationFn, inputSchema, outputSchema, context, ...mutationOptions } = options;

  return useMutation({
    ...mutationOptions,
    mutationFn: async (variables: TVariables) => {
      try {
        // Validate input if schema provided
        const validatedInput = inputSchema ? validateData(inputSchema, variables, `${context || 'mutation'}.input`) : variables;
        
        // Execute mutation
        const response = await mutationFn(validatedInput);
        
        // Validate output
        return validateApiResponse(outputSchema, response, `${context || 'mutation'}.output`);
      } catch (error) {
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
 */
export function useValidatedInfiniteQuery<TData, TError = Error>(
  options: Omit<UseInfiniteQueryOptions<TData, TError>, 'queryFn'> & {
    queryFn: (pageParam: any) => Promise<unknown>;
    schema: ZodSchema<TData>;
    context?: string;
  }
) {
  const { queryFn, schema, context, ...queryOptions } = options;

  return useInfiniteQuery({
    ...queryOptions,
    queryFn: async ({ pageParam }) => {
      try {
        const response = await queryFn(pageParam);
        // For infinite queries, we expect paginated responses
        const validated = validatePaginatedResponse(schema, response, context);
        return validated.data as TData;
      } catch (error) {
        if (error instanceof ValidationError) {
          console.error('Validation error:', error.zodError, error.context);
          throw error;
        }
        throw error;
      }
    },
  });
}

