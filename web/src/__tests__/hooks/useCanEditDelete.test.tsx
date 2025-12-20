/**
 * Tests for useCanEditDelete hook
 * 
 * Tests edit/delete permissions including:
 * - Author permissions with/without votes and comments
 * - Superadmin permissions (always allowed)
 * - Lead permissions (always allowed in their community)
 * - Frozen state (votes or comments prevent edit/delete for authors)
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCanEditDelete } from '@/hooks/useCanEditDelete';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api/useCommunities';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/api/useProfile');
jest.mock('@/hooks/api/useCommunities');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseUserRoles = useUserRoles as jest.MockedFunction<typeof useUserRoles>;
const mockUseCommunity = useCommunity as jest.MockedFunction<typeof useCommunity>;

// Test wrapper
function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}

describe('useCanEditDelete', () => {
  const authorId = 'author-123';
  const communityId = 'community-123';
  const createdAt = new Date().toISOString();

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mocks
    mockUseAuth.mockReturnValue({
      user: { id: authorId, globalRole: undefined },
      isLoading: false,
      isAuthenticated: true,
      authenticateWithTelegram: jest.fn(),
      authenticateWithTelegramWebApp: jest.fn(),
      authenticateFakeUser: jest.fn(),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    });

    mockUseUserRoles.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    });

    mockUseCommunity.mockReturnValue({
      data: {
        id: communityId,
        settings: { editWindowDays: 7 },
      },
      isLoading: false,
      error: null,
    });
  });

  describe('Author permissions', () => {
    it('should allow edit and delete when no votes and no comments', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
      expect(result.current.isAuthor).toBe(true);
    });

    it('should disable edit and delete when votes exist', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, true, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true); // Button still shows
      expect(result.current.canEditEnabled).toBe(false); // But disabled
      expect(result.current.canDelete).toBe(true); // Button still shows
      expect(result.current.canDeleteEnabled).toBe(false); // But disabled
    });

    it('should disable edit and delete when comments exist', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, createdAt, true),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true); // Button still shows
      expect(result.current.canEditEnabled).toBe(false); // But disabled
      expect(result.current.canDelete).toBe(true); // Button still shows
      expect(result.current.canDeleteEnabled).toBe(false); // But disabled
    });

    it('should disable edit and delete when both votes and comments exist', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, true, createdAt, true),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true); // Button still shows
      expect(result.current.canEditEnabled).toBe(false); // But disabled
      expect(result.current.canDelete).toBe(true); // Button still shows
      expect(result.current.canDeleteEnabled).toBe(false); // But disabled
    });

    it('should disable edit when edit window expires', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8); // 8 days ago (outside 7-day window)

      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, oldDate.toISOString(), false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true); // Button still shows
      expect(result.current.canEditEnabled).toBe(false); // But disabled
      expect(result.current.canDelete).toBe(true); // Delete not affected by time window
      expect(result.current.canDeleteEnabled).toBe(true);
    });
  });

  describe('Superadmin permissions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'superadmin-123', globalRole: 'superadmin' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });
    });

    it('should always allow edit and delete even with votes', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, true, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });

    it('should always allow edit and delete even with comments', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, createdAt, true),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });

    it('should always allow edit and delete even after edit window expires', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 8);

      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, true, oldDate.toISOString(), true),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
    });
  });

  describe('Lead permissions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'lead-123', globalRole: undefined },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });

      mockUseUserRoles.mockReturnValue({
        data: [{ role: 'lead', communityId }],
        isLoading: false,
        error: null,
      });
    });

    it('should always allow edit and delete in their community even with votes', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, true, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
      expect(result.current.isAdmin).toBe(true);
    });

    it('should always allow edit and delete in their community even with comments', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, createdAt, true),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(true);
      expect(result.current.canEditEnabled).toBe(true);
      expect(result.current.canDelete).toBe(true);
      expect(result.current.canDeleteEnabled).toBe(true);
    });

    it('should NOT allow edit/delete in different community', () => {
      const otherCommunityId = 'other-community-123';
      mockUseUserRoles.mockReturnValue({
        data: [{ role: 'lead', communityId }], // Lead in different community
        isLoading: false,
        error: null,
      });

      const { result } = renderHook(
        () => useCanEditDelete(authorId, otherCommunityId, false, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.isAdmin).toBe(false);
    });
  });

  describe('Other user permissions', () => {
    beforeEach(() => {
      mockUseAuth.mockReturnValue({
        user: { id: 'other-user-123', globalRole: undefined },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        authenticateFakeUser: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      });
    });

    it('should NOT allow edit or delete for other users posts', () => {
      const { result } = renderHook(
        () => useCanEditDelete(authorId, communityId, false, createdAt, false),
        { wrapper: createWrapper() }
      );

      expect(result.current.canEdit).toBe(false);
      expect(result.current.canDelete).toBe(false);
      expect(result.current.isAuthor).toBe(false);
    });
  });
});

