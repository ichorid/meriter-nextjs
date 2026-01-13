'use client';

import React, { useState, useMemo } from 'react';
import { X, ArrowRight, Search } from 'lucide-react';
import { Button } from '@/components/ui/shadcn/button';
import { Input } from '@/components/ui/shadcn/input';
import { useUserCommunities } from '@/hooks/useUserCommunities';
import { useProposeForward, useForward } from '@/hooks/api/usePublications';
import { useToastStore } from '@/shared/stores/toast.store';
import { useTranslations } from 'next-intl';
import { BottomPortal } from '@/shared/components/bottom-portal';

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
  const tCommunities = useTranslations('communities');
  const addToast = useToastStore((state) => state.addToast);
  const proposeForward = useProposeForward();
  const forward = useForward();
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Get user's communities
  const { communities: allCommunities, isLoading: communitiesLoading } = useUserCommunities();

  // Filter out source community and group into special and team communities
  const { specialCommunities, teamCommunities } = useMemo(() => {
    const filtered = allCommunities.filter((c) => c.id !== communityId);
    
    const special: typeof filtered = [];
    const teams: typeof filtered = [];

    filtered.forEach((community) => {
      const isSpecial = 
        community.typeTag === 'marathon-of-good' || 
        community.typeTag === 'future-vision' || 
        community.typeTag === 'team-projects' || 
        community.typeTag === 'support';
      
      if (isSpecial) {
        special.push(community);
      } else {
        teams.push(community);
      }
    });

    // Sort special communities: marathon-of-good, future-vision, team-projects, support
    special.sort((a, b) => {
      const order: Record<string, number> = {
        'marathon-of-good': 1,
        'future-vision': 2,
        'team-projects': 3,
        'support': 4,
      };
      return (order[a.typeTag || ''] || 999) - (order[b.typeTag || ''] || 999);
    });

    return {
      specialCommunities: special,
      teamCommunities: teams,
    };
  }, [allCommunities, communityId]);

  // Filter communities by search query
  const filterCommunities = (communities: typeof allCommunities) => {
    if (!searchQuery.trim()) return communities;
    const query = searchQuery.toLowerCase().trim();
    return communities.filter((c) => c.name.toLowerCase().includes(query));
  };

  const filteredSpecialCommunities = filterCommunities(specialCommunities);
  const filteredTeamCommunities = filterCommunities(teamCommunities);

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

  return (
    <BottomPortal>
      <div className="fixed inset-0 z-50 pointer-events-auto flex items-center justify-center">
        <div 
          className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity -z-10" 
          onClick={onClose}
        />
        <div className="relative z-10">
          <div className="bg-background rounded-xl p-6 w-full max-w-md mx-4 shadow-lg max-h-[80vh] flex flex-col">
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

            {/* Search input */}
            <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" size={16} />
            <Input
              type="text"
              placeholder={tCommunities('searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10"
            />
          </div>
            </div>

            <p className="text-sm text-muted-foreground mb-4">
          {isLead
            ? 'Select a target group to forward this post to:'
            : 'Select a target group to propose forwarding this post to:'}
            </p>

            {/* Communities list with scrolling */}
            <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {/* Special Communities Section */}
          {filteredSpecialCommunities.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {tCommunities('specialCommunities')}
              </h3>
              <div className="space-y-2">
                {filteredSpecialCommunities.map((community) => (
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
            </div>
          )}

          {/* Team Communities Section */}
          {filteredTeamCommunities.length > 0 && (
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 px-1">
                {tCommunities('yourCommunities')}
              </h3>
              <div className="space-y-2">
                {filteredTeamCommunities.map((community) => (
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
            </div>
          )}

          {!communitiesLoading && filteredSpecialCommunities.length === 0 && filteredTeamCommunities.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              {searchQuery ? 'No communities found' : 'No communities available'}
            </p>
          )}
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
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
      </div>
    </BottomPortal>
  );
};
