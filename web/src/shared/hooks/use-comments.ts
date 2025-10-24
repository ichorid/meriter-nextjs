import { useState } from "react";
import { swr } from "@lib/swr";
import Axios from "axios";
import { useTranslations } from 'next-intl';
const { round } = Math;

export const useComments = (
    forTransaction: boolean,
    publicationSlug,
    transactionId,
    getCommentsApiPath,
    getFreeBalanceApiPath,
    balance,
    updBalance,
    plusGiven,
    minusGiven,
    activeCommentHook,
    onlyPublication = false
) => {
    const t = useTranslations('comments');
    const uid = transactionId || publicationSlug;
    const [showComments, setShowComments] = useState(!!onlyPublication);
    const [comment, setCommentW] = useState("");
    const setComment = (c) => {
        setCommentW(c);
        setError("");
    };

    const [plusSign, setPlusSign] = useState(true);
    const [delta, setDelta] = useState(0);
    const [deltaPlus, setDeltaPlus] = useState(0);
    const [deltaMinus, setDeltaMinus] = useState(0);
    const [comments, upd] = swr(() => showComments && getCommentsApiPath, [], {
        key: "transactions",
    });
    
    // Ensure comments is always an array
    const safeComments = comments || [];
    const [free, updFree] = swr(getFreeBalanceApiPath, 0, { key: "free" });
    const [error, setError] = useState("");
    const maxPlus = free + balance;
    const maxMinus = balance;
    const hasPoints = maxPlus > 0;
    const [amount, setAmount] = useState(Math.min(1, maxPlus));
    const absAmount = Math.abs(amount);

    const showPlus = () => {
        setError("");
        setAmount(1);
        setPlusSign(true);
        setShowComments(true);
        setActiveComment(uid);
    };
    const showMinus = () => {
        setAmount(-1);
        setPlusSign(false);
        setShowComments(true);
        setActiveComment(uid);
    };
    const [activeComment, setActiveComment] = activeCommentHook;

    const commentAdd = (plusSignRewrite: boolean | undefined = undefined) => {
        if (!comment) return setError(t('enterComment'));
        if (!amount) return setError(t('enterPositiveAmount'));

        setDelta(delta + (plusSign ? absAmount : -absAmount));
        plusSign && setDeltaPlus(deltaPlus + absAmount);
        !plusSign && setDeltaMinus(deltaMinus + absAmount);
        Axios.post("/api/rest/transactions", {
            amountPoints: absAmount,
            comment,
            inPublicationSlug: publicationSlug,
            [forTransaction
                ? "forTransactionId"
                : "forPublicationSlug"]: forTransaction
                ? transactionId
                : publicationSlug,

            directionPlus: plusSignRewrite ?? plusSign,
        })
            .then((d) => d.data)
            .then((d) => {
                upd([...comments, { comment }]);
                setActiveComment(null);
                updBalance();
            });
        setComment("");
        setAmount(Math.min(1, maxPlus));
    };

    const currentPlus = round(
        (parseInt(plusGiven) + parseInt(deltaPlus as any)) || 0
    );
    const currentMinus = round(
        (parseInt(minusGiven) + parseInt(deltaMinus as any)) || 0
    );
    const formCommentProps = {
        key: uid,
        uid,
        hasPoints,
        comment,
        setComment,
        amount,
        setAmount,
        free,
        maxPlus,
        maxMinus,
        commentAdd,
        error,
        onClose: () => {
            activeCommentHook[1](null);
        },
    };

    return {
        comments: safeComments,
        showPlus,
        setShowComments,
        currentPlus,
        currentMinus,
        showMinus,
        showComments,
        formCommentProps,
    };
};
