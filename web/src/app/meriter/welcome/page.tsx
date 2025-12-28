import { Metadata } from 'next';
import WelcomePage from './WelcomeClient';

export const metadata: Metadata = {
    title: 'Welcome',
};

export default function Page() {
    return <WelcomePage />;
}
