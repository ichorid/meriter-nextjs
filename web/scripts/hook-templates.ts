import type { HookConfig } from '../src/lib/api/hook-configs';

// Import serializeQueryParams for use in generated code
const SERIALIZE_IMPORT = `import { serializeQueryParams } from "@/lib/utils/queryKeys";`;

export interface GeneratedHook {
  name: string;
  code: string;
}

/**
 * Generate a list query hook
 */
export function generateListHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use plural form: communities -> useCommunities, polls -> usePolls
  const hookName = `use${capitalize(resourceName)}${resourceName.endsWith('s') ? '' : 's'}`;
  const queryKeyMethod = config.queryKeys.list ? 'list' : 'lists';
  const apiMethod = config.endpoints.list.method;
  const staleTime = config.staleTime?.list || 2 * 60 * 1000;
  const typeName = capitalize(resourceName.slice(0, -1)); // Remove 's' for type: communities -> Community

  const code = `
export function ${hookName}(params: Record<string, any> = {}) {
    return useQuery({
        queryKey: queryKeys.${resourceName}.${queryKeyMethod}(params),
        queryFn: () => ${config.apiWrapper}.${apiMethod}(params),
        staleTime: ${staleTime},
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate an infinite query hook
 */
export function generateInfiniteHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use plural form: communities -> useInfiniteCommunities
  const hookName = `useInfinite${capitalize(resourceName)}${resourceName.endsWith('s') ? '' : 's'}`;
  const apiMethod = config.endpoints.list.method;
  const staleTime = config.staleTime?.list || 2 * 60 * 1000;
  const hasLists = !!config.queryKeys.lists;

  const queryKeyBase = hasLists 
    ? `...queryKeys.${resourceName}.lists(), "infinite", pageSize`
    : `...queryKeys.${resourceName}.all, "infinite", pageSize`;

  const code = `
