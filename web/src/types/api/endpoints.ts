// API endpoint definitions
export const API_ENDPOINTS = {
  // Auth
  AUTH: {
    GET_ME: '/api/rest/getme',
    TELEGRAM_AUTH: '/api/rest/telegram-auth',
    TELEGRAM_WEBAPP_AUTH: '/api/rest/telegram-auth/webapp',
  },
  
  // Publications
  PUBLICATIONS: {
    LIST: '/api/rest/publications',
    MY: '/api/rest/publications/my',
    BY_COMMUNITY: (chatId: string) => `/api/rest/publications/communities/${chatId}`,
    CREATE: '/api/rest/publications',
    GET: (slug: string) => `/api/rest/publications/${slug}`,
    UPDATE: (id: string) => `/api/rest/publications/${id}`,
    DELETE: (id: string) => `/api/rest/publications/${id}`,
  },
  
  // Comments
  COMMENTS: {
    LIST: '/api/rest/comments',
    BY_PUBLICATION: (slug: string) => `/api/rest/comments/publication/${slug}`,
    BY_TRANSACTION: (id: string) => `/api/rest/comments/transaction/${id}`,
    CREATE: '/api/rest/comments',
    UPDATE: (id: string) => `/api/rest/comments/${id}`,
    DELETE: (id: string) => `/api/rest/comments/${id}`,
  },
  
  // Communities
  COMMUNITIES: {
    LIST: '/api/rest/communities',
    INFO: (chatId: string) => `/api/rest/communityinfo?chatId=${chatId}`,
    CREATE: '/api/rest/communities',
    UPDATE: (id: string) => `/api/rest/communities/${id}`,
    DELETE: (id: string) => `/api/rest/communities/${id}`,
  },
  
  // Transactions
  TRANSACTIONS: {
    LIST: '/api/rest/transactions',
    MY: '/api/rest/transactions/my',
    UPDATES: '/api/rest/transactions/updates',
    CREATE: '/api/rest/transactions',
    GET: (id: string) => `/api/rest/transactions/${id}`,
  },
  
  // Wallet
  WALLET: {
    LIST: '/api/rest/wallet',
    BALANCE: '/api/rest/wallet/balance',
    WITHDRAW: '/api/rest/wallet/withdraw',
    TRANSFER: '/api/rest/wallet/transfer',
  },
  
  // Polls
  POLLS: {
    LIST: '/api/rest/polls',
    CREATE: '/api/rest/polls',
    GET: (id: string) => `/api/rest/polls/${id}`,
    VOTE: (id: string) => `/api/rest/polls/${id}/vote`,
    RESULTS: (id: string) => `/api/rest/polls/${id}/results`,
  },
  
  // Users
  USERS: {
    PROFILE: (tgUserId: string) => `/api/rest/users/telegram/${tgUserId}/profile`,
    UPDATE_PROFILE: (id: string) => `/api/rest/users/${id}`,
  },
  
  // Rates
  RATES: {
    GET: '/api/rest/rate',
    BY_CURRENCY: (fromCurrency: string) => `/api/rest/rate?fromCurrency=${fromCurrency}`,
  },
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS;

