/**
 * Communities API Functions using Orval-generated code
 */
import {
  communitiesControllerGetCommunity,
  communitiesControllerDeleteCommunity,
} from '@/lib/api/generated/communities/communities';
import { customInstance } from '@/lib/api/wrappers/mutator';
import type { Community, PaginatedResponse } from '@/types/api-v1';
import axios from 'axios';
import { config } from '@/config';

export const communitiesApi = {
  getList: async (params?: { skip?: number; limit?: number }): Promise<PaginatedResponse<Community>> => {
    // Use customInstance directly to get full response with meta
    const queryParams: any = {};
    if (params?.skip !== undefined) queryParams.skip = params.skip.toString();
    if (params?.limit !== undefined) queryParams.limit = params.limit.toString();
    
    // Calculate page from skip/limit for API
    const page = params?.skip && params?.limit ? Math.floor(params.skip / params.limit) + 1 : 1;
    queryParams.page = page.toString();
    
    const response = await axios.get(`${config.api.baseUrl}/api/v1/communities`, {
      params: queryParams,
      withCredentials: true,
    });
    
    // Handle API response format
    // The interceptor wraps it as: { success: true, data: { data: T[], pagination: {...} }, meta: { timestamp } }
    // Or: { success: true, data: T[], meta: { pagination: {...}, timestamp } }
    const responseData = response.data;
    let data: Community[] = [];
    let pagination: any = null;
    
    if (responseData && typeof responseData === 'object' && 'success' in responseData) {
      const wrapped = responseData as { success: boolean; data: any; meta?: any };
      if (wrapped.success) {
        // Check if data has pagination structure
        if (wrapped.data && typeof wrapped.data === 'object' && 'pagination' in wrapped.data) {
          data = wrapped.data.data || wrapped.data;
          pagination = wrapped.data.pagination;
        } else if (wrapped.meta?.pagination) {
          data = Array.isArray(wrapped.data) ? wrapped.data : [];
          pagination = wrapped.meta.pagination;
        } else {
          // Fallback: assume data is the array
          data = Array.isArray(wrapped.data) ? wrapped.data : [];
        }
      }
    } else if (Array.isArray(responseData)) {
      data = responseData;
    }
    
    // Transform to frontend format
    if (pagination) {
      const pageNum = pagination.page || page;
      const pageSize = pagination.limit || params?.limit || 20;
      const total = pagination.total || data.length;
      const totalPages = Math.ceil(total / pageSize);
      
      return {
        data,
        meta: {
          pagination: {
            page: pageNum,
            pageSize,
            total,
            totalPages,
            hasNext: pagination.hasMore || false,
            hasPrev: pageNum > 1,
          },
          timestamp: new Date().toISOString(),
          requestId: `req-${Date.now()}`,
        },
      };
    }
    
    // Fallback: return with default pagination
    return {
      data,
      meta: {
        pagination: {
          page: 1,
          pageSize: data.length,
          total: data.length,
          totalPages: 1,
          hasNext: false,
          hasPrev: false,
        },
        timestamp: new Date().toISOString(),
        requestId: `req-${Date.now()}`,
      },
    };
  },
  
  getById: async (id: string): Promise<Community> => {
    return communitiesControllerGetCommunity(id) as Promise<Community>;
  },
  
  create: async (data: any): Promise<Community> => {
    return customInstance<Community>({ url: '/api/v1/communities', method: 'POST', data });
  },
  
  update: async (id: string, data: any): Promise<Community> => {
    return customInstance<Community>({ url: `/api/v1/communities/${id}`, method: 'PUT', data });
  },
  
  delete: async (id: string): Promise<void> => {
    return communitiesControllerDeleteCommunity(id) as Promise<void>;
  },
  
  getPublications: async (id: string, params: any): Promise<PaginatedResponse<any>> => {
    return customInstance({ 
      url: `/api/v1/communities/${id}/publications`, 
      method: 'GET',
      params 
    });
  },
};


