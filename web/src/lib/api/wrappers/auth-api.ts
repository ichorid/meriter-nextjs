/**
 * Auth API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';

export const authApi = {
  login: async (data: any): Promise<any> => {
    return customInstance({ url: '/api/v1/auth/telegram/widget', method: 'POST', data });
  },
  
  loginWebApp: async (data: any): Promise<any> => {
    return customInstance({ url: '/api/v1/auth/telegram/webapp', method: 'POST', data });
  },
  
  logout: async (): Promise<void> => {
    return customInstance({ url: '/api/v1/auth/logout', method: 'POST' });
  },
  
  getMe: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/auth/me', method: 'GET' });
  },
  
  authenticateFakeUser: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/auth/fake', method: 'POST' });
  },
};


