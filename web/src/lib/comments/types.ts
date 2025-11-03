/**
 * Type Definitions for Tree Comments
 * 
 * These types define the data structure for the tree navigation system.
 * Adapted from treecomments template to work with Meriter's Comment schema.
 */

import type { Comment as MeriterComment } from '@meriter/shared-types';

/**
 * Base comment type for tree operations.
 * Maps Meriter Comment fields to the template's expected format.
 */
export type Comment = {
  id: string;
  parentId: string | null; // Maps from parentCommentId
  author: string; // Maps from meta.author.name
  content: string;
  createdAt: string;
  score: number; // Maps from metrics.score
  // Keep the original Meriter comment for reference
  originalComment: MeriterComment;
};

/**
 * Tree node type - a comment with children.
 * This is what CommentsList expects as input.
 */
export type TreeNode = Comment & {
  children: TreeNode[];
};

/**
 * Flattened item representation used internally by CommentsList.
 * Combines a node with its display properties (depth, chain status).
 */
export type FlatItem = {
  id: string;
  depth: number;
  node: TreeNode;
  isChain: boolean;
};

