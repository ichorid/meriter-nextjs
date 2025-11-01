/**
 * Publication utility functions
 */

import type { FeedItem, PublicationFeedItem } from '@/types/api-v1';

/**
 * Get the unique identifier for a publication (slug or id)
 * @param publication - Publication item
 * @returns Slug if available, otherwise id
 */
export function getPublicationIdentifier(publication: FeedItem | PublicationFeedItem | { id: string; slug?: string }): string {
  if (!publication) {
    return '';
  }
  
  // For publication type, prefer slug over id
  if ('type' in publication && publication.type === 'publication') {
    const pub = publication as PublicationFeedItem;
    return pub.slug || pub.id;
  }
  
  // For other types or objects with slug, check slug first
  if ('slug' in publication && publication.slug) {
    return publication.slug;
  }
  
  // Fall back to id
  return publication.id || '';
}

/**
 * Check if a target element is an interactive element
 * @param target - HTMLElement to check
 * @returns True if the element is interactive
 */
export function isInteractiveElement(target: HTMLElement): boolean {
  if (!target) {
    return false;
  }
  
  return !!(
    target.closest('button') ||
    target.closest('a') ||
    target.closest('[class*="clickable"]') ||
    target.closest('[class*="btn"]')
  );
}

