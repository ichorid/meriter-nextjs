import { TelegramLoginPanel } from '@/components/shell';

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-4 safe-area-pb pt-[env(safe-area-inset-top)]">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-stitch-border bg-stitch-surface p-5 shadow-lg sm:p-8">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-extrabold tracking-tight">Meriter</h1>
          <p className="text-sm text-stitch-muted">
            Войдите через Telegram, чтобы участвовать в сообществе и управлять заслугами.
          </p>
        </div>
        <TelegramLoginPanel />
      </div>
    </div>
  );
}
