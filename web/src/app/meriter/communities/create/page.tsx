import { Metadata } from 'next';
import CreateCommunityPage from './CreateCommunityClient';

export const metadata: Metadata = {
    title: 'Create Community',
};

export default function Page() {
    return <CreateCommunityPage />;
}
