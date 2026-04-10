import { Suspense } from 'react';
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
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-base-content/60">
          Loading…
        </div>
      }
    >
      <PostPageClient communityId={id} slug={slug} />
    </Suspense>
  );
}
