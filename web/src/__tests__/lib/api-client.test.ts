/**
 * Tests for API Client
 * 
 * Tests the centralized API client including:
 * - HTTP request handling
 * - Error handling
 * - Authentication token management
 * - Response processing
 */

import { apiClient } from '@/lib/api';
import { mockFetch, mockFetchError } from '../utils/test-utils';

describe('API Client', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
  });

  describe('HTTP Methods', () => {
    it('should make GET requests', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      const response = await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(response).toEqual(mockResponse);
    });

    it('should make POST requests', async () => {
      const mockResponse = { data: 'test' };
      const requestData = { name: 'test' };
      mockFetch(mockResponse);

      const response = await apiClient.post('/test', requestData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
      expect(response).toEqual(mockResponse);
    });

    it('should make PUT requests', async () => {
      const mockResponse = { data: 'test' };
      const requestData = { name: 'test' };
      mockFetch(mockResponse);

      const response = await apiClient.put('/test', requestData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
          body: JSON.stringify(requestData),
        })
      );
      expect(response).toEqual(mockResponse);
    });

    it('should make DELETE requests', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      const response = await apiClient.delete('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          method: 'DELETE',
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
          }),
        })
      );
      expect(response).toEqual(mockResponse);
    });
  });

  describe('Authentication', () => {
    it('should include auth token in requests when available', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);
      
      localStorage.setItem('auth_token', 'test-token');

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-token',
          }),
        })
      );
    });

    it('should not include auth token when not available', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.not.objectContaining({
            'Authorization': expect.unknown(String),
          }),
        })
      );
    });

    it('should set auth token', () => {
      apiClient.setAuthToken('new-token');
      expect(localStorage.getItem('auth_token')).toBe('new-token');
    });

    it('should clear auth token', () => {
      localStorage.setItem('auth_token', 'test-token');
      apiClient.clearAuthToken();
      expect(localStorage.getItem('auth_token')).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockFetchError('Network error');

      await expect(apiClient.get('/test')).rejects.toThrow('Network error');
    });

    it('should handle HTTP error responses', async () => {
      const errorResponse = { error: 'Not found' };
      mockFetch(errorResponse, 404);

      await expect(apiClient.get('/test')).rejects.toThrow('HTTP error! status: 404');
    });

    it('should handle JSON parsing errors', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: () => Promise.reject(new Error('Invalid JSON')),
        text: () => Promise.resolve('invalid json'),
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      await expect(apiClient.get('/test')).rejects.toThrow('Invalid JSON');
    });
  });

  describe('Response Processing', () => {
    it('should process successful responses', async () => {
      const mockResponse = { data: 'test', success: true };
      mockFetch(mockResponse);

      const response = await apiClient.get('/test');

      expect(response).toEqual(mockResponse);
    });

    it('should handle empty responses', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        json: () => Promise.resolve(null),
        text: () => Promise.resolve(''),
      };
      
      (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse);

      const response = await apiClient.get('/test');

      expect(response).toBeNull();
    });
  });

  describe('Request Configuration', () => {
    it('should include credentials in requests', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          credentials: 'include',
        })
      );
    });

    it('should include proper headers', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          }),
        })
      );
    });
  });

  describe('Request Body Handling', () => {
    it('should stringify request body for POST requests', async () => {
      const mockResponse = { data: 'test' };
      const requestData = { name: 'test', value: 123 };
      mockFetch(mockResponse);

      await apiClient.post('/test', requestData);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          body: JSON.stringify(requestData),
        })
      );
    });

    it('should not include body for GET requests', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      await apiClient.get('/test');

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          body: undefined,
        })
      );
    });

    it('should handle null request body', async () => {
      const mockResponse = { data: 'test' };
      mockFetch(mockResponse);

      await apiClient.post('/test', null);

      expect(global.fetch).toHaveBeenCalledWith(
        '/test',
        expect.objectContaining({
          body: JSON.stringify(null),
        })
      );
    });
  });
});
