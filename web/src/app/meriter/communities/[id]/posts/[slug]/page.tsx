import { PostPageClient } from './PostPageClient';

interface PostPageProps {
  params: { id: string; slug: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string; slug: string }>> {
  return [{ id: '_', slug: '_' }];
}

export default function PostPage({ params }: PostPageProps) {
  const { id, slug } = params;
  return <PostPageClient communityId={id} slug={slug} />;
}
