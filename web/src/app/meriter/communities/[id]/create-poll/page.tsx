import { CreatePollPageClient } from './CreatePollPageClient';

interface CreatePollPageProps {
  params: { id: string };
}

// Required for static export with dynamic routes
// Return a placeholder to satisfy static export requirements
// Actual routing will be handled client-side
export async function generateStaticParams(): Promise<Array<{ id: string }>> {
  return [{ id: '_' }];
}

export default function CreatePollPage({ params }: CreatePollPageProps) {
  const { id } = params;
  return <CreatePollPageClient communityId={id} />;
}


