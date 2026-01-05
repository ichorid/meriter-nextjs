import { Metadata } from 'next';
import ProfileProjectsPage from './Client';

export const metadata: Metadata = {
    title: 'Projects',
};

export default function Page() {
    return <ProfileProjectsPage />;
}
