import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { AppConfig } from '../../config/configuration';
import { UserService } from '../../domain/services/user.service';
import { AuthenticatedUser } from '../interfaces/authenticated-user.interface';
import { JwtPayload } from '../helpers/jwt';

export interface AuthenticateFromRequestOptions {
  req: any;
  allowTestMode?: boolean; // For tRPC context
}

export interface AuthenticationResult {
  user: AuthenticatedUser | null;
  jwtPayload?: JwtPayload;
  error?: 'NO_TOKEN' | 'INVALID_TOKEN' | 'USER_NOT_FOUND' | 'TOKEN_EXPIRED';
  errorMessage?: string;
}

/**
 * Centralized authentication service
 * Extracts JWT verification and user authentication logic shared between
 * UserGuard (NestJS guards) and tRPC context creation.
 */
@Injectable()
export class JwtVerificationService {
  private readonly logger = new Logger(JwtVerificationService.name);

  constructor(
    private userService: UserService,
    private configService: ConfigService<AppConfig>,
  ) { }

  /**
   * Authenticate user from request
   * Supports multiple authentication sources:
   * 1. req.user (set by guards like AllowAllGuard in tests)
   * 2. Test globals (testUserId, testUserGlobalRole) when allowTestMode is true
   * 3. JWT cookie authentication
   *
   * @param options Authentication options
   * @returns Authentication result with user or error details
   */
  async authenticateFromRequest(
    options: AuthenticateFromRequestOptions,
  ): Promise<AuthenticationResult> {
    const { req, allowTestMode = false } = options;

    this.logger.debug(
      `[AUTH-DEBUG] authenticateFromRequest: allowTestMode=${allowTestMode}, req.user exists=${!!req.user}, req.user.id=${req.user?.id || 'none'}`
    );

    // Priority 1: Check if req.user is already set by guards (e.g., AllowAllGuard in tests)
    if (req.user && req.user.id) {
      this.logger.debug(
        `[AUTH-DEBUG] Using req.user from guard: userId=${req.user.id}`
      );
      return this.getAuthenticatedUserFromRequestUser(req);
    }

    // Priority 2: Check test globals (when guards aren't applied - Express middleware bypasses NestJS guards)
    if (allowTestMode) {
      const testResult = await this.getAuthenticatedUserFromTestGlobals();
      if (testResult) {
        this.logger.debug(
          `[AUTH-DEBUG] Using test globals: userId=${testResult.user?.id || 'none'}`
        );
        return testResult;
      }
    }

    // Priority 3: Fall back to JWT cookie authentication
    const jwt = req.cookies?.jwt;
    if (!jwt) {
      this.logger.warn(
        `[AUTH-DEBUG] No JWT cookie found. req.cookies exists: ${!!req.cookies}, cookie keys: ${req.cookies ? Object.keys(req.cookies).join(', ') : 'none'}, cookie header: ${req.headers?.cookie ? 'present' : 'missing'}`
      );
      return {
        user: null,
        error: 'NO_TOKEN',
        errorMessage: 'No JWT token provided',
      };
    }

    this.logger.debug(
      `[AUTH-DEBUG] JWT cookie found, proceeding to verify: length=${jwt.length}`
    );

    return this.authenticateFromJwt(jwt);
  }

