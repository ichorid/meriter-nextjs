import { PostPageClient } from './PostPageClient';

interface PostPageProps {
  params: Promise<{ id: string; slug: string }>;
}

// Required for static export with dynamic routes
export async function generateStaticParams() {
  // Return empty array - dynamic routes will be handled client-side
  return [];
}

export default async function PostPage({ params }: PostPageProps) {
  const { id, slug } = await params;
  return <PostPageClient communityId={id} slug={slug} />;
}
