export { communitiesHookConfig } from './communities.config';
export { pollsHookConfig } from './polls.config';
export { commentsHookConfig } from './comments.config';
export { publicationsHookConfig } from './publications.config';

export type HookConfig = {
  resourceName: string;
  apiWrapper: string;
  queryKeys: {
    all: () => readonly unknown[];
    lists?: () => readonly unknown[];
    list?: (params: any) => readonly unknown[];
    detail: (id: string) => readonly unknown[];
    [key: string]: ((...args: any[]) => readonly unknown[]) | undefined;
  };
  cacheInvalidation: {
    [operation: string]: string[];
  };
  optimisticUpdates?: {
    [operation: string]: {
      type: string;
      helper: string;
      communityIdParam?: string;
      walletAmountParam?: string;
    };
  };
  staleTime?: {
    [hookType: string]: number;
  };
  endpoints: {
    [operation: string]: {
      method: string;
      params: string[];
      custom?: boolean;
    };
  };
  customHooks?: {
    [hookName: string]: {
      skip?: boolean;
    };
  };
  validation?: {
    [hookType: string]: boolean;
  };
};

