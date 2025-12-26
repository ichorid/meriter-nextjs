import { PostPageClient } from './PostPageClient';

interface PostPageProps {
  params: { id: string; slug: string };
}

export default function PostPage({ params }: PostPageProps) {
  const { id, slug } = params;
  return <PostPageClient communityId={id} slug={slug} />;
}
