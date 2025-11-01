import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/constants/queryKeys';

interface VersionResponse {
    version: string;
}

/**
 * Fetch backend version from API
 */
export function useVersion() {
    return useQuery({
        queryKey: queryKeys.version(),
        queryFn: async (): Promise<VersionResponse> => {
            return apiClient.get<VersionResponse>('/api/version');
        },
        staleTime: 5 * 60 * 1000, // Cache for 5 minutes since version rarely changes
        retry: 1, // Only retry once if it fails
    });
}

