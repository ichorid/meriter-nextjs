import { Metadata } from 'next';
import ProfileCommentsPage from './CommentsClient';

export const metadata: Metadata = {
    title: 'Comments',
};

export default function Page() {
    return <ProfileCommentsPage />;
}