export function ${hookName}(pageSize: number = 20) {
    return useInfiniteQuery({
        queryKey: [...queryKeys.${resourceName}.${hasLists ? 'lists()' : 'all'}, "infinite", pageSize],
        queryFn: ({ pageParam = 1 }: { pageParam: number }) => {
            const skip = (pageParam - 1) * pageSize;
            return ${config.apiWrapper}.${apiMethod}({
                skip,
                limit: pageSize,
            });
        },
        getNextPageParam: (lastPage: PaginatedResponse<any>) => {
            if (!lastPage.meta?.pagination?.hasNext) {
                return undefined;
            }
            return (lastPage.meta.pagination.page || 1) + 1;
        },
        initialPageParam: 1,
        staleTime: ${staleTime},
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate a detail query hook
 */
export function generateDetailHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use singular form: communities -> useCommunity, polls -> usePoll
  // Handle special cases: communities -> community (not communitie)
  let singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
  // Fix: communitie -> community, but polls -> poll (correct)
  if (singularName === 'communitie') {
    singularName = 'community';
  }
  const hookName = `use${capitalize(singularName)}`;
  const apiMethod = config.endpoints.detail.method;
  const staleTime = config.staleTime?.detail || 2 * 60 * 1000;
  const useValidation = config.validation?.detail || false;
  const typeName = capitalize(singularName);

  if (useValidation) {
    const code = `
export function ${hookName}(id: string) {
    return useValidatedQuery({
        queryKey: queryKeys.${resourceName}.detail(id),
        queryFn: () => ${config.apiWrapper}.${apiMethod}(id),
        schema: ${typeName}Schema,
        context: \`${hookName}(\${id})\`,
        staleTime: ${staleTime},
        enabled: !!id,
    });
}`;
    return { name: hookName, code: code.trim() };
  }

  const code = `
export function ${hookName}(id: string) {
    return useQuery({
        queryKey: queryKeys.${resourceName}.detail(id),
        queryFn: () => ${config.apiWrapper}.${apiMethod}(id),
        staleTime: ${staleTime},
        enabled: !!id,
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate a create mutation hook
 */
export function generateCreateHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use singular form: communities -> useCreateCommunity
  let singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
  if (singularName === 'communitie') {
    singularName = 'community';
  }
  const hookName = `useCreate${capitalize(singularName)}`;
  const apiMethod = config.endpoints.create.method;
  const invalidateKeys = config.cacheInvalidation.create || [];
  const useValidation = config.validation?.create || false;
  const typeName = capitalize(singularName);

  const invalidateCode = invalidateKeys
    .map(key => {
      const parts = key.split('.');
      if (parts[0] === resourceName) {
        if (parts.length === 2 && parts[1] === 'lists') {
          return `queryKeys.${resourceName}.lists()`;
        }
        if (parts.length === 2 && parts[1] === 'all') {
          return `queryKeys.${resourceName}.all`;
        }
        return `queryKeys.${resourceName}.${parts.slice(1).join('.')}()`;
      }
      return `queryKeys.${parts[0]}.${parts.slice(1).join('.')}()`;
    })
    .map(key => `queryClient.invalidateQueries({ queryKey: ${key} });`)
    .join('\n            ');

  if (useValidation) {
    const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();

    return useValidatedMutation({
        mutationFn: (data: Create${typeName}Dto) =>
            ${config.apiWrapper}.${apiMethod}(data),
        inputSchema: Create${typeName}DtoSchema,
        outputSchema: ${typeName}Schema,
        context: "${hookName}",
        onSuccess: (newItem) => {
            ${invalidateCode ? invalidateCode : ''}
            queryClient.setQueryData(queryKeys.${resourceName}.detail(newItem.id), newItem);
        },
        onError: (error) => {
            console.error("${hookName} error:", error);
        },
    });
}`;
    return { name: hookName, code: code.trim() };
  }

  const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (data: Create${typeName}Dto) =>
            ${config.apiWrapper}.${apiMethod}(data),
        onSuccess: (newItem) => {
            ${invalidateCode ? invalidateCode : ''}
            queryClient.setQueryData(queryKeys.${resourceName}.detail(newItem.id), newItem);
        },
        onError: (error) => {
            console.error("${hookName} error:", error);
        },
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate an update mutation hook
 */
export function generateUpdateHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use singular form: communities -> useUpdateCommunity
  let singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
  if (singularName === 'communitie') {
    singularName = 'community';
  }
  const hookName = `useUpdate${capitalize(singularName)}`;
  const apiMethod = config.endpoints.update.method;
  const invalidateKeys = config.cacheInvalidation.update || [];
  const typeName = capitalize(singularName);

  // Filter out 'detail' from invalidate keys since we already setQueryData
  const invalidateKeysFiltered = invalidateKeys.filter(key => !key.includes('.detail'));
  
  const invalidateCode = invalidateKeysFiltered
    .map(key => {
      const parts = key.split('.');
      if (parts[0] === resourceName) {
        if (parts.length === 2 && parts[1] === 'lists') {
          return `queryKeys.${resourceName}.lists()`;
        }
        if (parts.length === 2 && parts[1] === 'all') {
          return `queryKeys.${resourceName}.all`;
        }
        return `queryKeys.${resourceName}.${parts.slice(1).join('.')}()`;
      }
      return `queryKeys.${parts[0]}.${parts.slice(1).join('.')}()`;
    })
    .map(key => `queryClient.invalidateQueries({ queryKey: ${key} });`)
    .join('\n            ');

  const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<Create${typeName}Dto> }) =>
            ${config.apiWrapper}.${apiMethod}(id, data),
        onSuccess: (updatedItem) => {
            queryClient.setQueryData(queryKeys.${resourceName}.detail(updatedItem.id), updatedItem);
            ${invalidateCode ? invalidateCode : ''}
        },
        onError: (error) => {
            console.error("${hookName} error:", error);
        },
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate a delete mutation hook
 */
