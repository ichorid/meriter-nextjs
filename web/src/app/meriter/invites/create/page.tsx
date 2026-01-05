import { Metadata } from 'next';
import CreateInvitePage from './CreateInviteClient';

export const metadata: Metadata = {
    title: 'Create Invite',
};

export default function Page() {
    return <CreateInvitePage />;
}
