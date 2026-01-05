/**
 * Generic mutation factory for React Query
 * Reduces duplication in mutation hooks by providing a standardized pattern
 * with configurable invalidations and error handling
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ZodTypeAny } from 'zod';
import {
    invalidateWallet,
    invalidatePublications,
    invalidateComments,
    invalidateCommunities,
    invalidatePolls,
} from './invalidation-helpers';
import { validateData, validateApiResponse, ValidationError } from './validation';

    export interface InvalidationConfig {
        wallet?: {
        communityId?: string | ((result: any, variables: any) => string | undefined);
        includeBalance?: boolean;
        includeTransactions?: boolean;
        };
    publications?: {
        lists?: boolean;
        detail?: string | ((result: any, variables: any) => string | undefined);
        communityId?: string | ((result: any, variables: any) => string | undefined);
        feed?: boolean;
        exact?: boolean;
    };
    comments?: {
        lists?: boolean;
        detail?: string | ((result: any, variables: any) => string | undefined);
        byPublication?: string | ((result: any, variables: any) => string | undefined);
        byComment?: string | ((result: any, variables: any) => string | undefined);
        exact?: boolean;
    };
    communities?: {
        lists?: boolean;
        detail?: string | ((result: any, variables: any) => string | undefined);
        feed?: boolean;
        exact?: boolean;
    };
    polls?: {
        lists?: boolean;
        detail?: string | ((result: any, variables: any) => string | undefined);
        results?: string | ((result: any, variables: any) => string | undefined);
        exact?: boolean;
    };
    notifications?: boolean;
    quota?: {
        userId?: string | ((result: any, variables: any) => string | undefined);
        communityId?: string | ((result: any, variables: any) => string | undefined);
    };
}

export interface MutationConfig<
    TData = any,
    TVariables = any,
    TError = Error,
    TInputSchema extends ZodTypeAny | undefined = undefined,
    TOutputSchema extends ZodTypeAny | undefined = undefined
> {
    mutationFn: (variables: TVariables) => Promise<TData>;
    invalidations?: InvalidationConfig;
    errorContext?: string;
    onSuccess?: (result: TData, variables: TVariables, queryClient: ReturnType<typeof useQueryClient>) => void;
    onError?: (error: TError, variables: TVariables) => void;
    setQueryData?: {
        queryKey: (result: TData) => readonly unknown[];
        data: (result: TData) => any;
    };
    removeQuery?: {
        queryKey: (variables: TVariables) => readonly unknown[];
    };
    // Validation options - using ZodTypeAny to avoid deep type instantiation
    inputSchema?: TInputSchema;
    outputSchema?: TOutputSchema;
    validationContext?: string;
}

/**
 * Helper to resolve a value that can be either a static value or a function
 */
function resolveValue<T>(
    value: T | ((result: any, variables: any) => T) | undefined,
    result: any,
    variables: any
): T | undefined {
    if (value === undefined) return undefined;
    if (typeof value === 'function') {
        return (value as (result: any, variables: any) => T)(result, variables);
    }
    return value;
}

/**
 * Apply invalidations based on configuration
 */
