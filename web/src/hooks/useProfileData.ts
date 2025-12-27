import { useWallets } from "@/hooks/api";
import { useInfiniteMyPublications } from "@/hooks/api/usePublications";
import { useInfiniteMyComments } from "@/hooks/api/useComments";
import { useInfiniteMyPolls } from "@/hooks/api/usePolls";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeArray } from "@/lib/utils/profileContent";
import { useMediaQuery } from "@/hooks/useMediaQuery";
import { useMemo } from "react";

/**
 * Hook to fetch all profile page data with infinite scroll support
 * (moved from useHomeData)
 */
export function useProfileData() {
    const { user } = useAuth();
    const isMobile = useMediaQuery("(max-width: 640px)");
    const pageSize = isMobile ? 10 : 20;

    // Fetch wallets
    const { data: wallets = [], isLoading: walletsLoading } = useWallets();

    // Fetch publications with infinite scroll
    const {
        data: publicationsData,
        isLoading: publicationsLoading,
        isFetching: publicationsFetching,
        fetchNextPage: fetchNextPublications,
        hasNextPage: hasNextPublications,
        isFetchingNextPage: isFetchingNextPublications,
    } = useInfiniteMyPublications(user?.id || "", pageSize);

    // Fetch polls with infinite scroll
    const {
        data: pollsData,
        isLoading: pollsLoading,
        fetchNextPage: fetchNextPolls,
        hasNextPage: hasNextPolls,
        isFetchingNextPage: isFetchingNextPolls,
    } = useInfiniteMyPolls(user?.id || "", pageSize);

    // Fetch user comments with infinite scroll
    const {
        data: commentsData,
        isLoading: commentsLoading,
        fetchNextPage: fetchNextComments,
        hasNextPage: hasNextComments,
        isFetchingNextPage: isFetchingNextComments,
    } = useInfiniteMyComments(user?.id || "", pageSize);

    // Flatten data from all pages and filter out projects
    const myPublications = useMemo(() => {
        return (publicationsData?.pages ?? []).flatMap((page) => {
            return Array.isArray(page) ? page : [];
        }).filter((pub: any) => {
            // Filter out projects: exclude items where isProject is true or postType is 'project'
            return !pub.isProject && pub.postType !== 'project';
        });
    }, [publicationsData?.pages]);

    const myComments = useMemo(() => {
        return (commentsData?.pages ?? []).flatMap((page) => {
            return page?.data || [];
        });
    }, [commentsData?.pages]);

    const myPolls = useMemo(() => {
        return (pollsData?.pages ?? []).flatMap((page) => {
            return page?.data || [];
        });
    }, [pollsData?.pages]);

    return {
        // Publications
        myPublications,
        publicationsLoading,
        publicationsFetching,
        fetchNextPublications,
        hasNextPublications,
        isFetchingNextPublications,

        // Comments
        myComments,
        commentsLoading,
        fetchNextComments,
        hasNextComments,
        isFetchingNextComments,

        // Polls
        myPolls,
        pollsLoading,
        fetchNextPolls,
        hasNextPolls,
        isFetchingNextPolls,

        // Wallets
        wallets: normalizeArray(wallets),
        walletsLoading,
    };
}

