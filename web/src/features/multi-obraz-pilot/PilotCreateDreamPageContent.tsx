import { CreateDreamForm } from '@/features/multi-obraz-pilot/CreateDreamForm';
import { getMultiObrazMessages, getPilotServerLocale } from '@/lib/i18n/pilot-messages-server';

export async function PilotCreateDreamPageContent() {
  const locale = await getPilotServerLocale();
  const m = getMultiObrazMessages(locale);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-extrabold tracking-tight text-white">{m.heroCta}</h1>
      <CreateDreamForm />
    </div>
  );
}
