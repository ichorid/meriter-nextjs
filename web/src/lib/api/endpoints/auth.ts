// Auth API endpoints
import { apiClient } from '../client';
import type { 
  AuthRequest, 
  TelegramAuthRequest,
  AuthResponse,
  GetMeResponse
} from '@/types/api-v1';
import type { User } from '@meriter/shared-types';

// Actual server response type (different from expected AuthResponse)
interface TelegramAuthServerResponse {
  success: boolean;
  data: {
    user: User;
    hasPendingCommunities: boolean;
  };
  error?: string;
}

export const authApi = {
  /**
   * Get current user information
   */
  async getMe(): Promise<User> {
    const response = await apiClient.get<User>('/api/v1/auth/me');
    return response;
  },

  /**
   * Authenticate with Telegram widget
   */
  async authenticateWithTelegram(user: TelegramAuthRequest): Promise<{ user: User; hasPendingCommunities: boolean }> {
    try {
      console.log('🔐 Auth API: Starting Telegram authentication with user:', user);
      const response = await apiClient.postRaw<TelegramAuthServerResponse>('/api/v1/auth/telegram/widget', user);
      console.log('🔐 Auth API: Raw response received:', response);
      console.log('🔐 Auth API: Response data:', response.data);
      
      if (!response.data) {
        throw new Error('No response data received from server');
      }
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Authentication failed');
      }
      
      // Handle the actual response structure: { success: true, data: { user: {...}, hasPendingCommunities: ... } }
      if (!response.data.data) {
        throw new Error('No data received from server');
      }
      
      const authData = {
        user: response.data.data.user,
        hasPendingCommunities: response.data.data.hasPendingCommunities || false
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
  async authenticateWithTelegramWebApp(initData: string): Promise<{ user: User; hasPendingCommunities: boolean }> {
    try {
      console.log('🔐 Auth API: Starting Telegram Web App authentication with initData:', initData);
      const response = await apiClient.postRaw<TelegramAuthServerResponse>('/api/v1/auth/telegram/webapp', { initData });
      console.log('🔐 Auth API: Raw response received:', response);
      console.log('🔐 Auth API: Response data:', response.data);
      
      if (!response.data) {
        throw new Error('No response data received from server');
      }
      
      if (!response.data.success) {
        throw new Error(response.data.error || 'Authentication failed');
      }
      
      // Handle the actual response structure: { success: true, data: { user: {...}, hasPendingCommunities: ... } }
      if (!response.data.data) {
        throw new Error('No data received from server');
      }
      
      const authData = {
        user: response.data.data.user,
        hasPendingCommunities: response.data.data.hasPendingCommunities || false
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
      await apiClient.post('/api/v1/auth/logout');
      console.log('🔐 Auth API: Logout API call successful');
    } catch (error) {
      console.error('🔐 Auth API: Logout API call failed:', error);
      throw error;
    }
  },
};