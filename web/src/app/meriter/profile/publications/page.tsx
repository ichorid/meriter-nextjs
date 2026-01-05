import { Metadata } from 'next';
import ProfilePublicationsPage from './Client';

export const metadata: Metadata = {
  title: 'Publications',
};

export default function Page() {
  return <ProfilePublicationsPage />;
}
