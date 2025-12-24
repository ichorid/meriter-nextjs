import type { Comment, TreeNode, _FlatItem } from './types';

/**
 * Tree Utilities
 * 
 * These functions help you work with tree-structured data.
 * Most commonly used: buildTree() to convert flat data into a tree structure.
 */

/**
 * Converts a flat list of comments into a tree structure.
 * 
 * @param list - Flat array of comments with parentId references
 * @returns Array of root nodes (comments with no parent)
 * 
 * Example:
 * ```typescript
 * const flatComments = [
 *   { id: '1', parentId: null, ... },
 *   { id: '2', parentId: '1', ... },
 * ];
 * const roots = buildTree(flatComments);
 * ```
 */
export function buildTree(list: Comment[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];

  for (const c of list) map.set(c.id, { ...c, children: [] });

  for (const n of map.values()) {
    if (n.parentId && map.has(n.parentId)) {
      map.get(n.parentId)!.children.push(n);
    } else {
      roots.push(n);
    }
  }

  // Sort siblings by score desc then date desc
  const sortRec = (nodes: TreeNode[]) => {
    nodes.sort(
      (a, b) =>
        b.score - a.score ||
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    nodes.forEach((ch) => sortRec(ch.children));
  };

  sortRec(roots);
  return roots;
}

/**
 * Finds a node by ID in the tree structure.
 * 
 * @param roots - Array of root nodes to search in
 * @param id - The ID of the node to find
 * @returns The found node or null if not found
 */
export function getNodeById(roots: TreeNode[], id: string): TreeNode | null {
  const search = (nodes: TreeNode[]): TreeNode | null => {
    for (const node of nodes) {
      if (node.id === id) return node;
      const found = search(node.children);
      if (found) return found;
    }
    return null;
  };
  return search(roots);
}

/**
 * Finds the chain of nodes corresponding to a path of IDs.
 * Used internally by CommentsList for navigation.
 * 
 * @param roots - Array of root nodes
 * @param path - Array of node IDs representing the path
 * @returns Array of nodes in the order of the path
 */
export function findChain(roots: TreeNode[], path: string[]): TreeNode[] {
  const chain: TreeNode[] = [];
  let current: TreeNode | null = null;
  
  for (const id of path) {
    if (current === null) {
      current = getNodeById(roots, id);
    } else {
      current = current.children.find((c) => c.id === id) || null;
    }
    if (!current) break;
    chain.push(current);
  }
  
  return chain;
}

/**
 * Calculates the total number of nodes in a subtree (including the node itself).
 * 
 * @param node - The root node of the subtree
 * @returns Total count of nodes in the subtree
 */
export function getSubtreeSize(node: TreeNode): number {
  let count = 1;
  for (const child of node.children) {
    count += getSubtreeSize(child);
  }
  return count;
}
