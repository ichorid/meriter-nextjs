import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Events' };
}

export default async function CommunityEventsPage({ params }: PageProps) {
  const { id } = await params;
  const base = routes.community(id);
  redirect(`${base}?feedTab=events`);
}