  /**
   * Authenticate user from JWT token
   * @param jwt JWT token string
   * @returns Authentication result with user or error details
   */
  async authenticateFromJwt(jwt: string): Promise<AuthenticationResult> {
    try {
      const jwtSecret = (this.configService.getOrThrow as any)('jwt.secret') as string;

      // Log secret status for debugging (without exposing the actual value)
      this.logger.debug(
        `[AUTH-DEBUG] JWT secret configured: length=${jwtSecret.length}, firstChar=${jwtSecret[0]}, lastChar=${jwtSecret[jwtSecret.length - 1]}`,
      );

      this.logger.debug(
        `[AUTH-DEBUG] Verifying JWT: token length=${jwt.length}, token preview=${jwt.substring(0, 20)}...${jwt.substring(jwt.length - 10)}`
      );

      const data: any = verify(jwt, jwtSecret);

      this.logger.debug(
        `[AUTH-DEBUG] JWT verification SUCCESS: uid=${data.uid}, authProvider=${data.authProvider}, authId=${data.authId}, iat=${data.iat}, exp=${data.exp}`
      );

      const jwtPayload: JwtPayload = {
        uid: data.uid,
        authProvider: data.authProvider,
        authId: data.authId,
        communityTags: data.communityTags || [],
      };

      const uid = jwtPayload.uid;
      this.logger.debug(
        `[AUTH-DEBUG] Looking up user in database: uid=${uid}`
      );

      const dbUser = await this.userService.getUserById(uid);

      if (!dbUser) {
        this.logger.warn(
          `[AUTH-DEBUG] Valid JWT but user not found for uid: ${uid}`
        );
        this.logger.warn(
          'This may indicate a deleted user, invalid token, or database issue',
        );

        return {
          user: null,
          jwtPayload,
          error: 'USER_NOT_FOUND',
          errorMessage: `User not found for uid: ${uid}`,
        };
      }

      this.logger.debug(
        `[AUTH-DEBUG] User found in database: id=${dbUser.id}, username=${dbUser.username || 'none'}, authProvider=${dbUser.authProvider}`
      );

      const authenticatedUser = this.mapUserToAuthenticatedUser(dbUser);

      this.logger.debug(
        `[AUTH-DEBUG] Authentication complete: userId=${authenticatedUser.id}, username=${authenticatedUser.username || 'none'}`
      );

      return {
        user: authenticatedUser,
        jwtPayload,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      this.logger.error(
        `[AUTH-DEBUG] JWT verification FAILED: ${errorMessage}`
      );

      // Check for specific JWT errors
      if (errorMessage.includes('invalid signature')) {
        this.logger.error('[AUTH-DEBUG] JWT signature verification failed. This may indicate:');
        this.logger.error('1. JWT_SECRET environment variable is missing or incorrect');
        this.logger.error('2. JWT_SECRET was changed after tokens were issued');
        this.logger.error('3. Tokens were signed with a different secret');

        // Log diagnostic info (without exposing secret)
        try {
          const jwtSecret = (this.configService.getOrThrow as any)('jwt.secret') as string;
          this.logger.debug(
            `[AUTH-DEBUG] Current JWT_SECRET status: configured=true, length=${jwtSecret.length}`,
          );
        } catch (_e) {
          this.logger.error('[AUTH-DEBUG] JWT_SECRET is not configured in ConfigService');
        }

        return {
          user: null,
          error: 'INVALID_TOKEN',
          errorMessage: 'Invalid JWT signature',
        };
      } else if (
        errorMessage.includes('expired') ||
        errorMessage.includes('jwt expired')
      ) {
        this.logger.warn(
          `[AUTH-DEBUG] JWT token has expired: ${errorMessage}`
        );
        return {
          user: null,
          error: 'TOKEN_EXPIRED',
          errorMessage: 'JWT token has expired',
        };
      } else {
        this.logger.error(
          `[AUTH-DEBUG] Other JWT verification error: ${errorMessage}`
        );
        return {
          user: null,
          error: 'INVALID_TOKEN',
          errorMessage,
        };
      }
    }
  }

  /**
   * Extract authenticated user from req.user (set by guards)
   * @param req Request object with req.user set
   * @returns Authentication result
   */
  private async getAuthenticatedUserFromRequestUser(
    req: any,
  ): Promise<AuthenticationResult> {
    // User already authenticated by guard - use it directly
    // Enrich with full user data if needed (for tests, req.user might be a mock)
    const dbUser = await this.userService.getUserById(req.user.id);

    if (dbUser) {
      // Use database user for consistency
      const authenticatedUser = this.mapUserToAuthenticatedUser(dbUser);
      return {
        user: authenticatedUser,
      };
    } else {
      // In test scenarios, dbUser might not exist yet - use req.user as fallback
      // Map req.user structure to AuthenticatedUser
      const user: AuthenticatedUser = {
        id: req.user.id,
        authProvider: req.user.authProvider || 'test',
        authId: req.user.authId || req.user.id,
        username: req.user.username,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        displayName: req.user.displayName,
        avatarUrl: req.user.avatarUrl,
        globalRole: req.user.globalRole,
      };
      return { user };
    }
  }

  /**
   * Extract authenticated user from test globals
   * @returns Authentication result or null if test globals not set
   */
  private async getAuthenticatedUserFromTestGlobals(): Promise<AuthenticationResult | null> {
    const testUserId = (global as any).testUserId;
    const testUserGlobalRole = (global as any).testUserGlobalRole;

    if (!testUserId) {
      return null;
    }

    // Test mode: Use global testUserId (set by tests before making requests)
    // This allows tests to work even when guards aren't applied (Express middleware bypasses NestJS guards)
    const dbUser = await this.userService.getUserById(testUserId);

    if (dbUser) {
      // Use database user if it exists
      const authenticatedUser = this.mapUserToAuthenticatedUser(dbUser);
      // Override globalRole if test global is set
      if (testUserGlobalRole) {
        authenticatedUser.globalRole = testUserGlobalRole;
      }
      return {
        user: authenticatedUser,
      };
    } else {
      // Create minimal user object from test globals
      const user: AuthenticatedUser = {
        id: testUserId,
        authProvider: 'test',
        authId: testUserId,
        username: 'testuser',
        displayName: 'Test User',
        globalRole: testUserGlobalRole,
      };
      return { user };
    }
  }

  /**
   * Map database user to AuthenticatedUser format
   * Single source of truth for AuthenticatedUser mapping
   * @param user Database user object
   * @returns AuthenticatedUser
   */
  mapUserToAuthenticatedUser(user: any): AuthenticatedUser {
    return {
      id: user.id,
      authProvider: user.authProvider,
      authId: user.authId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      globalRole: user.globalRole,
    };
  }
}

