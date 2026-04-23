import { redirect } from 'next/navigation';
import { routes } from '@/lib/constants/routes';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata() {
  return { title: 'Events' };
}

export default async function ProjectEventsPage({ params }: PageProps) {
  const { id } = await params;
  redirect(`${routes.project(id)}?feedTab=events`);
}
