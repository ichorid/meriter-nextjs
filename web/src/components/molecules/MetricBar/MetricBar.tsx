import React from 'react';
import { Badge, Icon } from '@/components/atoms';

export interface MetricBarProps {
  upvotes: number;
  downvotes: number;
  score: number;
  showIcons?: boolean;
  compact?: boolean;
}

export const MetricBar: React.FC<MetricBarProps> = ({ 
  upvotes, 
  downvotes, 
  score, 
  showIcons = true,
  compact = false,
}) => {
  return (
    <div className={`flex items-center gap-2 ${compact ? 'text-sm' : ''}`}>
      <div className="flex items-center gap-1">
        {showIcons && <Icon name="thumb_up" size={16} />}
        <Badge variant="success" size="sm" className="min-w-[2rem] justify-center">
          +{upvotes}
        </Badge>
      </div>
      
      <div className="flex items-center gap-1">
        {showIcons && <Icon name="thumb_down" size={16} />}
        <Badge variant="error" size="sm" className="min-w-[2rem] justify-center">
          -{downvotes}
        </Badge>
      </div>
      
      <Badge 
        variant={score >= 0 ? 'primary' : 'error'} 
        size="sm" 
        className="min-w-[3rem] justify-center font-bold"
      >
        {score > 0 ? '+' : ''}{score}
      </Badge>
    </div>
  );
};
