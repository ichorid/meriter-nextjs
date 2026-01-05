import { Metadata } from 'next';
import PageMeriterLogin from './LoginClient';

export const metadata: Metadata = {
    title: 'Login',
};

export default function Page() {
    return <PageMeriterLogin />;
}
