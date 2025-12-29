import { PostPageClient } from './PostPageClient';

interface PostPageProps {
  params: Promise<{ id: string; slug: string }>;
}

export async function generateMetadata({ params }: PostPageProps) {
  return {
    title: 'Post',
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id, slug } = await params;
  return <PostPageClient communityId={id} slug={slug} />;
}
