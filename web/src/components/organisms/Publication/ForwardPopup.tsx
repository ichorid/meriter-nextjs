'use client';

import React, { useState, useMemo } from 'react';
import { X, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { useCommunity, useCommunities } from '@/hooks/api';
import { useProposeForward, useForward } from '@/hooks/api/usePublications';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/contexts/AuthContext';

interface ForwardPopupProps {
  publicationId: string;
  communityId: string;
  isLead: boolean;
  onClose: () => void;
}

export const ForwardPopup: React.FC<ForwardPopupProps> = ({
  publicationId,
  communityId,
  isLead,
  onClose,
}) => {
  const t = useTranslations('feed');
  const addToast = useToastStore((state) => state.addToast);
  const proposeForward = useProposeForward();
  const forward = useForward();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get source community
  const { data: sourceCommunity } = useCommunity(communityId);

  // Get all communities to find marathon-of-good and future-vision
  const { data: communitiesData } = useCommunities();

  // Get target communities from typeTag
  const targetCommunities = useMemo(() => {
    if (!communitiesData?.data) return [];
    
    return communitiesData.data
      .filter((c: any) => c.typeTag === 'marathon-of-good' || c.typeTag === 'future-vision')
      .map((c: any) => ({
        id: c.id,
        name: c.name,
        typeTag: c.typeTag,
      }));
  }, [communitiesData?.data]);

  const handleSubmit = async () => {
    if (!selectedTarget) {
      addToast('Please select a target group', 'error');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isLead) {
        await forward.mutateAsync({
          publicationId,
          targetCommunityId: selectedTarget,
        });
        addToast('Post forwarded successfully', 'success');
      } else {
        await proposeForward.mutateAsync({
          publicationId,
          targetCommunityId: selectedTarget,
        });
        addToast('Forward proposal submitted. Waiting for lead approval.', 'success');
      }
      onClose();
    } catch (error: any) {
      addToast(error?.message || 'Failed to forward post', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const forwardCost = sourceCommunity?.settings?.forwardCost ?? 1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-background rounded-xl p-6 w-full max-w-md mx-4 shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {isLead ? 'Forward Post' : 'Propose Forward'}
          </h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X size={16} />
          </Button>
        </div>

        <p className="text-sm text-muted-foreground mb-4">
          {isLead
            ? 'Select a target group to forward this post to:'
            : 'Select a target group to propose forwarding this post to:'}
        </p>

        {forwardCost > 0 && !isLead && (
          <p className="text-sm text-warning mb-4">
            This will cost {forwardCost} quota.
          </p>
        )}

        <div className="space-y-2 mb-6">
          {targetCommunities.map((community) => (
            <button
              key={community.id}
              onClick={() => setSelectedTarget(community.id)}
              className={`w-full p-4 rounded-lg border-2 text-left transition-colors ${
                selectedTarget === community.id
                  ? 'border-primary bg-primary/10'
                  : 'border-border hover:border-primary/50'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{community.name}</span>
                {selectedTarget === community.id && (
                  <ArrowRight size={16} className="text-primary" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedTarget || isSubmitting}
          >
            {isSubmitting ? 'Processing...' : isLead ? 'Forward' : 'Propose'}
          </Button>
        </div>
      </div>
    </div>
  );
};

