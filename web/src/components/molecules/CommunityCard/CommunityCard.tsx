import React from 'react';
import { Avatar, Badge, Heading } from '@/components/atoms';

// Local Community type definition
interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  isActive: boolean;
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCardProps {
  community: Community;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
}

export const CommunityCard: React.FC<CommunityCardProps> = ({ 
  community, 
  onClick, 
  size = 'md' 
}) => {
  const avatarSize = size === 'sm' ? 'xs' : size === 'lg' ? 'lg' : 'md';
  
  return (
    <div 
      className={`flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors ${
        onClick ? 'cursor-pointer' : ''
      }`}
      onClick={onClick}
    >
      <Avatar 
        src={community.avatarUrl} 
        alt={community.name} 
        size={avatarSize}
        fallback={community.name.charAt(0).toUpperCase()}
      />
      <div className="flex-1 min-w-0">
        <Heading as="h4" className="text-sm font-semibold truncate">
          {community.name}
        </Heading>
        {community.description && (
          <p className="text-xs text-base-content/60 truncate">
            {community.description}
          </p>
        )}
        {community.hashtags && community.hashtags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-1">
            {community.hashtags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="secondary" size="xs">
                #{tag}
              </Badge>
            ))}
          </div>
        )}
      </div>
      {!community.isActive && (
        <Badge variant="error" size="sm">Inactive</Badge>
      )}
    </div>
  );
};
