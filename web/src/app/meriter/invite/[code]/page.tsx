// Required for static export with dynamic routes
export async function generateStaticParams() {
    // Return empty array - dynamic routes will be handled client-side
    return [];
}

import { InvitePageClient } from './InvitePageClient';

interface InvitePageProps {
    params: Promise<{ code: string }>;
}

export default function InvitePage({ params }: InvitePageProps) {
    return <InvitePageClient params={params} />;
}

