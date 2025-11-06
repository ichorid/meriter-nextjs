import { useMemo } from 'react';
import { useCommentDetails } from '@/hooks/api/useComments';

export interface UseCommentRecipientOptions {
    commentId: string;
    showDetailsPopup: boolean;
    beneficiaryMeta?: {
        name: string;
        photoUrl?: string;
    } | null;
}

export interface CommentRecipient {
    recipientName?: string;
    recipientAvatar?: string;
    commentDetails?: ReturnType<typeof useCommentDetails>['data'];
}

export function useCommentRecipient({
    commentId,
    showDetailsPopup,
    beneficiaryMeta,
}: UseCommentRecipientOptions): CommentRecipient {
    // Fetch comment details when popup is open
    const { data: commentDetails } = useCommentDetails(showDetailsPopup ? commentId : '');

    const { recipientName, recipientAvatar } = useMemo(() => {
        let name: string | undefined;
        let avatar: string | undefined;
        
        if (commentDetails?.beneficiary) {
            name = commentDetails.beneficiary.name;
            avatar = commentDetails.beneficiary.photoUrl;
        } else if (beneficiaryMeta) {
            name = beneficiaryMeta.name;
            avatar = beneficiaryMeta.photoUrl;
        }

        return {
            recipientName: name,
            recipientAvatar: avatar,
        };
    }, [commentDetails, beneficiaryMeta]);

    return {
        recipientName,
        recipientAvatar,
        commentDetails,
    };
}

