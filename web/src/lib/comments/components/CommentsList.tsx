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

interface CommentsListProps {
  roots: TreeNode[];
  myId?: string;
  balance?: any;
  wallets?: any[];
  communityId?: string;
  publicationSlug?: string;
  activeCommentHook?: [string | null, React.Dispatch<React.SetStateAction<string | null>>];
  activeSlider?: string | null;
  setActiveSlider?: (id: string | null) => void;
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
  activeSlider,
  setActiveSlider,
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
  
  // Log path changes
  useEffect(() => {
    console.log('[CommentsList] Path state changed:', {
      path,
      pathLength: path.length,
      timestamp: new Date().toISOString(),
    });
  }, [path]);
  
  // State to track the full tree with all loaded comments
  const [fullTree, setFullTree] = useState<TreeNode[]>(roots);
  const [loadedCommentIds, setLoadedCommentIds] = useState<Set<string>>(new Set());
  const [loadingReplies, setLoadingReplies] = useState<Set<string>>(new Set());
  
  // Log fullTree changes
  useEffect(() => {
    console.log('[CommentsList] fullTree state changed:', {
      fullTreeRootsCount: fullTree.length,
      fullTreeRootIds: fullTree.map(r => r.id),
      timestamp: new Date().toISOString(),
    });
  }, [fullTree]);

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
    const totalNodes = countAllNodes(roots);
    const rootNodesWithChildren = roots.filter(r => r.children.length > 0);
    console.log('[CommentsList] Roots changed:', {
      rootsCount: roots.length,
      rootIds: roots.map(r => r.id),
      totalNodesInTree: totalNodes,
      rootNodesWithChildrenCount: rootNodesWithChildren.length,
      rootNodesWithChildren: rootNodesWithChildren.map(r => ({
        id: r.id,
        childrenCount: r.children.length,
        childrenIds: r.children.map(c => c.id),
        // Log first child details to see structure
        firstChild: r.children[0] ? {
          id: r.children[0].id,
          parentId: r.children[0].parentId,
          targetType: r.children[0].originalComment?.targetType,
          targetId: r.children[0].originalComment?.targetId,
        } : null,
      })),
      // Log all root nodes to see their structure
      allRoots: roots.map(r => ({
        id: r.id,
        parentId: r.parentId,
        targetType: r.originalComment?.targetType,
        targetId: r.originalComment?.targetId,
        childrenCount: r.children.length,
      })),
      timestamp: new Date().toISOString(),
    });
    setFullTree(roots);
    // Don't mark root comments as loaded - we'll load their replies when needed
    // Only mark them as loaded after we've actually fetched their replies
  }, [roots]);

  // Function to add replies to a comment in the tree
  const addRepliesToNode = useCallback((tree: TreeNode[], targetId: string, replies: TreeNode[]): TreeNode[] => {
    console.log('[CommentsList] addRepliesToNode called:', {
      targetId,
      repliesCount: replies.length,
      replyIds: replies.map(r => r.id),
      timestamp: new Date().toISOString(),
    });
    const findAndUpdate = (nodes: TreeNode[]): TreeNode[] => {
      return nodes.map(node => {
        if (node.id === targetId) {
          // Found the target node, add replies to its children
          // Filter out replies that are already in children to avoid duplicates
          const existingIds = new Set(node.children.map(c => c.id));
          const newReplies = replies.filter(r => !existingIds.has(r.id));
          console.log('[CommentsList] Adding replies to node:', {
            nodeId: node.id,
            existingChildrenCount: node.children.length,
            newRepliesCount: newReplies.length,
            newReplyIds: newReplies.map(r => r.id),
            finalChildrenCount: node.children.length + newReplies.length,
          });
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
    const result = findAndUpdate(tree);
    console.log('[CommentsList] addRepliesToNode completed:', {
      targetId,
      finalTreeRootsCount: result.length,
    });
    return result;
  }, []);

  // Function to load replies for a comment
  const loadReplies = useCallback(async (commentId: string) => {
    console.log('[CommentsList] loadReplies called:', {
      commentId,
      isLoading: loadingReplies.has(commentId),
      isLoaded: loadedCommentIds.has(commentId),
      timestamp: new Date().toISOString(),
    });
    
    // Don't load if already loading or already loaded
    if (loadingReplies.has(commentId) || loadedCommentIds.has(commentId)) {
      console.log('[CommentsList] loadReplies skipped (already loading/loaded):', {
        commentId,
        isLoading: loadingReplies.has(commentId),
        isLoaded: loadedCommentIds.has(commentId),
      });
      return;
    }

    console.log('[CommentsList] loadReplies starting fetch:', { commentId });
    setLoadingReplies(prev => new Set(prev).add(commentId));

    try {
      console.log('[CommentsList] Calling getCommentReplies API:', {
        commentId,
        params: { sort: 'createdAt', order: 'desc' },
      });
      const result = await commentsApiV1.getCommentReplies(commentId, {
        sort: 'createdAt',
        order: 'desc',
      });
      
      console.log('[CommentsList] getCommentReplies API response:', {
        commentId,
        result,
        resultType: typeof result,
        resultKeys: result ? Object.keys(result) : [],
        resultValues: result ? Object.keys(result).map(key => ({ key, value: (result as any)[key], type: typeof (result as any)[key] })) : [],
        data: result?.data,
        dataType: typeof result?.data,
        dataIsArray: Array.isArray(result?.data),
        dataLength: Array.isArray(result?.data) ? result.data.length : 'not array',
        repliesCount: result?.data?.length || 0,
        replies: result?.data || [],
        meta: result?.meta,
        fullResponse: JSON.stringify(result, null, 2),
      });
      
      const replies = result?.data || [];
      if (replies.length > 0) {
        console.log('[CommentsList] Processing replies:', {
          commentId,
          repliesCount: replies.length,
          replyIds: replies.map(r => r.id),
        });
        
        // Transform replies to Comment format
        const transformedReplies = transformComments(replies);
        console.log('[CommentsList] Transformed replies:', {
          commentId,
          transformedCount: transformedReplies.length,
          transformedIds: transformedReplies.map(r => r.id),
        });
        
        // Build tree from replies (they should be flat, but buildTree handles it)
        const replyTree = buildTree(transformedReplies);
        console.log('[CommentsList] Built reply tree:', {
          commentId,
          treeRootsCount: replyTree.length,
          treeRootIds: replyTree.map(r => r.id),
          totalNodesInTree: replyTree.reduce((sum, root) => {
            const countChildren = (node: TreeNode): number => {
              return 1 + node.children.reduce((acc, child) => acc + countChildren(child), 0);
            };
            return sum + countChildren(root);
          }, 0),
        });
        
        // Add replies to the full tree
        console.log('[CommentsList] Adding replies to full tree:', { commentId });
        setFullTree(prevTree => {
          const newTree = addRepliesToNode(prevTree, commentId, replyTree);
          console.log('[CommentsList] Full tree updated:', {
            commentId,
            prevTreeRootsCount: prevTree.length,
            newTreeRootsCount: newTree.length,
          });
          return newTree;
        });
      } else {
        console.log('[CommentsList] No replies found for comment:', {
          commentId,
          repliesCount: 0,
        });
      }
      
      // Mark this comment as having loaded its replies
      console.log('[CommentsList] Marking comment as loaded:', { commentId });
      setLoadedCommentIds(prev => new Set(prev).add(commentId));
    } catch (error) {
      console.error(`[CommentsList] Error loading replies for comment ${commentId}:`, error);
    } finally {
      setLoadingReplies(prev => {
        const next = new Set(prev);
        next.delete(commentId);
        console.log('[CommentsList] loadReplies completed:', {
          commentId,
          stillLoading: next.has(commentId),
        });
        return next;
      });
    }
  }, [loadingReplies, loadedCommentIds, addRepliesToNode]);

  // Build the items to display: depth-first chain + breadth-first children
  const items = useMemo(() => {
    console.log('[CommentsList] items memoization running:', {
      pathLength: path.length,
      path,
      fullTreeRootsCount: fullTree.length,
      loadedCommentIds: Array.from(loadedCommentIds),
      loadingReplies: Array.from(loadingReplies),
      timestamp: new Date().toISOString(),
    });
    
    if (path.length === 0) {
      // No path: show all roots as breadth-first
      const rootItems = fullTree.map((node) => ({ id: node.id, depth: 0, node, isChain: false }));
      console.log('[CommentsList] No path - showing root items:', {
        rootItemsCount: rootItems.length,
        rootItemIds: rootItems.map(i => i.id),
      });
      return rootItems;
    }

    const items: FlatItem[] = [];
    
    // Build the depth-first chain from the path
    let chainEnd: TreeNode | null = null;
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      if (!nodeId) {
        console.log('[CommentsList] Empty nodeId in path at index:', i);
        break;
      }
      const node = getNodeById(fullTree, nodeId);
      if (!node) {
        console.log('[CommentsList] Node not found in tree:', {
          nodeId,
          fullTreeRootIds: fullTree.map(r => r.id),
        });
        break;
      }
      console.log('[CommentsList] Processing node in path:', {
        index: i,
        nodeId,
        nodeChildrenCount: node.children.length,
        nodeChildrenIds: node.children.map(c => c.id),
        nodeReplyCount: node.originalComment?.metrics?.replyCount ?? 0,
        metrics: node.originalComment?.metrics,
        nodeHasChildren: node.children.length > 0,
        nodeParentId: node.parentId,
        nodeTargetType: node.originalComment?.targetType,
        nodeTargetId: node.originalComment?.targetId,
      });
      items.push({ id: node.id, depth: i, node, isChain: true });
      chainEnd = node;
      
      // Load replies if:
      // 1. We don't already have children loaded (children.length === 0)
      // 2. We haven't already loaded/checked for replies
      // 3. We're not currently loading replies
      // Note: We always try to load replies when navigating to a comment, even if replyCount is 0,
      // because the API might not return accurate counts or the comment might have replies that weren't counted
      const replyCount = node.originalComment?.metrics?.replyCount ?? 0;
      const hasReplies = replyCount > 0;
      const needsLoading = node.children.length === 0 && !loadedCommentIds.has(nodeId) && !loadingReplies.has(nodeId);
      console.log('[CommentsList] Checking if replies need loading:', {
        nodeId,
        hasReplies,
        replyCount,
        childrenLength: node.children.length,
        isLoaded: loadedCommentIds.has(nodeId),
        isLoading: loadingReplies.has(nodeId),
        needsLoading,
        metrics: node.originalComment?.metrics,
      });
      if (needsLoading) {
        // Load replies asynchronously
        console.log('[CommentsList] Triggering loadReplies for node:', { nodeId, replyCount });
        loadReplies(nodeId);
      }
    }

    // Continue the chain depth-first automatically if there's exactly one child
    if (chainEnd && chainEnd.children.length === 1) {
      const singleChild = chainEnd.children[0];
      if (singleChild) {
        console.log('[CommentsList] Adding single child to chain:', {
          chainEndId: chainEnd.id,
          singleChildId: singleChild.id,
        });
        items.push({ id: singleChild.id, depth: path.length, node: singleChild, isChain: true });
        chainEnd = singleChild;
      }
    }

    // Add breadth-first children of the chain end
    if (chainEnd) {
      const depth = items.length;
      console.log('[CommentsList] Adding breadth-first children:', {
        chainEndId: chainEnd.id,
        childrenCount: chainEnd.children.length,
        childrenIds: chainEnd.children.map(c => c.id),
        depth,
      });
      for (const child of chainEnd.children) {
        // Skip if already added as single child
        if (items.some(item => item.id === child.id)) {
          console.log('[CommentsList] Skipping child (already in chain):', { childId: child.id });
          continue;
        }
        items.push({ id: child.id, depth, node: child, isChain: false });
      }
    } else {
      console.log('[CommentsList] No chainEnd - cannot add children');
    }

    console.log('[CommentsList] Final items computed:', {
      itemsCount: items.length,
      itemIds: items.map(i => i.id),
      itemDepths: items.map(i => i.depth),
      itemIsChain: items.map(i => i.isChain),
    });
    return items;
  }, [fullTree, path, loadedCommentIds, loadingReplies, loadReplies]);

  // Track previous items for animation logic
  const wasInPrevious = useMemo(() => {
    const prevIds = new Set(prevItemsRef.current.map(item => item.id));
    const result = new Set(items.filter(item => prevIds.has(item.id)).map(item => item.id));
    prevItemsRef.current = items;
    return result;
  }, [items]);

  const handleCardClick = useCallback((nodeId: string, event?: React.MouseEvent) => {
    console.log('[CommentsList] handleCardClick called:', {
      nodeId,
      currentPath: path,
      pathLength: path.length,
      event: event ? {
        type: event.type,
        target: (event.target as HTMLElement)?.tagName,
        currentTarget: (event.currentTarget as HTMLElement)?.tagName,
      } : null,
      timestamp: new Date().toISOString(),
    });
    
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
    console.log('[CommentsList] Clicked node index in path:', {
      nodeId,
      clickedIndex,
      inPath: clickedIndex >= 0,
    });
    
    if (clickedIndex >= 0) {
      // Clicked a card in the chain - collapse to that point
      const newPath = path.slice(0, clickedIndex + 1);
      console.log('[CommentsList] Collapsing path to clicked node:', {
        nodeId,
        oldPath: path,
        newPath,
      });
      setPath(newPath);
      setClickedCardId(nodeId);
    } else {
      // Clicked a child - extend the chain
      const newPath = [...path, nodeId];
      console.log('[CommentsList] Extending path with clicked node:', {
        nodeId,
        oldPath: path,
        newPath,
      });
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
      <div className="flex flex-col gap-4">
        {path.length > 0 && (
          <button
            onClick={handleBackClick}
            className="btn btn-sm btn-ghost mb-2"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div className="flex flex-col gap-3">
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
                    console.log('[CommentsList] CommentCard onNavigate called:', {
                      itemId: item.id,
                      itemDepth: item.depth,
                      isChain: item.isChain,
                      nodeChildrenCount: item.node.children.length,
                      nodeReplyCount: item.node.originalComment?.metrics?.replyCount ?? 0,
                      metrics: item.node.originalComment?.metrics,
                      timestamp: new Date().toISOString(),
                    });
                    handleCardClick(item.id);
                  }}
                  myId={myId}
                  balance={balance}
                  wallets={wallets}
                  communityId={communityId}
                  publicationSlug={publicationSlug}
                  activeCommentHook={activeCommentHook}
                  activeSlider={activeSlider}
                  setActiveSlider={setActiveSlider}
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

