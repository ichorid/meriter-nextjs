import type { User } from '@/types/api-v1';

/**
 * Extended User type for leads with enriched data from getAllLeads endpoint
 */
export interface EnrichedLead extends User {
    totalMerits?: number;
    leadCommunities?: string[];
}

