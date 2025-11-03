'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { getNodeById } from '../tree';
import type { TreeNode, FlatItem } from '../types';
import { CommentCard } from './CommentCard';
import { ANIMATION_TIMING } from '../animation-config';

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
export function CommentsList({ roots }: { roots: TreeNode[] }) {
  const [path, setPath] = useState<string[]>(() => []);
  const prevItemsRef = useRef<FlatItem[]>([]);
  const [clickedCardId, setClickedCardId] = useState<string | null>(null);
  const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Build the items to display: depth-first chain + breadth-first children
  const items = useMemo(() => {
    if (path.length === 0) {
      // No path: show all roots as breadth-first
      return roots.map((node) => ({ id: node.id, depth: 0, node, isChain: false }));
    }

    const items: FlatItem[] = [];
    
    // Build the depth-first chain from the path
    let chainEnd: TreeNode | null = null;
    for (let i = 0; i < path.length; i++) {
      const nodeId = path[i];
      if (!nodeId) break;
      const node = getNodeById(roots, nodeId);
      if (!node) break;
      items.push({ id: node.id, depth: i, node, isChain: true });
      chainEnd = node;
    }

    // Continue the chain depth-first automatically if there's exactly one child
    if (chainEnd && chainEnd.children.length === 1) {
      const singleChild = chainEnd.children[0];
      if (singleChild) {
        items.push({ id: singleChild.id, depth: path.length, node: singleChild, isChain: true });
        chainEnd = singleChild;
      }
    }

    // Add breadth-first children of the chain end
    if (chainEnd) {
      const depth = items.length;
      for (const child of chainEnd.children) {
        // Skip if already added as single child
        if (items.some(item => item.id === child.id)) continue;
        items.push({ id: child.id, depth, node: child, isChain: false });
      }
    }

    return items;
  }, [roots, path]);

  // Track previous items for animation logic
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
      setPath(path.slice(0, clickedIndex + 1));
      setClickedCardId(nodeId);
    } else {
      // Clicked a child - extend the chain
      setPath([...path, nodeId]);
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
                  onNavigate={() => {}}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </LayoutGroup>
  );
}

