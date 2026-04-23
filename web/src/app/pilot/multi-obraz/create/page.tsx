import { generatePilotCreateDreamMetadata } from '@/features/multi-obraz-pilot/pilot-create-metadata';
import { PilotCreateDreamPageContent } from '@/features/multi-obraz-pilot/PilotCreateDreamPageContent';

export async function generateMetadata() {
  return generatePilotCreateDreamMetadata();
}

export default async function PilotMultiObrazCreatePage() {
  return <PilotCreateDreamPageContent />;
}
