/**
 * API v1 REST Client
 *
 * This file provides REST API clients for endpoints that should remain REST:
 * - Authentication endpoints (fake auth, clearCookies) - use REST for unauthenticated flows
 * - OAuth redirects and callbacks - must stay REST (required by OAuth spec)
 * - File uploads - use REST (multipart/form-data)
 * - Runtime config bootstrap (public endpoint)
 *
 * For authenticated endpoints, use tRPC hooks:
 * - `trpc.*.useQuery()` for queries
 * - `trpc.*.useMutation()` for mutations
 * - `trpc.*.useInfiniteQuery()` for infinite queries
 */
import { apiClient } from '../client';
import { handleAuthResponse } from './endpoint-helpers';
import type { AuthResult } from '@/types/api-responses';
import type { RuntimeConfig } from '@/types/runtime-config';

// Auth API with enhanced response handling
export const authApiV1 = {
  async clearCookies(): Promise<void> {
    await apiClient.post('/api/v1/auth/clear-cookies');
  },

  async authenticateFakeUser(): Promise<AuthResult> {
    const response = await apiClient.postRaw<{
      success: boolean;
      data: AuthResult;
      error?: string;
    }>('/api/v1/auth/fake', {});
    return handleAuthResponse<AuthResult>(response);
  },

  async authenticateFakeSuperadmin(): Promise<AuthResult> {
    const response = await apiClient.postRaw<{
      success: boolean;
      data: AuthResult;
      error?: string;
    }>('/api/v1/auth/fake/superadmin', {});
    return handleAuthResponse<AuthResult>(response);
  },
};

// Config API
export const configApiV1 = {
  async getConfig(): Promise<RuntimeConfig> {
    const response = await apiClient.get<{ success: true; data: RuntimeConfig }>(
      '/api/v1/config'
    );
    return response.data;
  },
};
