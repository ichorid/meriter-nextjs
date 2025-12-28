'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { InviteInput } from '@/components/molecules/InviteInput/InviteInput';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface JoinTeamProps {
  className?: string;
  showLocalGroupsNote?: boolean;
  description?: string;
}

export function JoinTeam({ 
  className = '', 
  showLocalGroupsNote = false,
  description 
}: JoinTeamProps) {
  const tCommunities = useTranslations('communities');
  const [joinTeamExpanded, setJoinTeamExpanded] = useLocalStorage<boolean>('communities.joinTeamExpanded', true);

  const defaultDescription = tCommunities('joinTeamDescription');

  return (
    <div className={`bg-base-200/50 border border-base-content/5 rounded-2xl p-6 ${className}`}>
      <button
        onClick={() => setJoinTeamExpanded(!joinTeamExpanded)}
        className="flex items-center justify-between w-full mb-4 hover:opacity-80 transition-opacity"
      >
        <h3 className="text-lg font-semibold text-base-content">
          {tCommunities('joinTeam')}
        </h3>
        {joinTeamExpanded ? (
          <ChevronUp className="w-5 h-5 text-base-content/60" />
        ) : (
          <ChevronDown className="w-5 h-5 text-base-content/60" />
        )}
      </button>
      {joinTeamExpanded && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {description && (
            <p className="text-sm text-base-content/60">
              {description}
            </p>
          )}
          {!description && showLocalGroupsNote && (
            <p className="text-sm text-base-content/60">
              {defaultDescription}
            </p>
          )}
          <InviteInput />
          
          {/* Local Groups Notification */}
          {showLocalGroupsNote && (
            <div className="pt-6 border-t border-base-300 mt-2">
              <div className="flex flex-col items-start gap-1">
                {/* Title */}
                <div className="flex flex-row items-center pb-1.5 pr-5 gap-2.5">
                  <h2 className="text-[15px] leading-[120%] tracking-[0.374px] text-base-content/60">
                    {tCommunities('localGroups.title')}
                  </h2>
                </div>

                {/* Content */}
                <div className="flex flex-col items-center w-full py-5 gap-3">
                  {/* Note 1: Viewer role notification */}
                  <div className="flex flex-row justify-center items-center w-full">
                    <p className="text-[15px] leading-[130%] text-center tracking-[0.374px] text-base-content/60">
                      {tCommunities('localGroups.viewerNote')}
                    </p>
                  </div>

                  {/* Note 2: Contact note */}
                  <div className="flex flex-row justify-center items-center w-full">
                    <p className="text-[15px] leading-[130%] text-center tracking-[0.374px] text-base-content/60">
                      {tCommunities('localGroups.contactNote')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

