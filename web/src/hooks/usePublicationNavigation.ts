// Publication navigation and routing logic
import { useRouter } from 'next/navigation';

export interface UsePublicationNavigationProps {
  slug: string;
  communityId: string; // Internal community ID (required)
  isDetailPage?: boolean;
  myId?: string;
  authorId: string; // Internal author ID (required)
}

export function usePublicationNavigation({
  slug,
  communityId,
  isDetailPage,
  myId,
  authorId,
}: UsePublicationNavigationProps) {
  const router = useRouter();
  
  // Create unique post ID
  const postId = slug;
  
  // Navigate to post detail page
  const navigateToDetail = () => {
    if (!isDetailPage && communityId && slug) {
      router.push(`/meriter/communities/${communityId}/posts/${slug}`);
    }
  };
  
  // Navigate to community page
  const navigateToCommunity = (id?: string) => {
    const targetId = id || communityId;
    if (targetId) {
      router.push(`/meriter/communities/${targetId}`);
    }
  };
  
  // Handle comment counter click
  const handleCommentClick = () => {
    if (!isDetailPage) {
      navigateToDetail();
    }
    // On detail page, comment counter is visible but not clickable
  };
  
  return {
    navigateToDetail,
    navigateToCommunity,
    handleCommentClick,
  };
}
