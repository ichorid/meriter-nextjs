import { Metadata } from 'next';
import { Suspense } from 'react';
import WelcomePage from './WelcomeClient';
import { Loader2 } from 'lucide-react';

export const metadata: Metadata = {
    title: 'Welcome',
};

export default function Page() {
    return (
        <Suspense
            fallback={
                <div className="min-h-svh bg-base-100 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-base-content/50" />
                </div>
            }
        >
            <WelcomePage />
        </Suspense>
    );
}
