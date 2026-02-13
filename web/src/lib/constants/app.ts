/**
 * Centralized Application Constants
 * 
 * All application-wide constants organized by domain.
 * Use these instead of inline magic values for consistency and maintainability.
 */

// ============================================================================
// UI Constants
// ============================================================================

/**
 * File Upload Constraints
 */
export const FILE_UPLOAD = {
    /** Maximum file size in bytes (10MB) */
    MAX_FILE_SIZE: 10 * 1024 * 1024,

    /** Allowed image MIME types */
    ALLOWED_IMAGE_TYPES: [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
    ] as const,

    /** Maximum number of images per upload */
    MAX_IMAGES: 10,
} as const;

/**
 * Inspector Panel Dimensions
 */
export const INSPECTOR = {
    /** Default width in pixels */
    DEFAULT_WIDTH: 360,

    /** Minimum width in pixels */
    MIN_WIDTH: 240,

    /** Maximum width in pixels */
    MAX_WIDTH: 600,
} as const;

/**
 * Adaptive Layout Breakpoints
 */
export const LAYOUT = {
    /** Minimum width for adaptive panel display */
    ADAPTIVE_PANEL_MIN_WIDTH: 1280,
} as const;

// ============================================================================
// Storage Keys (localStorage/sessionStorage)
// ============================================================================

/**
 * Local Storage Keys
 * 
 * Centralized keys for browser storage to avoid typos and conflicts.
 */
export const STORAGE_KEYS = {
    /** Inspector panel width preference */
    INSPECTOR_WIDTH: 'inspector-width',

    /** Telegram Mini App detection flag */
    TG_MINI_APP_DETECTED: 'tg_mini_app_detected',

    /** Previous session existence flag */
    PREVIOUS_SESSION: 'meriter_has_previous_session',
} as const;

// ============================================================================
// Auth Constants
// ============================================================================

/**
 * Authentication & Cookie Management
 */
export const AUTH = {
    /** Debounce delay for cookie clearing operations (ms) */
    COOKIE_CLEARING_DEBOUNCE_DELAY: 100,

    /** Minimum time between cookie clear attempts (ms) */
    MIN_TIME_BETWEEN_CLEARS: 1000,

    /** Maximum retry attempts for auth operations */
    MAX_RETRIES: 12,
} as const;

// ============================================================================
// Polling & Refresh Intervals
// ============================================================================

/**
 * Polling Intervals (milliseconds)
 * 
 * Used for auto-refresh and data polling operations.
 */
export const POLLING = {
    /** Community data polling interval (30 seconds) */
    COMMUNITY_DATA: 30 * 1000,

    /** Wallet & Energy data polling interval (30 seconds) */
    WALLET_ENERGY: 30 * 1000,
} as const;

// ============================================================================
// Cache Configuration
// ============================================================================

/**
 * Cache Time-To-Live (TTL) values
 */
export const CACHE = {
    /** OSM Autocomplete cache duration (5 minutes) */
    OSM_AUTOCOMPLETE: 5 * 60 * 1000,
} as const;

// ============================================================================
// Global Merit (Backend Sync)
// ============================================================================

/**
 * Global community ID for platform-wide merit storage.
 * Priority communities (MD, OB, Projects, Support) use this wallet.
 */
export const GLOBAL_COMMUNITY_ID = '__global__' as const;

// ============================================================================
// Type Exports
// ============================================================================

/**
 * Type-safe storage key type
 */
export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

/**
 * Type-safe image type
 */
export type AllowedImageType = typeof FILE_UPLOAD.ALLOWED_IMAGE_TYPES[number];
