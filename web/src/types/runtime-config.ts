/**
 * Runtime configuration types
 * These types match the response from /api/v1/config endpoint
 */

export interface OAuthConfig {
  google: boolean;
  yandex: boolean;
  vk: boolean;
  telegram: boolean;
  apple: boolean;
  twitter: boolean;
  instagram: boolean;
  sber: boolean;
  mailru: boolean;
}

export interface AuthnConfig {
  enabled: boolean;
}

export interface FeaturesConfig {
  analytics: boolean;
  debug: boolean;
  commentVoting: boolean;
  commentImageUploads: boolean;
  loginInviteForm: boolean;
}

export interface RuntimeConfig {
  botUsername: string | null;
  oauth: OAuthConfig;
  authn: AuthnConfig;
  features: FeaturesConfig;
}

/**
 * API response structure (wrapped by ApiResponseInterceptor)
 */
export interface RuntimeConfigApiResponse {
  success: true;
  data: RuntimeConfig;
}

