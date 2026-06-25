import { redirect } from 'next/navigation';
import { config } from '@/config';

export default function HomePage() {
  if (config.defaultCommunityId) {
    redirect(`/c/${config.defaultCommunityId}/feed`);
  }
  redirect('/login');
}
