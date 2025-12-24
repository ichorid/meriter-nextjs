import { PostPageClient } from './PostPageClient';

interface PostPageProps {
  params: { id: string; slug: string };
}

// Required for static export with dynamic routes
export async function generateStaticParams(): Promise<Array<{ id: string; slug: string }>> {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default function PostPage({ params }: PostPageProps) {
  const { id, slug } = params;
  return <PostPageClient communityId={id} slug={slug} />;
}
