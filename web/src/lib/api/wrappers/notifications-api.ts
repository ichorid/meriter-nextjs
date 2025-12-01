/**
 * Notifications API Functions using Orval-generated code
 */
import { customInstance } from '@/lib/api/wrappers/mutator';

export const notificationsApi = {
  getNotifications: async (params?: any): Promise<any> => {
    return customInstance({ url: '/api/v1/notifications', method: 'GET', params });
  },
  
  getPreferences: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/notifications/preferences', method: 'GET' });
  },
  
  markAsRead: async (id: string): Promise<any> => {
    return customInstance({ url: `/api/v1/notifications/${id}/read`, method: 'POST' });
  },
  
  markAllAsRead: async (): Promise<any> => {
    return customInstance({ url: '/api/v1/notifications/read-all', method: 'POST' });
  },
  
  deleteNotification: async (id: string): Promise<void> => {
    return customInstance({ url: `/api/v1/notifications/${id}`, method: 'DELETE' });
  },
  
  updatePreferences: async (preferences: any): Promise<any> => {
    return customInstance({ url: '/api/v1/notifications/preferences', method: 'PUT', data: preferences });
  },
};

