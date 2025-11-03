'use client';

import { Card, CardBody, Avatar, Badge } from '@/components/atoms';
import { formatDate } from '@/shared/lib/date';
import type { TreeNode } from '../types';
import { getSubtreeSize } from '../tree';
import { getAvatarUrl } from '../utils/avatar';
import { classList } from '@/shared/lib/classList';

/**
 * CommentCard - The card component displayed for each item in the tree
 * 
 * Customized to match Meriter's design system using DaisyUI components.
 * 
 * Props:
 * - node: The tree node containing the data to display
 * - depth: The depth level in the tree (for indentation)
 * - onNavigate: Callback when the card is clicked
 * - isChainMode: Whether this card is part of the depth-first chain
 */
export function CommentCard({
  node,
  depth,
  onNavigate,
  isChainMode = false,
}: {
  node: TreeNode;
  depth: number;
  onNavigate: () => void;
  isChainMode?: boolean;
}) {
  const subtreeSize = getSubtreeSize(node);
  const originalComment = node.originalComment;
  const authorMeta = originalComment.meta?.author;
  const avatarUrl = authorMeta?.photoUrl || getAvatarUrl(node.author, authorMeta?.photoUrl);
  
  return (
    <Card
      compact
      className={classList(
        'cursor-pointer transition-all hover:shadow-md',
        { 'ring-2 ring-warning': isChainMode }
      )}
      style={{ marginLeft: `${depth * 16}px` }}
      onClick={onNavigate}
    >
      <CardBody className="p-3">
        <div className="flex gap-2 mb-2">
          <Avatar 
            src={avatarUrl || undefined}
            alt={node.author}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="font-medium text-sm">{node.author}</span>
              <Badge variant="secondary" size="xs">
                {formatDate(node.createdAt, 'relative')}
              </Badge>
              {node.score !== 0 && (
                <Badge 
                  variant={node.score > 0 ? 'success' : 'error'} 
                  size="xs"
                >
                  {node.score > 0 ? '+' : ''}{node.score}
                </Badge>
              )}
            </div>
            <p className="text-sm text-base-content/80 break-words">{node.content}</p>
          </div>
        </div>
        
        {(node.children.length > 0 || subtreeSize > 1) && (
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-base-300">
            {node.children.length > 0 && (
              <Badge variant="info" size="xs">
                {node.children.length} {node.children.length === 1 ? 'reply' : 'replies'}
              </Badge>
            )}
            {subtreeSize > 1 && (
              <span className="text-xs text-base-content/60">
                {subtreeSize - 1} {subtreeSize - 1 === 1 ? 'reply' : 'replies'} in thread
              </span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

