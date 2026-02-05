/**
 * Role constants
 * Centralized definitions for user roles
 */

export const GLOBAL_ROLE_SUPERADMIN = 'superadmin' as const;

export type GlobalRole = typeof GLOBAL_ROLE_SUPERADMIN;

export const COMMUNITY_ROLE_LEAD = 'lead' as const;
export const COMMUNITY_ROLE_PARTICIPANT = 'participant' as const;
export const COMMUNITY_ROLE_SUPERADMIN = 'superadmin' as const;

export type CommunityRole =
  | typeof COMMUNITY_ROLE_LEAD
  | typeof COMMUNITY_ROLE_PARTICIPANT
  | typeof COMMUNITY_ROLE_SUPERADMIN;


