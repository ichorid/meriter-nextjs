import { redirect } from 'next/navigation';

export default function Home() {
    // Redirect to profile - let the profile page handle auth checks
    redirect('/meriter/profile');
}

