import { redirect } from 'next/navigation';

export default function Home() {
    // Redirect to meriter main page
    redirect('/meriter/balance');
}

