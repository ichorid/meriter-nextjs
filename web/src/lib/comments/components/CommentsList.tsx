'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { getNodeById } from '../tree';
import type { TreeNode, FlatItem } from '../types';
import { CommentCard } from './CommentCard';
import { ANIMATION_TIMING } from '../animation-config';
import { commentsApiV1 } from '@/lib/api/v1';
import { transformComments } from '../utils/transform';
import { buildTree } from '../tree';
import { calculateConnectionMetadata, calculateMaxSiblingGroups } from '../utils/connections';

interface CommentsListProps {
  roots: TreeNode[];
  myId?: string;
  balance?: any;
  wallets?: any[];
  communityId?: string;
  publicationSlug?: string;
  activeCommentHook?: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeWithdrawPost?: string | null;
  setActiveWithdrawPost?: (id: string | null) => void;
  highlightTransactionId?: string;
  showCommunityAvatar?: boolean;
  isDetailPage?: boolean;
}

/**
 * CommentsList - Tree-based navigation component with Framer Motion animations
 * 
 * This component implements a hybrid tree navigation pattern:
 * - Depth-first chain: Shows the path from root to current node
 * - Breadth-first children: Shows all children of the current node at once
 * 
 * Navigation:
 * - Clicking a chain item collapses the view to that point
 * - Clicking a child item extends the chain to that node
 * - Automatically continues single-child chains depth-first
 */
