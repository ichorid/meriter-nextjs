import { Metadata } from 'next';
import ProfilePageComponent from './ProfileClient';

export const metadata: Metadata = {
    title: 'Profile',
};

export default function Page() {
    return <ProfilePageComponent />;
}
