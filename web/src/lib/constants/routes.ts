/**
 * Application route constants
 */

export const routes = {
  // Auth
  login: '/meriter/login',
  logout: '/meriter/logout',
  
  // Main
  home: '/meriter/home',
  settings: '/meriter/settings',
  
  // Communities
  communities: '/meriter/communities',
  community: (id: string) => `/meriter/communities/${id}`,
  communitySettings: (id: string) => `/meriter/communities/${id}/settings`,
  setupCommunity: '/meriter/setup-community',
  
  // Publications
  publication: (id: string) => `/meriter/publications/${id}`,
  
  // Polls
  polls: '/meriter/polls',
  poll: (id: string) => `/meriter/polls/${id}`,
  
  // Wallet
  wallet: '/meriter/wallet',
  transactions: '/meriter/wallet/transactions',
} as const;
