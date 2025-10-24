import { useState } from "react";
import { swr } from "@lib/swr";
import Axios from "axios";
import { useTranslations } from 'next-intl';
const { round } = Math;

export const useComments = (
    forTransaction: boolean,
    publicationSlug: string,
    transactionId: string,
    getCommentsApiPath: string,
    getFreeBalanceApiPath: string,
    balance: any,
    updBalance: any,
    plusGiven: number,
    minusGiven: number,
    activeCommentHook: any,
    onlyPublication = false
) => {
    const t = useTranslations('comments');
    const uid = transactionId || publicationSlug;
    const [showComments, setShowComments] = useState(!!onlyPublication);
    const [comment, setCommentW] = useState("");
    const setComment = (c: string) => {
        setCommentW(c);
        setError("");
    };

    const [plusSign, setPlusSign] = useState(true);
    const [delta, setDelta] = useState(0);
    const [error, setError] = useState("");

    const [comments] = swr(getCommentsApiPath, [], {
        revalidateOnFocus: false,
    });

    const [free] = swr(getFreeBalanceApiPath, {}, {
        revalidateOnFocus: false,
    });

    const currentPlus = round(
        (plusGiven + (delta as any)) || 0
    );
    const currentMinus = round(
        (minusGiven + (delta as any)) || 0
    );

    const showPlus = () => {
        setError("");
        setDelta(1);
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
    };
    const showMinus = () => {
        setError("");
        setDelta(-1);
        setShowComments(true);
        if (activeCommentHook) {
            activeCommentHook[1](uid);
        }
    };

    const formCommentProps = {
        uid,
        hasPoints: (free?.plus || 0) > 0,
        comment,
        setComment,
        amount: Math.abs(delta),
        setAmount: setDelta,
        free: free?.plus || 0,
        maxPlus: free?.plus || 0,
        maxMinus: free?.minus || 0,
        commentAdd: async (directionPlus: boolean) => {
            try {
                const response = await Axios.post("/api/rest/transactions", {
                    amount: Math.abs(delta),
                    directionPlus,
                    comment: comment.trim(),
                    forPublicationSlug: publicationSlug,
                    forTransactionId: transactionId,
                });
                if (response.data.success) {
                    setComment("");
                    setDelta(0);
                    setError("");
                    updBalance();
                    if (activeCommentHook) {
                        activeCommentHook[1](null);
                    }
                }
            } catch (err: any) {
                setError(err.response?.data?.message || t('errorCommenting'));
            }
        },
        error,
        onClose: () => {
            if (activeCommentHook) {
                activeCommentHook[1](null);
            }
        },
    };

    return {
        comments,
        free,
        currentPlus,
        currentMinus,
        showPlus,
        showMinus,
        showComments,
        setShowComments,
        formCommentProps,
    };
};