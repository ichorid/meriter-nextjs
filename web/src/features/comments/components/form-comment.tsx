'use client';

import { useEffect } from "react";
import { useTranslations } from 'next-intl';
import { useToastStore } from '@/shared/stores/toast.store';

interface FormCommentProps {
    uid: string;
    comment: string;
    setComment: (comment: string) => void;
    commentAdd: (directionPlus: boolean) => void;
    error: string;
    onClose: () => void;
    // Legacy props - kept for compatibility but not used
    hasPoints?: boolean;
    amount?: number;
    setAmount?: (amount: number) => void;
    free?: number;
    maxPlus?: number;
    maxMinus?: number;
    reason?: string;
    quotaAmount?: number;
    walletAmount?: number;
    quotaRemaining?: number;
    currencyIconUrl?: string;
}

export const FormComment: React.FC<FormCommentProps> = ({
    uid,
    comment,
    setComment,
    commentAdd,
    error,
    onClose,
}) => {
    const t = useTranslations('comments');
    const addToast = useToastStore((state) => state.addToast);
    
    // Show error toast when error changes
    useEffect(() => {
        if (error) {
            addToast(error, 'error');
        }
    }, [error, addToast]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (comment.trim()) {
            // For publications, commentAdd is called with directionPlus=true but the amount is ignored
            // The API only uses the comment content
            commentAdd(true);
        }
    };
    
    return (
        <div
            key={uid + "_comment_form"}
            className="max-w-2xl mx-auto"
            onClick={(e) => {
                if (e.stopPropagation) {
                    e.stopPropagation();
                } else {
                    (e as any).cancelBubble = true;
                }
            }}
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                    <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder={t('addCommentOptional') || "Add a comment (optional)"}
                        className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                        rows={4}
                    />
                </div>
                
                {error && (
                    <div className="text-sm text-error p-3 bg-error/10 rounded-lg">
                        {error}
                    </div>
                )}
                
                <div className="flex justify-end gap-2">
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-ghost btn-sm"
                    >
                        {t('cancel') || 'Cancel'}
                    </button>
                    <button
                        type="submit"
                        className="btn btn-primary btn-sm"
                        disabled={!comment.trim()}
                    >
                        {t('submit') || 'Submit'}
                    </button>
                </div>
            </form>
        </div>
    );
};
