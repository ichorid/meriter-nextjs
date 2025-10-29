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
    return (
        <div
            key={uid + "_unable"}
            className="max-w-2xl mx-auto px-4"
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
            <div className="alert alert-warning p-4 mb-4">
                <div className="flex items-center gap-2 flex-1">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                    <div className="flex-1">
                        <div className="font-medium">{t('downvoteRequiresBalance')}</div>
                        <Link href="/meriter/home" className="link link-primary">
                            {t('withdrawToBalance')}
                        </Link>
                    </div>
                </div>
                <button
                    className="btn btn-sm btn-ghost btn-square"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>
        )}

        {maxMinus == 0 && amount < 0 ? null : !hasPoints && amount !== 0 && !error ? (
            <div className="alert alert-error p-4 mb-4">
                <div className="flex items-center gap-2 flex-1">
                    <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="flex-1">
                        <div className="font-medium">{t('insufficientPoints')}</div>
                        <Link href="/meriter/home" className="link link-primary">
                            {t('addToBalance')}
                        </Link>
                    </div>
                </div>
                <button
                    className="btn btn-sm btn-ghost btn-square"
                    onClick={onClose}
                    aria-label="Close"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
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
