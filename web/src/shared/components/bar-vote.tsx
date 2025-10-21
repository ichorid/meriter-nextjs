'use client';

import { useTelegramWebApp } from '@shared/hooks/useTelegramWebApp';

export const BarVote = ({ onPlus, onMinus, plus, minus, onLeft, commentCount = 0 }) => {
    const { hapticFeedback } = useTelegramWebApp();
    
    const handleMinus = (e) => {
        e.stopPropagation();
        hapticFeedback?.impact('light');
        onMinus();
    };
    
    const handlePlus = (e) => {
        e.stopPropagation();
        hapticFeedback?.impact('light');
        onPlus();
    };
    
    const handleCommentClick = () => {
        hapticFeedback?.impact('soft');
        onLeft();
    };
    
    return (
        <div className="grid grid-cols-[1fr_120px] gap-4 px-5 py-2.5">
            <div className="mt-4 flex items-center gap-2">
                {commentCount > 0 && (
                    <div className="cursor-pointer flex items-center gap-2" onClick={handleCommentClick}>
                        <img className="w-6 h-6 opacity-30" src={"/meriter/comment.svg"} alt="Comments" />
                        <span className="text-sm opacity-50">{commentCount}</span>
                    </div>
                )}
            </div>
            <div className="bg-base-100 border border-base-300 rounded-xl shadow-md flex items-center justify-center">
                <button
                    className={`clickable flex-1 text-xl font-bold cursor-pointer py-1.5 ${
                        minus > plus ? "text-error" : "text-secondary"
                    }`}
                    onClick={handleMinus}
                >
                    -
                </button>
                <span className={`px-3 py-2.5 font-bold ${minus > plus ? "text-error" : "text-secondary"}`}>
                    {(plus - minus) || 0}
                </span>
                <button
                    className={`clickable flex-1 text-xl font-bold cursor-pointer py-1.5 ${
                        minus > plus ? "text-error" : "text-secondary"
                    }`}
                    onClick={handlePlus}
                >
                    +
                </button>
            </div>
        </div>
    );
};
