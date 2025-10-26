import React from 'react';
import { MetricBar } from '@/components/molecules';

// Local Metrics type definition
interface Metrics {
  score?: number;
  thanks?: number;
  commentCount?: number;
}

export interface PublicationMetricsProps {
  metrics: Metrics;
  commentCount?: number;
}

export const PublicationMetrics: React.FC<PublicationMetricsProps> = ({
  metrics,
  commentCount = 0,
}) => {
  return (
    <div className="flex items-center justify-between pt-2">
      <MetricBar 
        upvotes={metrics.thanks || 0}
        downvotes={0}
        score={metrics.score || 0}
        compact
      />
      {commentCount > 0 && (
        <span className="text-sm text-base-content/60">
          {commentCount} comment{commentCount !== 1 ? 's' : ''}
        </span>
      )}
    </div>
  );
};
