/**
 * Tests for useCanVote hook
 * 
 * Tests voting permission logic including:
 * - Team community restrictions
 * - Marathon/vision community restrictions
 * - Role-based restrictions
 * - Self-voting restrictions
 */

import React from 'react';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCanVote } from '@/hooks/useCanVote';
import { useAuth } from '@/contexts/AuthContext';
import { useUserRoles } from '@/hooks/api/useProfile';
import { useCommunity } from '@/hooks/api';

// Mock dependencies
jest.mock('@/contexts/AuthContext');
jest.mock('@/hooks/api/useProfile');
jest.mock('@/hooks/api');

const mockUseAuth = useAuth as jest.MockedFunction<typeof useAuth>;
const mockUseUserRoles = useUserRoles as jest.MockedFunction<typeof useUserRoles>;
const mockUseCommunity = useCommunity as jest.MockedFunction<typeof useCommunity>;

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

describe('useCanVote Hook', () => {
  const mockCommunity = {
    id: 'community-123',
    name: 'Test Community',
    typeTag: 'custom',
    adminIds: [],
    votingRules: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    },
  };

  const mockTeamCommunity = {
    id: 'team-community-123',
    name: 'Team Community',
    typeTag: 'team',
    adminIds: [],
    votingRules: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    },
  };

  const mockMarathonCommunity = {
    id: 'marathon-community-123',
    name: 'Marathon of Good',
    typeTag: 'marathon-of-good',
    adminIds: [],
    votingRules: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    },
  };

  const mockFutureVisionCommunity = {
    id: 'future-vision-community-123',
    name: 'Future Vision',
    typeTag: 'future-vision',
    adminIds: [],
    votingRules: {
      allowedRoles: ['superadmin', 'lead', 'participant', 'viewer'],
      canVoteForOwnPosts: false,
      participantsCannotVoteForLead: false,
      spendsMerits: true,
      awardsMerits: true,
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    mockUseAuth.mockReturnValue({
      user: { id: 'user-123', globalRole: undefined },
      isLoading: false,
      isAuthenticated: true,
      authenticateWithTelegram: jest.fn(),
      authenticateWithTelegramWebApp: jest.fn(),
      logout: jest.fn(),
      handleDeepLink: jest.fn(),
      authError: null,
      setAuthError: jest.fn(),
    } as any);

    mockUseUserRoles.mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as any);

    mockUseCommunity.mockReturnValue({
      data: mockCommunity,
      isLoading: false,
      error: null,
    } as any);
  });

  describe('Basic Permissions', () => {
    it('should return false when user is not authenticated', () => {
      mockUseAuth.mockReturnValue({
        user: null,
        isLoading: false,
        isAuthenticated: false,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });

    it('should return false for project posts', () => {
      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'author-123', false, false, false, true),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });

    it('should return false when user is beneficiary', () => {
      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'author-123', false, true, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });

    it('should return false when user is author and no beneficiary', () => {
      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });
  });

  describe('Superadmin Permissions', () => {
    it('should allow superadmin to vote', () => {
      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', globalRole: 'superadmin' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(true);
    });
  });

  describe('Team Community Restrictions', () => {
    it('should not allow voting for own post in team community', () => {
      mockUseCommunity.mockReturnValue({
        data: mockTeamCommunity,
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'team-community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });

    it('should allow voting for other posts in team community (backend validates team membership)', () => {
      mockUseCommunity.mockReturnValue({
        data: mockTeamCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'team-community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'team-community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      // Frontend allows it, backend will validate team membership
      expect(result.current).toBe(true);
    });
  });

  describe('Marathon/Vision Community Restrictions', () => {
    it('should allow participant voting attempt in marathon community (backend validates)', () => {
      mockUseCommunity.mockReturnValue({
        data: mockMarathonCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'marathon-community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'marathon-community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      // Frontend allows it, backend will validate restrictions
      expect(result.current).toBe(true);
    });
  });

  describe('Role-based Restrictions', () => {
    it('should return false when role is not in allowedRoles', () => {
      const restrictedCommunity = {
        ...mockCommunity,
        votingRules: {
          ...mockCommunity.votingRules,
          allowedRoles: ['superadmin', 'lead'], // participant not allowed
        },
      };

      mockUseCommunity.mockReturnValue({
        data: restrictedCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      expect(result.current).toBe(false);
    });

    it('should allow participants to vote in marathon-of-good even when not in allowedRoles', () => {
      const restrictedMarathonCommunity = {
        ...mockMarathonCommunity,
        votingRules: {
          ...mockMarathonCommunity.votingRules,
          allowedRoles: ['superadmin', 'lead'], // participant not in allowedRoles
        },
      };

      mockUseCommunity.mockReturnValue({
        data: restrictedMarathonCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'marathon-community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'marathon-community-123', 'author-123', false, false, false, false),
        { wrapper: createWrapper() }
      );

      // Participants should be able to vote in marathon-of-good regardless of allowedRoles
      expect(result.current).toBe(true);
    });
  });

  describe('Future Vision Self-Voting', () => {
    it('should allow participant to self-vote in future-vision group', () => {
      mockUseCommunity.mockReturnValue({
        data: mockFutureVisionCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'future-vision-community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'future-vision-community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      // Participants can self-vote in future-vision group
      expect(result.current).toBe(true);
    });

    it('should allow lead to self-vote in future-vision group', () => {
      mockUseCommunity.mockReturnValue({
        data: mockFutureVisionCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'future-vision-community-123', role: 'lead' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'future-vision-community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      // Leads can self-vote in future-vision group
      expect(result.current).toBe(true);
    });

    it('should allow superadmin to self-vote in future-vision group', () => {
      mockUseCommunity.mockReturnValue({
        data: mockFutureVisionCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseAuth.mockReturnValue({
        user: { id: 'user-123', globalRole: 'superadmin' },
        isLoading: false,
        isAuthenticated: true,
        authenticateWithTelegram: jest.fn(),
        authenticateWithTelegramWebApp: jest.fn(),
        logout: jest.fn(),
        handleDeepLink: jest.fn(),
        authError: null,
        setAuthError: jest.fn(),
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'future-vision-community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      // Superadmins can self-vote in future-vision group
      expect(result.current).toBe(true);
    });

    it('should NOT allow viewer to self-vote in future-vision group', () => {
      mockUseCommunity.mockReturnValue({
        data: mockFutureVisionCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'future-vision-community-123', role: 'viewer' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'future-vision-community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      // Viewers cannot self-vote in future-vision group
      expect(result.current).toBe(false);
    });

    it('should NOT allow self-voting in other community types', () => {
      mockUseCommunity.mockReturnValue({
        data: mockCommunity,
        isLoading: false,
        error: null,
      } as any);

      mockUseUserRoles.mockReturnValue({
        data: [{ communityId: 'community-123', role: 'participant' }],
        isLoading: false,
        error: null,
      } as any);

      const { result } = renderHook(
        () => useCanVote('pub-123', 'publication', 'community-123', 'user-123', true, false, false, false),
        { wrapper: createWrapper() }
      );

      // Self-voting is not allowed in regular communities
      expect(result.current).toBe(false);
    });
  });
});

