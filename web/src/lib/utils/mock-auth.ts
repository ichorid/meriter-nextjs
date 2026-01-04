/**
 * Mock Authentication Utilities for Test Auth Mode
 * 
 * Provides mock implementations of all authentication methods
 * that work locally without requiring real OAuth providers or SMS/Email services
 * 
 * In test auth mode, these functions create real users in the database
 * via the backend API, but bypass the actual OAuth/SMS/Email flows
 */

import type { User } from '@/types/api-v1';
import { config } from '@/config';

export interface MockAuthResult {
  user: User;
  isNewUser: boolean;
  jwt: string;
}

/**
 * Generate a mock user based on provider and identifier
 */
function generateMockUser(
  provider: string,
  identifier: string,
  displayName?: string,
  isSuperadmin: boolean = false
): User {
  const timestamp = Date.now();
  const userId = `mock_${provider}_${identifier.replace(/[^a-zA-Z0-9]/g, '_')}_${timestamp}`;
  const username = identifier.split('@')[0] || identifier.replace(/[^a-zA-Z0-9]/g, '_');

  return {
    id: userId,
    username: `${username}_${Math.floor(Math.random() * 1000)}`,
    displayName: displayName || identifier,
    firstName: displayName?.split(' ')[0] || username,
    lastName: displayName?.split(' ').slice(1).join(' ') || '',
    avatarUrl: undefined,
    authProvider: provider as any,
    authId: identifier,
    globalRole: isSuperadmin ? 'superadmin' : 'participant',
    communityTags: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a mock JWT token
 */
function generateMockJWT(userId: string, provider: string, identifier: string): string {
  // In test mode, we don't need a real JWT - just return a mock token
  // The backend will accept this in test auth mode
  return `mock_jwt_${userId}_${provider}_${Date.now()}`;
}

/**
 * Mock OAuth authentication
 * Creates a real user via the backend API in test auth mode
 */
export async function mockOAuthAuth(
  provider: string,
  identifier?: string
): Promise<MockAuthResult> {
  const mockIdentifier = identifier || `mock_${provider}_user@example.com`;
  const mockDisplayName = identifier 
    ? identifier.split('@')[0] 
    : `${provider.charAt(0).toUpperCase() + provider.slice(1)} User`;

  // In test auth mode, create user via backend API
  // The backend will handle user creation and return a real JWT
  try {
    const response = await fetch(`${config.api.baseUrl}/api/v1/auth/mock/${provider}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: mockIdentifier, displayName: mockDisplayName }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create mock user');
    }

    const data = await response.json();
    
    // Extract JWT from Set-Cookie header or response
    const setCookieHeader = response.headers.get('Set-Cookie');
    let jwt = data.jwt;
    if (!jwt && setCookieHeader) {
      const jwtMatch = setCookieHeader.match(/jwt=([^;]+)/);
      if (jwtMatch) {
        jwt = jwtMatch[1];
      }
    }

    return {
      user: data.user,
      isNewUser: data.isNewUser || false,
      jwt: jwt || generateMockJWT(data.user.id, provider, mockIdentifier),
    };
  } catch (error) {
    // Fallback to local mock if API call fails
    console.warn('Mock auth API call failed, using local mock:', error);
    const user = generateMockUser(provider, mockIdentifier, mockDisplayName);
    const jwt = generateMockJWT(user.id, provider, mockIdentifier);
    return {
      user,
      isNewUser: Math.random() > 0.5,
      jwt,
    };
  }
}

/**
 * Mock SMS authentication
 * Creates a real user via the backend API in test auth mode
 */
export async function mockSmsAuth(phoneNumber: string): Promise<MockAuthResult> {
  try {
    const response = await fetch(`${config.api.baseUrl}/api/v1/auth/mock/sms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create mock SMS user');
    }

    const data = await response.json();
    const setCookieHeader = response.headers.get('Set-Cookie');
    let jwt = data.jwt;
    if (!jwt && setCookieHeader) {
      const jwtMatch = setCookieHeader.match(/jwt=([^;]+)/);
      if (jwtMatch) jwt = jwtMatch[1];
    }

    return {
      user: data.user,
      isNewUser: data.isNewUser || false,
      jwt: jwt || generateMockJWT(data.user.id, 'sms', phoneNumber),
    };
  } catch (error) {
    console.warn('Mock SMS auth API call failed, using local mock:', error);
    const user = generateMockUser('sms', phoneNumber, `User ${phoneNumber.slice(-4)}`);
    const jwt = generateMockJWT(user.id, 'sms', phoneNumber);
    return {
      user,
      isNewUser: Math.random() > 0.5,
      jwt,
    };
  }
}

/**
 * Mock Email authentication
 * Creates a real user via the backend API in test auth mode
 */
export async function mockEmailAuth(email: string): Promise<MockAuthResult> {
  try {
    const response = await fetch(`${config.api.baseUrl}/api/v1/auth/mock/email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create mock email user');
    }

    const data = await response.json();
    const setCookieHeader = response.headers.get('Set-Cookie');
    let jwt = data.jwt;
    if (!jwt && setCookieHeader) {
      const jwtMatch = setCookieHeader.match(/jwt=([^;]+)/);
      if (jwtMatch) jwt = jwtMatch[1];
    }

    return {
      user: data.user,
      isNewUser: data.isNewUser || false,
      jwt: jwt || generateMockJWT(data.user.id, 'email', email),
    };
  } catch (error) {
    console.warn('Mock email auth API call failed, using local mock:', error);
    const displayName = email.split('@')[0];
    const user = generateMockUser('email', email, displayName);
    const jwt = generateMockJWT(user.id, 'email', email);
    return {
      user,
      isNewUser: Math.random() > 0.5,
      jwt,
    };
  }
}

/**
 * Mock Phone/Call authentication
 * Creates a real user via the backend API in test auth mode
 */
export async function mockPhoneAuth(phoneNumber: string): Promise<MockAuthResult> {
  try {
    const response = await fetch(`${config.api.baseUrl}/api/v1/auth/mock/phone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phoneNumber }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create mock phone user');
    }

    const data = await response.json();
    const setCookieHeader = response.headers.get('Set-Cookie');
    let jwt = data.jwt;
    if (!jwt && setCookieHeader) {
      const jwtMatch = setCookieHeader.match(/jwt=([^;]+)/);
      if (jwtMatch) jwt = jwtMatch[1];
    }

    return {
      user: data.user,
      isNewUser: data.isNewUser || false,
      jwt: jwt || generateMockJWT(data.user.id, 'phone', phoneNumber),
    };
  } catch (error) {
    console.warn('Mock phone auth API call failed, using local mock:', error);
    const user = generateMockUser('phone', phoneNumber, `User ${phoneNumber.slice(-4)}`);
    const jwt = generateMockJWT(user.id, 'phone', phoneNumber);
    return {
      user,
      isNewUser: Math.random() > 0.5,
      jwt,
    };
  }
}

/**
 * Mock Passkey authentication
 * Creates a real user via the backend API in test auth mode
 */
export async function mockPasskeyAuth(credentialId?: string): Promise<MockAuthResult> {
  try {
    const mockId = credentialId || `passkey_${Date.now()}`;
    const response = await fetch(`${config.api.baseUrl}/api/v1/auth/mock/passkey`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credentialId: mockId }),
      credentials: 'include',
    });

    if (!response.ok) {
      throw new Error('Failed to create mock passkey user');
    }

    const data = await response.json();
    const setCookieHeader = response.headers.get('Set-Cookie');
    let jwt = data.jwt;
    if (!jwt && setCookieHeader) {
      const jwtMatch = setCookieHeader.match(/jwt=([^;]+)/);
      if (jwtMatch) jwt = jwtMatch[1];
    }

    return {
      user: data.user,
      isNewUser: data.isNewUser || false,
      jwt: jwt || generateMockJWT(data.user.id, 'passkey', mockId),
    };
  } catch (error) {
    console.warn('Mock passkey auth API call failed, using local mock:', error);
    const mockId = credentialId || `passkey_${Date.now()}`;
    const user = generateMockUser('passkey', mockId, 'Passkey User');
    const jwt = generateMockJWT(user.id, 'passkey', mockId);
    return {
      user,
      isNewUser: Math.random() > 0.5,
      jwt,
    };
  }
}

