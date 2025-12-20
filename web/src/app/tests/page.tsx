"use client";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { SimpleStickyHeader } from '@/components/organisms/ContextTopBar/ContextTopBar';
import { AdaptiveLayout } from '@/components/templates/AdaptiveLayout';

export default function TestsPage() {
    const router = useRouter();
    return (
        <AdaptiveLayout>
            <SimpleStickyHeader
                title="Test Suite"
                showBack={true}
                onBack={() => router.push('/meriter/profile')}
            />
            <div className="p-4 space-y-4">
                <h1 className="text-xl font-bold mb-4">Available Tests</h1>
                <div className="grid gap-4">
                    <Link href="/tests/authn" className="block p-4 border rounded-lg hover:bg-base-200 transition-colors">
                        <h2 className="font-semibold text-lg">WebAuthn Debugger</h2>
                        <p className="text-sm text-base-content/70">
                            Test full cycle Passkey authentication: Register &rarr; Login.
                            View detailed output logs.
                        </p>
                    </Link>
                </div>
            </div>
        </AdaptiveLayout>
    );
}
