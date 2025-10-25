// Publication navigation and routing logic
import { useRouter } from 'next/navigation';

export interface UsePublicationNavigationProps {
  slug: string;
  tgChatId?: string;
  isDetailPage?: boolean;
  myId?: string;
  tgAuthorId?: string;
  activeSlider?: string | null;
  setActiveSlider?: (slider: string | null) => void;
}

export function usePublicationNavigation({
  slug,
  tgChatId,
  isDetailPage,
  myId,
  tgAuthorId,
  activeSlider,
  setActiveSlider,
}: UsePublicationNavigationProps) {
  const router = useRouter();
  
  // Create unique post ID
  const postId = slug;
  
  // Navigate to post detail page
  const navigateToDetail = () => {
    if (!isDetailPage && tgChatId && slug) {
      router.push(`/meriter/communities/${tgChatId}/posts/${slug}`);
    }
  };
  
  // Navigate to community page
  const navigateToCommunity = (communityId: string) => {
    if (communityId) {
      router.push(`/meriter/communities/${communityId}`);
    }
  };
  
  // Handle click on publication container
  const handleContainerClick = (e: React.MouseEvent) => {
    if (
      activeSlider === postId &&
      myId !== tgAuthorId &&
      !(e.target as any)?.className?.match("clickable")
    ) {
      setActiveSlider && setActiveSlider(null);
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
    handleContainerClick,
    handleCommentClick,
  };
}
