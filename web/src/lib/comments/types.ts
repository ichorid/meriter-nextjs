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
  // Connection metadata for tree line rendering
  parentId: string | null;
  siblingGroupId: string | null; // ID of parent node for grouping siblings
  siblingIndex: number; // Index within sibling group (0-based)
  siblingCount: number; // Total number of siblings in the group
  hasSiblings: boolean; // Whether this node has siblings
  isFirstSibling: boolean; // Whether this is the first sibling
  isLastSibling: boolean; // Whether this is the last sibling
  hasChildren: boolean; // Whether this node has children
};

