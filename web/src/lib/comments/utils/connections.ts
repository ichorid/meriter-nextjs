import type { FlatItem, TreeNode } from '../types';

/**
 * Connection Utilities
 * 
 * Functions for calculating connection metadata needed for tree line rendering.
 */

/**
 * Calculates connection metadata for a list of flat items.
 * This identifies sibling groups and determines positioning information.
 * 
 * @param items - Array of flat items to process
 * @returns Map of item ID to connection metadata
 */
export function calculateConnectionMetadata(items: FlatItem[]): Map<string, FlatItem> {
  const itemMap = new Map<string, FlatItem>();
  
  // Group items by their parent (siblingGroupId)
  const siblingGroups = new Map<string | null, FlatItem[]>();
  
  for (const item of items) {
    itemMap.set(item.id, item);
    
    // Determine parent ID
    const parentId = item.node.parentId;
    
    // Group siblings by their parent
    const groupKey = parentId;
    if (!siblingGroups.has(groupKey)) {
      siblingGroups.set(groupKey, []);
    }
    siblingGroups.get(groupKey)!.push(item);
  }
  
  // Process each sibling group to set metadata
  for (const [parentId, siblings] of siblingGroups.entries()) {
    // Sort siblings by their order in the array (maintain display order)
    const sortedSiblings = siblings.sort((a, b) => {
      const indexA = items.findIndex(item => item.id === a.id);
      const indexB = items.findIndex(item => item.id === b.id);
      return indexA - indexB;
    });
    
    const siblingCount = sortedSiblings.length;
    
    for (let i = 0; i < sortedSiblings.length; i++) {
      const item = sortedSiblings[i];
      const updatedItem: FlatItem = {
        ...item,
        parentId: parentId || null,
        siblingGroupId: parentId || null,
        siblingIndex: i,
        siblingCount,
        hasSiblings: siblingCount > 1,
        isFirstSibling: i === 0,
        isLastSibling: i === siblingCount - 1,
        hasChildren: item.node.children.length > 0,
      };
      itemMap.set(item.id, updatedItem);
    }
  }
  
  return itemMap;
}

/**
 * Calculates the maximum number of siblings at each depth level.
 * This is used to determine padding needed for alignment.
 * 
 * @param items - Array of flat items to analyze
 * @returns Map of depth to maximum sibling count at that depth
 */
export function calculateMaxSiblingGroups(items: FlatItem[]): Map<number, number> {
  const maxSiblingsByDepth = new Map<number, number>();
  
  // Group items by depth
  const itemsByDepth = new Map<number, FlatItem[]>();
  for (const item of items) {
    if (!itemsByDepth.has(item.depth)) {
      itemsByDepth.set(item.depth, []);
    }
    itemsByDepth.get(item.depth)!.push(item);
  }
  
  // For each depth, find the maximum sibling group size
  for (const [depth, depthItems] of itemsByDepth.entries()) {
    // Group by siblingGroupId
    const siblingGroups = new Map<string | null, number>();
    for (const item of depthItems) {
      const groupId = item.siblingGroupId;
      siblingGroups.set(groupId, (siblingGroups.get(groupId) || 0) + 1);
    }
    
    // Find maximum
    let max = 0;
    for (const count of siblingGroups.values()) {
      if (count > max) {
        max = count;
      }
    }
    
    maxSiblingsByDepth.set(depth, max);
  }
  
  return maxSiblingsByDepth;
}

/**
 * Calculates the padding needed for an item at a given depth.
 * Padding ensures alignment between parent-child nodes and sibling groups.
 * 
 * @param depth - The depth level of the item
 * @param maxSiblingGroups - Map of depth to max sibling count
 * @param basePadding - Base padding value (default: 20px)
 * @param forkLength - Length of horizontal fork line (default: 20px)
 * @returns Padding value in pixels
 */
export function calculatePadding(
  depth: number,
  maxSiblingGroups: Map<number, number>,
  basePadding: number = 20,
  forkLength: number = 20
): number {
  if (depth === 0) {
    return basePadding;
  }
  
  // Calculate padding based on max sibling groups at each depth level up to current depth
  let totalPadding = basePadding;
  
  for (let d = 0; d < depth; d++) {
    const maxSiblings = maxSiblingGroups.get(d) || 1;
    // If there are multiple siblings, we need space for the vertical line and forks
    if (maxSiblings > 1) {
      totalPadding += forkLength;
    } else {
      // Even with single child, we need space for parent-child line
      totalPadding += forkLength;
    }
  }
  
  return totalPadding;
}

