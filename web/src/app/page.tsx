import { redirect } from 'next/navigation';

export default function Home() {
    // Redirect to home - let the home page handle auth checks
    redirect('/meriter/home');
}

