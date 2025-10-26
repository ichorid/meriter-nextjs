import React, { useState } from 'react';
import { Avatar, Badge, Heading } from '@/components/atoms';

// Local Community type definition
interface Community {
  id: string;
  name: string;
  description?: string;
  avatarUrl?: string;
  memberCount: number;
  isActive: boolean;
  needsSetup?: boolean;
  hashtags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CommunityCardProps {
  community: Community;
  onClick?: () => void;
  size?: 'sm' | 'md' | 'lg';
  isAdmin?: boolean;
}

export const CommunityCard: React.FC<CommunityCardProps> = ({ 
  community, 
  onClick, 
  size = 'md',
  isAdmin = false
}) => {
  const avatarSize = size === 'sm' ? 'xs' : size === 'lg' ? 'lg' : 'md';
  const [showTooltip, setShowTooltip] = useState(false);
  const needsSetup = community.needsSetup !== undefined ? community.needsSetup : !community.isActive;
  
  const handleClick = (e: React.MouseEvent) => {
    if (needsSetup) {
      if (isAdmin) {
        // Admin: navigate to settings if onClick is not provided
        if (onClick) {
          onClick();
        } else {
          window.location.href = `/meriter/communities/${community.id}/settings`;
        }
      } else {
        // Non-admin: show tooltip, don't navigate
        e.stopPropagation();
        setShowTooltip(true);
        setTimeout(() => setShowTooltip(false), 3000);
      }
    } else {
      // Normal navigation
      if (onClick) {
        onClick();
      }
    }
  };
  
  return (
    <div className="relative">
      {showTooltip && (
        <div className="absolute top-0 left-0 right-0 bg-warning text-warning-content p-2 rounded-t-lg z-10">
          <div className="flex items-center gap-2">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <span className="text-xs">Community is unconfigured</span>
          </div>
        </div>
      )}
      {needsSetup && isAdmin && (
        <div className="alert alert-warning mb-2 py-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">This community is unconfigured. Click to configure</span>
        </div>
      )}
      {needsSetup && !isAdmin && (
        <div className="alert alert-info mb-2 py-1">
          <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <span className="text-xs">This community is unconfigured. Community admin will configure it soon</span>
        </div>
      )}
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg hover:bg-base-200 transition-colors ${
          onClick || needsSetup ? 'cursor-pointer' : ''
        }`}
        onClick={handleClick}
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
      </div>
    </div>
  );
};
