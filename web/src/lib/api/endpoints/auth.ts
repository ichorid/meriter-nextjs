// Auth API endpoints
import { apiClient } from '../client';
import type { 
  AuthRequest, 
  TelegramAuthRequest, 
  AuthResponse, 
  GetMeResponse 
} from '@/types/api';
import type { User } from '@/types/entities';

// Actual server response type (different from expected AuthResponse)
interface TelegramAuthServerResponse {
  success: boolean;
  user?: User;
  token?: string;
  hasPendingCommunities?: boolean;
  error?: string;
}

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
    try {
      console.log('🔐 Auth API: Starting Telegram authentication with user:', user);
      const response = await apiClient.postRaw<TelegramAuthServerResponse>('/api/rest/telegram-auth', user);
      console.log('🔐 Auth API: Raw response received:', response);
      console.log('🔐 Auth API: Response data:', response.data);
      
      if (!response.data) {
        throw new Error('No response data received from server');
      }
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Authentication failed');
      }
      
      // Handle the actual response structure: { success: true, user: {...} }
      // We need to construct the expected AuthResponse['data'] structure
      if (!response.data.user) {
        throw new Error('No user data received from server');
      }
      
      const authData = {
        user: response.data.user,
        token: response.data.token || '', // The server might not be returning a token
        hasPendingCommunities: response.data.hasPendingCommunities || false
      };
      
      console.log('🔐 Auth API: Constructed auth data:', authData);
      
      console.log('🔐 Auth API: Authentication successful, returning data:', authData);
      return authData;
    } catch (error) {
      console.error('🔐 Auth API: Authentication error:', error);
      throw error;
    }
  },

  /**
   * Authenticate with Telegram Web App
   */
  async authenticateWithTelegramWebApp(initData: string): Promise<AuthResponse['data']> {
    try {
      console.log('🔐 Auth API: Starting Telegram Web App authentication with initData:', initData);
      const response = await apiClient.postRaw<TelegramAuthServerResponse>('/api/rest/telegram-auth/webapp', { initData });
      console.log('🔐 Auth API: Raw response received:', response);
      console.log('🔐 Auth API: Response data:', response.data);
      
      if (!response.data) {
        throw new Error('No response data received from server');
      }
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Authentication failed');
      }
      
      // Handle the actual response structure: { success: true, user: {...} }
      // We need to construct the expected AuthResponse['data'] structure
      if (!response.data.user) {
        throw new Error('No user data received from server');
      }
      
      const authData = {
        user: response.data.user,
        token: response.data.token || '', // The server might not be returning a token
        hasPendingCommunities: response.data.hasPendingCommunities || false
      };
      
      console.log('🔐 Auth API: Constructed auth data:', authData);
      
      console.log('🔐 Auth API: Authentication successful, returning data:', authData);
      return authData;
    } catch (error) {
      console.error('🔐 Auth API: Authentication error:', error);
      throw error;
    }
  },

  /**
   * Logout user
   */
  async logout(): Promise<void> {
    try {
      console.log('🔐 Auth API: Starting logout...');
      await apiClient.post('/api/rest/telegram-auth/logout');
      console.log('🔐 Auth API: Logout API call successful');
      apiClient.clearAuthToken();
      console.log('🔐 Auth API: Auth token cleared');
    } catch (error) {
      console.error('🔐 Auth API: Logout API call failed:', error);
      // Still clear the auth token even if the API call fails
      apiClient.clearAuthToken();
      console.log('🔐 Auth API: Auth token cleared despite API error');
      throw error;
    }
  },

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ token: string; expiresAt: string }> {
    const response = await apiClient.post<{ token: string; expiresAt: string }>('/api/rest/refresh-token');
    return response;
  },
};