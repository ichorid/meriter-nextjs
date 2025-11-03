/**
 * Data Transformation Utilities
 * 
 * Transforms Meriter Comment format to template Comment format
 */

import type { Comment as MeriterComment } from '@meriter/shared-types';
import type { Comment } from '../types';

/**
 * Transform a Meriter Comment to template Comment format
 */
export function transformComment(meriterComment: MeriterComment): Comment {
  return {
    id: meriterComment.id,
    parentId: meriterComment.parentCommentId || null,
    author: meriterComment.meta?.author?.name || 'Unknown',
    content: meriterComment.content,
    createdAt: meriterComment.createdAt,
    score: meriterComment.metrics?.score || 0,
    originalComment: meriterComment,
  };
}

/**
 * Transform an array of Meriter Comments to template Comment format
 */
export function transformComments(meriterComments: MeriterComment[]): Comment[] {
  return meriterComments.map(transformComment);
}

