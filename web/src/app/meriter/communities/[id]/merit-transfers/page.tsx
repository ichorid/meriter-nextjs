import { MeritTransfersByContextPage } from '@/features/merit-transfer/pages/MeritTransfersByContextPage';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return {
    title: 'Merit transfers',
  };
}

export default async function CommunityMeritTransfersPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <MeritTransfersByContextPage
      communityContextId={id}
      backHref={routes.community(id)}
      titleKey="pageTitleCommunity"
    />
  );
}
