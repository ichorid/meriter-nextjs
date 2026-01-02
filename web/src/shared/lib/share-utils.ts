'use client';

import { useToastStore } from '../stores/toast.store';

/**
 * Share a URL using Web Share API on mobile, or copy to clipboard on desktop
 * @param url - The URL to share (can be relative or absolute)
 * @param toastMessage - Optional custom message for toast notification (default: "URL copied to buffer")
 */
export async function shareUrl(url: string, toastMessage?: string): Promise<void> {
  // Ensure we have an absolute URL
  const absoluteUrl = url.startsWith('http') 
    ? url 
    : `${typeof window !== 'undefined' ? window.location.origin : ''}${url}`;

  // Check if Web Share API is available (mobile)
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({
        title: document.title || 'Meriter',
        url: absoluteUrl,
      });
      return;
    } catch (error) {
      // User cancelled or error occurred
      // If user cancelled, don't fall back to clipboard
      if ((error as Error).name === 'AbortError') {
        return;
      }
      // For other errors, fall through to clipboard copy
    }
  }

  // Fallback: Copy to clipboard (desktop or if share API fails)
  try {
    await navigator.clipboard.writeText(absoluteUrl);
    const toast = useToastStore.getState().addToast;
    toast(toastMessage || 'URL copied to buffer', 'success');
  } catch (error) {
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = absoluteUrl;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      const toast = useToastStore.getState().addToast;
      toast(toastMessage || 'URL copied to buffer', 'success');
    } catch (err) {
      const toast = useToastStore.getState().addToast;
      toast('Failed to copy URL', 'error');
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Construct a post URL
 */
export function getPostUrl(communityId: string, slug: string): string {
  return `/meriter/communities/${communityId}/posts/${slug}`;
}

/**
 * Construct a poll URL
 */
export function getPollUrl(communityId: string, pollId: string): string {
  return `/meriter/communities/${communityId}?poll=${pollId}`;
}

/**
 * Construct a comment URL with highlight parameter
 */
export function getCommentUrl(communityId: string, publicationSlug: string, commentId: string): string {
  return `/meriter/communities/${communityId}/posts/${publicationSlug}?highlight=${commentId}`;
}

