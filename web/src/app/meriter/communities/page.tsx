import { Metadata } from 'next';
import CommunitiesPage from './CommunitiesClient';

export const metadata: Metadata = {
    title: 'Communities',
};

export default function Page() {
    return <CommunitiesPage />;
}
