import React from 'react';
import { MainLayout } from '@/components/templates';
import { Card, CardBody, Avatar, Button, Badge } from '@/components/atoms';
import type { Community } from '@meriter/shared-types';

export interface CommunityLayoutProps {
  community: Community;
  children: React.ReactNode;
  actions?: React.ReactNode;
  sidebar?: React.ReactNode;
}

export const CommunityLayout: React.FC<CommunityLayoutProps> = ({
  community,
  children,
  actions,
  sidebar,
}) => {
  return (
    <MainLayout showNavigation>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Community Header */}
        <Card>
          <CardBody>
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <Avatar src={community.avatarUrl} alt={community.name} size="xl" />
              <div className="flex-1">
                <h1 className="text-3xl font-bold">{community.name}</h1>
                {community.description && (
                  <p className="text-base-content/70 mt-2">{community.description}</p>
                )}
                {community.hashtags && community.hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {community.hashtags.map((tag) => (
                      <Badge key={tag} variant="secondary" size="sm">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {actions && <div className="flex gap-2">{actions}</div>}
            </div>
          </CardBody>
        </Card>
        
        {/* Content */}
        <div className="flex gap-6">
          <div className="flex-1 space-y-6">{children}</div>
          {sidebar && (
            <aside className="w-80 hidden lg:block">
              <div className="sticky top-4 space-y-4">{sidebar}</div>
            </aside>
          )}
        </div>
      </div>
    </MainLayout>
  );
};