function applyInvalidations(
    queryClient: ReturnType<typeof useQueryClient>,
    invalidations: InvalidationConfig | undefined,
    result: any,
    variables: any
): void {
    if (!invalidations) return;

    // Wallet invalidations
    if (invalidations.wallet) {
        const walletOpts = invalidations.wallet;
        invalidateWallet(queryClient, {
            communityId: resolveValue(walletOpts.communityId, result, variables),
            includeBalance: walletOpts.includeBalance,
            includeTransactions: walletOpts.includeTransactions,
        });
    }

    // Publication invalidations
    if (invalidations.publications) {
        const pubOpts = invalidations.publications;
        invalidatePublications(queryClient, {
            lists: pubOpts.lists,
            detail: resolveValue(pubOpts.detail, result, variables),
            communityId: resolveValue(pubOpts.communityId, result, variables),
            feed: pubOpts.feed,
            exact: pubOpts.exact,
        });
    }

    // Comment invalidations
    if (invalidations.comments) {
        const commentOpts = invalidations.comments;
        invalidateComments(queryClient, {
            lists: commentOpts.lists,
            detail: resolveValue(commentOpts.detail, result, variables),
            byPublication: resolveValue(commentOpts.byPublication, result, variables),
            byComment: resolveValue(commentOpts.byComment, result, variables),
            exact: commentOpts.exact,
        });
    }

    // Community invalidations
    if (invalidations.communities) {
        const commOpts = invalidations.communities;
        invalidateCommunities(queryClient, {
            lists: commOpts.lists,
            detail: resolveValue(commOpts.detail, result, variables),
            feed: commOpts.feed,
            exact: commOpts.exact,
        });
    }

    // Poll invalidations
    if (invalidations.polls) {
        const pollOpts = invalidations.polls;
        invalidatePolls(queryClient, {
            lists: pollOpts.lists,
            detail: resolveValue(pollOpts.detail, result, variables),
            results: resolveValue(pollOpts.results, result, variables),
            exact: pollOpts.exact,
        });
    }

    // Notification invalidations
    if (invalidations.notifications) {
        queryClient.invalidateQueries({ queryKey: ['notifications'], exact: false });
    }

    // Quota invalidations
    if (invalidations.quota) {
        const quotaOpts = invalidations.quota;
        const userId = resolveValue(quotaOpts.userId, result, variables);
        const communityId = resolveValue(quotaOpts.communityId, result, variables);
        if (userId && communityId) {
            queryClient.invalidateQueries({
                queryKey: ['quota', userId, communityId],
            });
        } else if (communityId) {
            // Invalidate all quota queries for this community (will refetch for current user)
            queryClient.invalidateQueries({ 
                queryKey: ['quota'], 
                predicate: (query) => {
                    const key = query.queryKey;
                    return key.length >= 3 && key[2] === communityId;
                }
            });
        } else {
            queryClient.invalidateQueries({ queryKey: ['quota'], exact: false });
        }
    }
}

/**
 * Create a mutation hook with standardized patterns
 * Supports both validated and non-validated mutations
 * Avoids deep type instantiation by using any types and avoiding UseMutationOptions
 */
export function createMutation<
    TData = any,
    TVariables = any,
    TError = Error
>(
    config: MutationConfig<TData, TVariables, TError, ZodTypeAny | undefined, ZodTypeAny | undefined>
) {
    return function useMutationHook() {
        const queryClient = useQueryClient();

        // Wrap mutationFn with validation if schemas are provided
        // This allows us to always call the same hook (useMutation)
        const wrappedMutationFn = async (variables: TVariables) => {
            try {
                // Validate input if schema provided
                let validatedInput = variables;
                if (config.inputSchema) {
                    validatedInput = validateData(
                        config.inputSchema,
                        variables,
                        `${config.validationContext || config.errorContext || 'mutation'}.input`
                    ) as TVariables;
                }

                // Execute mutation
                const response = await config.mutationFn(validatedInput);

                // Validate output if schema provided
                if (config.outputSchema) {
                    return validateApiResponse(
                        config.outputSchema,
                        response,
                        `${config.validationContext || config.errorContext || 'mutation'}.output`
                    );
                }

                return response;
            } catch (error) {
                if (error instanceof ValidationError) {
                    console.error('Validation error:', error.zodError, error.context);
                    throw error;
                }
                throw error;
            }
        };

        // Always call the same hook to maintain consistent hook order
        // Validation is applied conditionally in the mutationFn wrapper above
        return useMutation({
            mutationFn: wrappedMutationFn,
            onSuccess: (result: TData, variables: TVariables) => {
                // Apply automatic invalidations
                if (config.invalidations) {
                    applyInvalidations(queryClient, config.invalidations, result, variables);
                }

                // Set query data if configured (for optimistic updates)
                if (config.setQueryData) {
                    queryClient.setQueryData(
                        config.setQueryData.queryKey(result),
                        config.setQueryData.data(result)
                    );
                }

                // Remove query if configured (for delete operations)
                if (config.removeQuery) {
                    queryClient.removeQueries({
                        queryKey: config.removeQuery.queryKey(variables),
                    });
                }

                // Call custom onSuccess if provided
                if (config.onSuccess) {
                    config.onSuccess(result, variables, queryClient);
                }
            },
            onError: (error: TError, variables: TVariables) => {
                // Standard error logging
                const context = config.errorContext || 'Mutation error';
                console.error(`${context}:`, error);

                // Call custom onError if provided
                if (config.onError) {
                    config.onError(error, variables);
                }
            },
        });
    };
}

