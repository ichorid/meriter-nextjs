import { Metadata } from 'next';
import ProfilePollsPage from './Client';

export const metadata: Metadata = {
  title: 'Polls',
};

export default function Page() {
  return <ProfilePollsPage />;
}
