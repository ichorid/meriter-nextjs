import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api/client';
import { queryKeys } from '@/lib/constants/queryKeys';

interface VersionResponse {
    version: string;
}

interface ApiVersionResponse {
    success: true;
    data: VersionResponse;
}

/**
 * Fetch backend version from API
 */
export function useVersion() {
    return useQuery({
        queryKey: queryKeys.version(),
        queryFn: async (): Promise<VersionResponse> => {
            const response = await apiClient.get<ApiVersionResponse>('/api/version');
            // ApiResponseInterceptor wraps the response, so extract from data
            return response.data || response;
        },
        staleTime: 0, // Always refetch on mount to get latest version
        refetchOnMount: true,
        refetchOnWindowFocus: true,
        retry: 1, // Only retry once if it fails
    });
}

