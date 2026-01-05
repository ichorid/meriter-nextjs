/**
 * Feature flags for enabling/disabling platform features
 * These can be easily toggled to enable/disable features without removing code
 */

/**
 * Enable project posts feature
 * When false, project posts are completely hidden:
 * - Cannot create project posts
 * - Project posts are filtered from feeds
 * - Project-related UI is hidden
 * 
 * Set to true to re-enable the feature in the future
 */
export const ENABLE_PROJECT_POSTS = false;

/**
 * Enable hashtags feature
 * When false, hashtags are disabled and replaced with predefined categories:
 * - Hashtag input is hidden in post creation form
 * - Categories are used instead of hashtags
 * - Category selection UI is shown
 * 
 * Set to true to re-enable hashtags in the future
 */
export const ENABLE_HASHTAGS = false;

