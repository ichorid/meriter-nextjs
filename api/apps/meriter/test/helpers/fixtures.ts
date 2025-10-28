import { uid } from 'uid';
import { CreateUserDto, CreateCommunityDto, CreatePublicationDto, CreateCommentDto, CreateVoteDto, CreatePollDto } from '../../../../../../libs/shared-types/dist/index';

/**
 * Create test user fixtures
 */
export function createTestUser(overrides: Partial<CreateUserDto> = {}): CreateUserDto {
  return {
    telegramId: uid(),
    username: `testuser_${uid()}`,
    firstName: 'Test',
    lastName: 'User',
    displayName: 'Test User',
    avatarUrl: `https://example.com/avatar/${uid()}.jpg`,
    bio: 'Test bio',
    location: 'Test Location',
    website: 'https://example.com',
    isVerified: false,
    ...overrides,
  };
}

/**
 * Create test community fixtures
 */
export function createTestCommunity(overrides: Partial<CreateCommunityDto> = {}): CreateCommunityDto {
  return {
    telegramChatId: `-100${Math.floor(Math.random() * 1000000000)}`,
    name: `Test Community ${uid()}`,
    description: 'A test community',
    avatarUrl: `https://example.com/community/${uid()}.jpg`,
    administrators: [],
    members: [],
    hashtags: ['test', 'example'],
    hashtagDescriptions: {
      test: 'Test hashtag',
      example: 'Example hashtag',
    },
    settings: {
      iconUrl: `https://example.com/icon/${uid()}.jpg`,
      currencyNames: {
        singular: 'merit',
        plural: 'merits',
        genitive: 'merits',
      },
      dailyEmission: 10,
    },
    isActive: true,
    ...overrides,
  };
}

/**
 * Create test publication fixtures
 */
export function createTestPublication(communityId: string, authorId: string, overrides: Partial<CreatePublicationDto> = {}): CreatePublicationDto {
  return {
    communityId,
    authorId,
    content: `Test publication content ${uid()}`,
    type: 'text',
    hashtags: ['test'],
    ...overrides,
  };
}

/**
 * Create test comment fixtures
 */
export function createTestComment(targetType: 'publication' | 'comment', targetId: string, content?: string): CreateCommentDto {
  return {
    targetType,
    targetId,
    content: content || `Test comment ${uid()}`,
  };
}

/**
 * Create test vote fixtures
 */
export function createTestVote(targetType: 'publication' | 'comment', targetId: string, amount: number, sourceType: 'personal' | 'quota' = 'personal'): CreateVoteDto {
  return {
    targetType,
    targetId,
    amount,
    sourceType,
  };
}

/**
 * Create test poll fixtures
 */
export function createTestPoll(communityId: string, overrides: Partial<CreatePollDto> = {}): CreatePollDto {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7); // Expires in 7 days
  
  return {
    communityId,
    question: `Test poll question ${uid()}`,
    description: 'A test poll',
    options: [
      { text: 'Option 1' },
      { text: 'Option 2' },
      { text: 'Option 3' },
    ],
    expiresAt: expiresAt.toISOString(),
    ...overrides,
  };
}

/**
 * Generate test JWT token payload
 */
export function createTestJWTPayload(uid: string, telegramId: string, tags: string[] = []): any {
  return {
    uid,
    telegramId,
    tags,
  };
}

