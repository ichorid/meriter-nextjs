// Required for static export with dynamic routes
export async function generateStaticParams() {
    // Return empty array - dynamic routes will be handled client-side
    return [];
}

import { UserProfilePageClient } from './UserProfilePageClient';

export default function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  return <UserProfilePageClient params={params} />;
}