export function CommentsList({ 
  roots,
  myId,
  balance,
  wallets,
  communityId,
  publicationSlug,
  activeCommentHook,
  activeWithdrawPost,
  setActiveWithdrawPost,
  highlightTransactionId,
  showCommunityAvatar,
  isDetailPage,
}: CommentsListProps) {
  const [path, setPath] = useState<string[]>(() => []);
  const prevItemsRef = useRef<FlatItem[]>([]);
  const [clickedCardId, setClickedCardId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  // State to track the full tree with all loaded comments
  const [fullTree, setFullTree] = useState<TreeNode[]>(roots);
  const [loadedCommentIds, setLoadedCommentIds] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());

  // Helper function to count all nodes in tree (including nested)
  const countAllNodes = (nodes: TreeNode[]): number => {
    let count = 0;
    const traverse = (node: TreeNode) => {
      count++;
      node.children.forEach(traverse);
    };
    nodes.forEach(root => traverse(root));
    return count;
  };

  // Update fullTree when roots change
  useEffect(() => {
    setFullTree(roots);
    // Don't mark root comments as loaded - we'll load their replies when needed
    // Only mark them as loaded after we've actually fetched their replies
  }, [roots]);

  // Function to add replies to a comment in the tree
  const addRepliesToNode = useCallback((tree: TreeNode[], targetId: string, replies: TreeNode[]): TreeNode[] => {
    const findAndUpdate = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === targetId) {
          // Found the target node, add replies to its children
          // Filter out replies that are already in children to avoid duplicates
          const existingIds = new Set(node.children.map(c => c.id));
          const newReplies = replies.filter(r => !existingIds.has(r.id));
          return {
            ...node,
            children: [...node.children, ...newReplies],
          };
        }
        // Recursively search in children
        return {
          ...node,
          children: findAndUpdate(node.children),
        };
      });
    };
    return findAndUpdate(tree);
  }, []);

  // Function to load replies for a comment
  const loadReplies = useCallback(async (commentId: string) => {
    // Don't load if already loading or already loaded
    if (loadingReplies.has(commentId) || loadedCommentIds.has(commentId)) {
      return;
    }

    setLoadingReplies(prev => new Set(prev).add(commentId));

    try {
      const result = await commentsApiV1.getCommentReplies(commentId, {
        sort: 'createdAt',
        order: 'desc',
      });
      
      const replies = result?.data || [];
      if (replies.length > 0) {
        // Transform replies to Comment format
        const transformedReplies = transformComments(replies);
        
        // Build tree from replies (they should be flat, but buildTree handles it)
        const replyTree = buildTree(transformedReplies);
        
        // Add replies to the full tree
        setFullTree(prevTree => addRepliesToNode(prevTree, commentId, replyTree));
      }
      
      // Mark this comment as having loaded its replies
      setLoadedCommentIds(prev => new Set(prev).add(commentId));
    } catch (error) {
      console.error(`[CommentsList] Error loading replies for comment ${commentId}:`, error);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        return next;
      });
    }
  }, [loadingReplies, loadedCommentIds, addRepliesToNode]);

  // Build the items to display: depth-first chain + breadth-first children
  const itemsWithMetadata = useMemo(() => {
    let items: FlatItem[] = [];
    let chainEnd: TreeNode | null = null;
    
    if (path.length === 0) {
      // No path: show all roots as breadth-first
      items = fullTree.map((node, index) => ({ 
        id: node.id, 
        depth: 0, 
        node, 
        isChain: false,
        parentId: null,
        siblingGroupId: null,
        siblingIndex: index,
        siblingCount: fullTree.length,
        hasSiblings: fullTree.length > 1,
        isFirstSibling: index === 0,
        isLastSibling: index === fullTree.length - 1,
        hasChildren: node.children.length > 0,
      }));
    } else {
      // Build the depth-first chain from the path
      for (let i = 0; i < path.length; i++) {
        const nodeId = path[i];
        if (!nodeId) {
          break;
        }
        const node = getNodeById(fullTree, nodeId);
        if (!node) {
          break;
        }
        
        // Determine parent for chain items
        const prevPathId = i > 0 ? path[i - 1] : undefined;
        const parentId = prevPathId || null;
        const parentNode = prevPathId ? getNodeById(fullTree, prevPathId) : null;
        const siblings = parentNode ? parentNode.children : fullTree;
        const siblingIndex = siblings.findIndex(n => n.id === node.id);
        
        items.push({ 
          id: node.id, 
          depth: i, 
          node, 
          isChain: true,
          parentId,
          siblingGroupId: parentId,
          siblingIndex,
          siblingCount: siblings.length,
          hasSiblings: siblings.length > 1,
          isFirstSibling: siblingIndex === 0,
          isLastSibling: siblingIndex === siblings.length - 1,
          hasChildren: node.children.length > 0,
        });
        chainEnd = node;
        
        // Load replies if:
        // 1. We don't already have children loaded (children.length === 0)
        // 2. We haven't already loaded/checked for replies
        // 3. We're not currently loading replies
        // Note: We always try to load replies when navigating to a comment, even if replyCount is 0,
        // because the API might not return accurate counts or the comment might have replies that weren't counted
        const needsLoading = node.children.length === 0 && !loadedCommentIds.has(nodeId) && !loadingReplies.has(nodeId);
        if (needsLoading) {
          // Load replies asynchronously
          loadReplies(nodeId);
        }
      }
    }

    // Continue the chain depth-first automatically if there's exactly one child
    if (chainEnd && chainEnd.children.length === 1) {
      const singleChild = chainEnd.children[0];
      if (singleChild) {
        items.push({ 
          id: singleChild.id, 
          depth: path.length, 
          node: singleChild, 
          isChain: true,
          parentId: chainEnd.id,
          siblingGroupId: chainEnd.id,
          siblingIndex: 0,
          siblingCount: 1,
          hasSiblings: false,
          isFirstSibling: true,
          isLastSibling: true,
          hasChildren: singleChild.children.length > 0,
        });
        chainEnd = singleChild;
      }
    }

    // Add breadth-first children of the chain end
    if (chainEnd) {
      const depth = items.length;
      const children = chainEnd.children;
      for (let i = 0; i < children.length; i++) {
        const child = children[i];
        if (!child) {
          continue;
        }
        // Skip if already added as single child
        if (items.some(item => item.id === child.id)) {
          continue;
        }
        items.push({ 
          id: child.id, 
          depth, 
          node: child, 
          isChain: false,
          parentId: chainEnd.id,
          siblingGroupId: chainEnd.id,
          siblingIndex: i,
          siblingCount: children.length,
          hasSiblings: children.length > 1,
          isFirstSibling: i === 0,
          isLastSibling: i === children.length - 1,
          hasChildren: child.children.length > 0,
        });
      }
    }

    // Calculate connection metadata and update items
    const metadataMap = calculateConnectionMetadata(items);
    const updatedItems = items.map(item => metadataMap.get(item.id) || item);

    return updatedItems;
  }, [fullTree, path, loadedCommentIds, loadingReplies, loadReplies]);

  // Calculate max sibling groups for padding calculation
  const maxSiblingGroups = useMemo(() => {
    return calculateMaxSiblingGroups(itemsWithMetadata);
  }, [itemsWithMetadata]);

  // Track previous items for animation logic
  const items = itemsWithMetadata;
  const wasInPrevious = useMemo(() => {
    const prevIds = new Set(prevItemsRef.current.map(item => item.id));
    const result = new Set(items.filter(item => prevIds.has(item.id)).map(item => item.id));
    prevItemsRef.current = items;
    return result;
  }, [items]);

  const handleCardClick = useCallback((nodeId: string, event?: React.MouseEvent) => {
    // Prevent immediate browser scroll/focus behavior
    if (event) {
      event.preventDefault();
      event.stopPropagation();
      // Prevent focus which can trigger scroll
      if (event.currentTarget instanceof HTMLElement) {
        event.currentTarget.blur();
      }
    }
    
    const clickedIndex = path.indexOf(nodeId);
    
    if (clickedIndex >= 0) {
      // Clicked a card in the chain - collapse to that point
      const newPath = path.slice(0, clickedIndex + 1);
      setPath(newPath);
      setClickedCardId(nodeId);
    } else {
      // Clicked a child - extend the chain
      const newPath = [...path, nodeId];
      setPath(newPath);
      setClickedCardId(nodeId);
    }
  }, [path]);

  const handleBackClick = useCallback(() => {
    if (path.length > 0) {
      setPath(path.slice(0, -1));
    } else {
      setPath([]);
    }
    setClickedCardId(null);
  }, [path]);

  // Smooth scroll synchronization with card animation
  useEffect(() => {
    if (!clickedCardId) return;

    // Manual scroll animation with matching timing
    const scrollDelay = ANIMATION_TIMING.LAYOUT_DELAY;
    const scrollDuration = 500; // 0.5s matching layout animation duration
    
    // Cubic bezier easing function for [0.4, 0, 0.2, 1]
    // Using proper cubic bezier calculation
    const cubicBezier = (t: number): number => {
      const c1x = 0.4, c1y = 0;
      const c2x = 0.2, c2y = 1;
      
      // Newton-Raphson method for cubic bezier approximation
      let t0 = t;
      for (let i = 0; i < 8; i++) {
        const t1 = 1 - t0;
        const f = 3 * t1 * t1 * t0 * c1x + 3 * t1 * t0 * t0 * c2x + t0 * t0 * t0 - t;
        const f1 = 3 * t1 * t1 * c1x + 6 * t1 * t0 * (c2x - c1x) + 3 * t0 * t0 * (1 - c2x);
        if (Math.abs(f1) < 1e-6) break;
        t0 = t0 - f / f1;
        if (t0 < 0) t0 = 0;
        if (t0 > 1) t0 = 1;
      }
      
      const t1 = 1 - t0;
      return 3 * t1 * t1 * t0 * c1y + 3 * t1 * t0 * t0 * c2y + t0 * t0 * t0;
    };

    const startScroll = () => {
      const cardElement = cardRefs.current.get(clickedCardId);
      if (!cardElement) {
        setClickedCardId(null);
        return;
      }

      // Get initial card position
      const initialRect = cardElement.getBoundingClientRect();
      const initialScrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const initialCardTop = initialScrollTop + initialRect.top;
      
      const startTime = performance.now();
      const targetOffset = 100; // 100px offset from top

      const animateScroll = (currentTime: number) => {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / scrollDuration, 1);
        
        // Track card's current position during animation (card is moving too)
        const currentRect = cardElement.getBoundingClientRect();
        const currentScrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const currentCardTop = currentScrollTop + currentRect.top;
        
        // Calculate desired scroll position to keep card at target offset
        const desiredScrollTop = currentCardTop - targetOffset;
        
        // Smoothly interpolate scroll position using easing
        const easedProgress = cubicBezier(progress);
        const currentScroll = initialScrollTop + (desiredScrollTop - initialScrollTop) * easedProgress;
        
        window.scrollTo(0, currentScroll);

        if (progress < 1) {
          requestAnimationFrame(animateScroll);
        } else {
          // Final adjustment to ensure card is at target position
          const finalRect = cardElement.getBoundingClientRect();
          const finalScrollTop = window.pageYOffset || document.documentElement.scrollTop;
          const finalCardTop = finalScrollTop + finalRect.top;
          const finalTargetScroll = finalCardTop - targetOffset;
          window.scrollTo(0, finalTargetScroll);
          
          // Clear clicked card after animation completes
          setClickedCardId(null);
        }
      };

      requestAnimationFrame(animateScroll);
    };

    // Wait for layout animation delay before starting scroll
    const timeoutId = setTimeout(startScroll, scrollDelay);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [clickedCardId]);

  return (
    <LayoutGroup>
      <div className="flex flex-col gap-4 w-full overflow-hidden">
        {path.length > 0 && (
          <button
            onClick={handleBackClick}
            className="btn btn-sm btn-ghost mb-2 self-start flex-shrink-0"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div className="flex flex-col gap-3 w-full overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            {items.map((item) => (
              <motion.div
                key={item.id}
                layoutId={item.id}
                layout="position"
                ref={(el) => {
                  if (el) {
                    cardRefs.current.set(item.id, el);
                  } else {
                    cardRefs.current.delete(item.id);
                  }
                }}
                onClick={(e) => handleCardClick(item.id, e)}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ 
                  opacity: 0,
                  transition: { duration: ANIMATION_TIMING.EXIT_DURATION / 1000 }
                }}
                transition={{
                  layout: { 
                    delay: ANIMATION_TIMING.LAYOUT_DELAY / 1000,
                    duration: 0.5,
                    ease: [0.4, 0, 0.2, 1]
                  },
                  opacity: {
                    delay: wasInPrevious.has(item.id)
                      ? ANIMATION_TIMING.LAYOUT_DELAY / 1000 
                      : ANIMATION_TIMING.ENTER_DELAY / 1000,
                    duration: ANIMATION_TIMING.ENTER_DURATION / 1000,
                  }
                }}
              >
                <CommentCard
                  node={item.node}
                  depth={item.depth}
                  isChainMode={item.isChain}
                  onNavigate={() => {
                    handleCardClick(item.id);
                  }}
                  connectionMetadata={item}
                  maxSiblingGroups={maxSiblingGroups}
                  myId={myId}
                  balance={balance}
                  wallets={wallets}
                  communityId={communityId}
                  publicationSlug={publicationSlug}
                  activeCommentHook={activeCommentHook}
                  activeWithdrawPost={activeWithdrawPost}
                  setActiveWithdrawPost={setActiveWithdrawPost}
                  highlightTransactionId={highlightTransactionId}
                  showCommunityAvatar={showCommunityAvatar}
                  isDetailPage={isDetailPage}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}

