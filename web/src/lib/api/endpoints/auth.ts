// Auth API endpoints
import { apiClient } from '../client';
import type { 
  AuthRequest, 
  TelegramAuthRequest, 
  AuthResponse, 
  GetMeResponse 
} from '@/types/api';
import type { User } from '@/types/entities';

export const authApi = {
  /**
   * Get current user information
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<GetMeResponse>('/api/rest/getme');
    return response.data;
  },

  /**
   * Authenticate with Telegram widget
   */
  async authenticateWithTelegram(user: TelegramAuthRequest): Promise<AuthResponse['data']> {
    const response = await apiClient.post<AuthResponse>('/api/rest/telegram-auth', user);
    if (!response.success) {
      throw new Error(response.error || 'Authentication failed');
    }
    return response.data;
  },

  /**
   * Authenticate with Telegram Web App
   */
  async authenticateWithTelegramWebApp(initData: string): Promise<AuthResponse['data']> {
    const response = await apiClient.post<AuthResponse>('/api/rest/telegram-auth/webapp', { initData });
    if (!response.success) {
      throw new Error(response.error || 'Authentication failed');
    }
    return response.data;
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    await apiClient.post('/api/rest/logout');
    apiClient.clearAuthToken();
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ token: string; expiresAt: string }> {
    const response = await apiClient.post<{ token: string; expiresAt: string }>('/api/rest/refresh-token');
    return response;
  },
};