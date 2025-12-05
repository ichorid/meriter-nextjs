'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Users } from 'lucide-react';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';
import { PageHeader } from '@/components/ui/PageHeader';
import { VersionDisplay } from '@/components/organisms/VersionDisplay';
import { useTranslations } from 'next-intl';
import { useAllLeads } from '@/hooks/api/useUsers';
import { InfoCard } from '@/components/ui/InfoCard';
import { BrandAvatar } from '@/components/ui/BrandAvatar';
import { CardSkeleton } from '@/components/ui/LoadingSkeleton';
import { SearchInput } from '@/components/molecules/SearchInput';
import { routes } from '@/lib/constants/routes';

const AboutPage = () => {
    const t = useTranslations('common');
    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState('');
    
    // Fetch leads
    const { data: leadsData, isLoading: leadsLoading } = useAllLeads({ pageSize: 100 });
    const leads = leadsData?.data || [];
    
    // Filter leads based on search query
    const filteredLeads = useMemo(() => {
        if (!searchQuery.trim()) {
            return leads;
        }
        
        const query = searchQuery.toLowerCase();
        return leads.filter((lead) => {
            const displayName = (lead.displayName || '').toLowerCase();
            const username = (lead.username || '').toLowerCase();
            const bio = (lead.profile?.bio || '').toLowerCase();
            
            return displayName.includes(query) || 
                   username.includes(query) || 
                   bio.includes(query);
        });
    }, [leads, searchQuery]);

    return (
        <AdaptiveLayout>
            <div className="flex flex-col min-h-screen bg-base-100">
                <PageHeader title={t('about')} showBack={true} />

                <div className="p-4 space-y-6">
                    <div className="space-y-4">
                        <h2 className="text-xl font-semibold text-brand-text-primary dark:text-base-content">
                            About
                        </h2>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. 
                            Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. 
                            Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.
                        </p>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum. 
                            Sed ut perspiciatis unde omnis iste natus error sit voluptatem accusantium doloremque laudantium, 
                            totam rem aperiam, eaque ipsa quae ab illo inventore veritatis et quasi architecto beatae vitae dicta sunt explicabo.
                        </p>
                        <p className="text-base text-brand-text-secondary dark:text-base-content/80">
                            Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut fugit, sed quia consequuntur magni dolores eos 
                            qui ratione voluptatem sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit amet, 
                            consectetur, adipisci velit, sed quia non numquam eius modi tempora incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
                        </p>
                    </div>

                    {/* Leads Section */}
                    <div id="leads" className="pt-6 border-t border-base-300">
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold text-brand-text-primary">
                                Leads
                            </h2>
                        </div>

                        {leads.length > 0 && (
                            <div className="mb-4">
                                <SearchInput
                                    placeholder="Search leads by name, username, or bio..."
                                    value={searchQuery}
                                    onSearch={setSearchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full"
                                />
                            </div>
                        )}

                        {leadsLoading ? (
                            <div className="space-y-3">
                                <CardSkeleton />
                                <CardSkeleton />
                                <CardSkeleton />
                            </div>
                        ) : filteredLeads.length > 0 ? (
                            <div className="space-y-3">
                                {filteredLeads.map((lead) => (
                                    <InfoCard
                                        key={lead.id}
                                        title={lead.displayName || lead.username || 'Unknown User'}
                                        subtitle={lead.profile?.bio || lead.username ? `@${lead.username}` : undefined}
                                        icon={
                                            <BrandAvatar
                                                src={lead.avatarUrl}
                                                fallback={lead.displayName || lead.username || 'User'}
                                                size="sm"
                                                className="bg-transparent"
                                            />
                                        }
                                        onClick={() => router.push(routes.userProfile(lead.id))}
                                    />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 text-base-content/60">
                                <Users className="w-12 h-12 mx-auto mb-3 text-base-content/40" />
                                <p className="font-medium">
                                    {searchQuery ? 'No leads found matching your search' : 'No leads found'}
                                </p>
                                <p className="text-sm mt-1">
                                    {searchQuery ? 'Try a different search term' : 'No leads available'}
                                </p>
                            </div>
                        )}
                    </div>

                    <div className="pt-6 border-t border-base-300">
                        <h3 className="text-lg font-semibold text-brand-text-primary dark:text-base-content mb-4">
                            Version Information
                        </h3>
                        <VersionDisplay className="justify-start" />
                    </div>
                </div>
            </div>
        </AdaptiveLayout>
    );
};

export default AboutPage;

