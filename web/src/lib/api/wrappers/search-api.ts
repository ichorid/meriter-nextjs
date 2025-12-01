/**
 * Search API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';

export const searchApi = {
  search: async (params?: any): Promise<any> => {
    return customInstance({ url: '/api/v1/search', method: 'GET', params });
  },
};

