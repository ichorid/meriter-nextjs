import { redirect } from 'next/navigation';

export default function Home() {
    // Serverful Next.js: simple server-side redirect.
    // Auth checks are handled by the target route (or client auth provider).
    redirect('/meriter/profile');
}

