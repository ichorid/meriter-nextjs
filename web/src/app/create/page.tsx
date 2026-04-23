import { redirect } from 'next/navigation';
import { isPilotClientMode } from '@/config/pilot';
import { generatePilotCreateDreamMetadata } from '@/features/multi-obraz-pilot/pilot-create-metadata';
import { PilotCreateDreamPageContent } from '@/features/multi-obraz-pilot/PilotCreateDreamPageContent';

export async function generateMetadata() {
  return generatePilotCreateDreamMetadata();
}

export default async function PilotCreatePage() {
  if (!isPilotClientMode()) {
    redirect('/meriter/profile');
  }
  return <PilotCreateDreamPageContent />;
}
