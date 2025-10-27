'use client';

import Link from "next/link";
import { FormCommentVoteVertical } from "./form-comment-vote-vertical";
import { useTranslations } from 'next-intl';

interface FormCommentProps {
    uid: string;
    hasPoints: boolean;
    comment: string;
    setComment: (comment: string) => void;
    amount: number;
    setAmount: (amount: number) => void;
    free: number;
    maxPlus: number;
    maxMinus: number;
    commentAdd: (data: any) => void;
    error: string;
    reason?: string;
    onClose: () => void;
}

export const FormComment: React.FC<FormCommentProps> = ({
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
    onClose,
}) => {
    const t = useTranslations('comments');
    return (<div
        key={uid + "_unable"}
        onClick={(e) => {
            if (e.stopPropagation) {
                e.stopPropagation();
            } else {
                (e as any).cancelBubble = true;
            }
        }}
    >
        <div
            style={{
                opacity: 0.5,
                textAlign: "right",
                fontSize: ".8em",
                marginTop: "-1.5em",
            }}
        >
            <span style={{ cursor: "pointer" }} onClick={onClose}>
                {t('close')}
            </span>
        </div>
        {maxMinus == 0 && amount < 0 && (
            <div className="notice" style={{ padding: "20px" }}>
                {t('downvoteRequiresBalance')}{" "}
                <Link href="/meriter/home">
                    {t('withdrawToBalance')}
                </Link>{" "}
            </div>
        )}

        {maxMinus == 0 && amount < 0 ? null : !hasPoints ? (
            <div className="notice" style={{ padding: "20px" }}>
                {t('insufficientPoints')}{" "}
                <Link href="/meriter/home">{t('addToBalance')}</Link>{" "}
            </div>
        ) : (
            <FormCommentVoteVertical
                key={uid}
                comment={comment}
                setComment={setComment}
                amount={amount}
                setAmount={setAmount}
                freePlus={free}
                freeMinus={0}
                maxPlus={maxPlus}
                maxMinus={maxMinus}
                commentAdd={commentAdd}
                error={error}
            />
        )}
    </div>
    );
};
