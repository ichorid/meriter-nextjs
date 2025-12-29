import { Metadata } from 'next';
import AboutPage from './AboutClient';

export const metadata: Metadata = {
    title: 'About',
};

export default function Page() {
    return <AboutPage />;
}