export function generateDeleteHook(config: HookConfig, resourceName: string): GeneratedHook {
  // Use singular form: communities -> useDeleteCommunity
  let singularName = resourceName.endsWith('s') ? resourceName.slice(0, -1) : resourceName;
  if (singularName === 'communitie') {
    singularName = 'community';
  }
  const hookName = `useDelete${capitalize(singularName)}`;
  const apiMethod = config.endpoints.delete.method;
  const invalidateKeys = config.cacheInvalidation.delete || [];

  // Filter out invalid keys (detail() without id is invalid)
  const invalidateKeysFiltered = invalidateKeys.filter(key => {
    // Remove detail() without id - we already removeQueries with id
    if (key === `${resourceName}.detail`) {
      return false;
    }
    return true;
  });
  
  const invalidateCode = invalidateKeysFiltered
    .map(key => {
      const parts = key.split('.');
      if (parts[0] === resourceName) {
        if (parts.length === 2 && parts[1] === 'lists') {
          return `queryKeys.${resourceName}.lists()`;
        }
        if (parts.length === 2 && parts[1] === 'all') {
          return `queryKeys.${resourceName}.all`;
        }
        return `queryKeys.${resourceName}.${parts.slice(1).join('.')}()`;
      }
      return `queryKeys.${parts[0]}.${parts.slice(1).join('.')}()`;
    })
    .map(key => `queryClient.invalidateQueries({ queryKey: ${key} });`)
    .join('\n            ');

  const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (id: string) => ${config.apiWrapper}.${apiMethod}(id),
        onSuccess: (_, deletedId) => {
            queryClient.removeQueries({
                queryKey: queryKeys.${resourceName}.detail(deletedId),
            });
            ${invalidateCode ? invalidateCode : ''}
        },
        onError: (error) => {
            console.error("${hookName} error:", error);
        },
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate a custom hook with optimistic updates
 */
export function generateCustomHookWithOptimistic(
  config: HookConfig,
  resourceName: string,
  hookName: string,
  endpoint: HookConfig['endpoints'][string],
  operationName: string
): GeneratedHook {
  // Try to find optimistic config by operation name
  const optimisticConfig = config.optimisticUpdates?.[operationName];
  if (!optimisticConfig) {
    return generateCustomHook(config, resourceName, hookName, endpoint, operationName);
  }

  const apiMethod = endpoint.method;
  const invalidateKeys = config.cacheInvalidation[operationName] || [];
  const helperName = optimisticConfig.helper;
  const communityIdParam = optimisticConfig.communityIdParam || 'communityId';
  const walletAmountParam = optimisticConfig.walletAmountParam || 'data.walletAmount';

  // Build invalidate code with proper query key references
  const invalidateCode = invalidateKeys
    .map(key => {
      const parts = key.split('.');
      if (parts[0] === resourceName) {
        // Same resource
        if (parts.length === 2 && parts[1] === 'lists') {
          return `queryKeys.${resourceName}.lists()`;
        }
        if (parts.length === 2 && parts[1] === 'detail') {
          return `queryKeys.${resourceName}.detail(variables.id)`;
        }
        if (parts.length === 2 && parts[1] === 'results') {
          // Check if results key exists in config
          if (config.queryKeys.results) {
            return `queryKeys.${resourceName}.results(variables.id)`;
          }
          return `[...queryKeys.${resourceName}.all, "results", variables.id]`;
        }
        return `queryKeys.${resourceName}.${parts.slice(1).join('.')}()`;
      }
      // Different resource (e.g., wallet)
      return `queryKeys.${parts[0]}.${parts.slice(1).join('.')}()`;
    })
    .map(key => `queryClient.invalidateQueries({ queryKey: ${key} });`)
    .join('\n            ');

  const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();
    const { user } = useAuth();

    return useMutation({
        mutationFn: ({
            id,
            data,
            ${communityIdParam},
        }: {
            id: string;
            data: any;
            ${communityIdParam}?: string;
        }) =>
            ${config.apiWrapper}.${apiMethod}(id, {
                optionId: data.optionId,
                quotaAmount: data.quotaAmount ?? 0,
                walletAmount: data.walletAmount ?? 0,
            }),
        onMutate: async (variables) => {
            const { data, ${communityIdParam} } = variables || {};
            const shouldOptimistic = !!user?.id && !!${communityIdParam};
            if (!shouldOptimistic) return {} as OptimisticUpdateContext;

            const context: OptimisticUpdateContext = {};

            if (${communityIdParam}) {
                const walletAmount = ${walletAmountParam} || 0;
                const walletUpdate = await ${helperName}(
                    queryClient,
                    ${communityIdParam},
                    Math.abs(walletAmount),
                    queryKeys.wallet
                );
                if (walletUpdate) {
                    context.walletsKey = walletUpdate.walletsKey;
                    context.balanceKey = walletUpdate.balanceKey;
                    context.previousWallets = walletUpdate.previousWallets;
                    context.previousBalance = walletUpdate.previousBalance;
                }
            }

            return context;
        },
        onSuccess: (result, variables) => {
            ${invalidateCode ? invalidateCode : ''}
        },
        onError: (error, variables, context) => {
            console.error("${hookName} error:", error);
            rollbackOptimisticUpdates(queryClient, context);
        },
        onSettled: (_data, _err, vars) => {
            const ${communityIdParam} = vars?.${communityIdParam};
            if (${communityIdParam}) {
                queryClient.invalidateQueries({
                    queryKey: queryKeys.wallet.wallets(),
                });
                queryClient.invalidateQueries({
                    queryKey: queryKeys.wallet.balance(${communityIdParam}),
                });
            }
        },
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate a custom hook without optimistic updates
 */
export function generateCustomHook(
  config: HookConfig,
  resourceName: string,
  hookName: string,
  endpoint: HookConfig['endpoints'][string],
  operationName: string
): GeneratedHook {
  const apiMethod = endpoint.method;
  
  const invalidateKeys = config.cacheInvalidation[operationName] || [];
  const staleTime = config.staleTime?.[operationName] || 2 * 60 * 1000;

  const invalidateCode = invalidateKeys
    .map(key => {
      const parts = key.split('.');
      if (parts[0] === resourceName) {
        if (parts.length === 2 && parts[1] === 'lists') {
          return `queryKeys.${resourceName}.lists()`;
        }
        if (parts.length === 2 && parts[1] === 'detail') {
          return `queryKeys.${resourceName}.detail(variables.id || id)`;
        }
        if (parts.length === 2 && parts[1] === 'results') {
          if (config.queryKeys.results) {
            return `queryKeys.${resourceName}.results(variables.id || id)`;
          }
          return `[...queryKeys.${resourceName}.all, "results", variables.id || id]`;
        }
        return `queryKeys.${resourceName}.${parts.slice(1).join('.')}()`;
      }
      return `queryKeys.${parts[0]}.${parts.slice(1).join('.')}()`;
    })
    .map(key => `queryClient.invalidateQueries({ queryKey: ${key} });`)
    .join('\n            ');

  // Check if it's a query or mutation based on method name
  const isQuery = apiMethod.startsWith('get');

  if (isQuery) {
    // Determine query key method name
    let queryKeyMethod = operationName;
    if (operationName === 'results') {
      queryKeyMethod = 'results';
    } else if (operationName === 'details') {
      queryKeyMethod = 'detail';
    }
    
    // Check if query key method exists in config
    const hasQueryKeyMethod = config.queryKeys[queryKeyMethod] !== undefined;
    const queryKeyCode = hasQueryKeyMethod
      ? `queryKeys.${resourceName}.${queryKeyMethod}(id)`
      : `[...queryKeys.${resourceName}.all, "${queryKeyMethod}", id]`;
    
    const code = `
export function ${hookName}(id: string) {
    return useQuery({
        queryKey: ${queryKeyCode},
        queryFn: () => ${config.apiWrapper}.${apiMethod}(id),
        staleTime: ${staleTime},
        enabled: !!id,
    });
}`;
    return { name: hookName, code: code.trim() };
  }

  const code = `
export function ${hookName}() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (variables: any) => ${config.apiWrapper}.${apiMethod}(variables.id, variables.data, variables.communityId),
        onSuccess: (result, variables) => {
            ${invalidateCode ? invalidateCode : ''}
        },
        onError: (error) => {
            console.error("${hookName} error:", error);
        },
    });
}`;

  return { name: hookName, code: code.trim() };
}

/**
 * Generate query keys export
 */
export function generateQueryKeys(config: HookConfig, resourceName: string): string {
  const keys: string[] = [];
  
  if (config.queryKeys.all) {
    keys.push(`    all: ["${resourceName}"] as const,`);
  }
  if (config.queryKeys.lists) {
    keys.push(`    lists: () => [...queryKeys.${resourceName}.all, "list"] as const,`);
  }
  if (config.queryKeys.list) {
    keys.push(`    list: (params: Record<string, any>) =>`);
    keys.push(`        [...queryKeys.${resourceName}.lists(), serializeQueryParams(params)] as const,`);
  }
  if (config.queryKeys.detail) {
    keys.push(`    details: () => [...queryKeys.${resourceName}.all, "detail"] as const,`);
    keys.push(`    detail: (id: string) => [...queryKeys.${resourceName}.details(), id] as const,`);
  }

  // Add custom query keys
  Object.keys(config.queryKeys).forEach(key => {
    if (!['all', 'lists', 'list', 'detail'].includes(key)) {
      keys.push(`    ${key}: (id: string) => [...queryKeys.${resourceName}.all, "${key}", id] as const,`);
    }
  });

  return keys.join('\n');
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

