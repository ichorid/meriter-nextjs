'use client';

export const BarVote = ({ onPlus, onMinus, plus, minus, onLeft, commentCount = 0 }) => (
    <div className="grid grid-cols-[1fr_120px] gap-4 px-5 py-2.5">
        <div className="mt-4 flex items-center gap-2">
            {commentCount > 0 && (
                <div className="cursor-pointer flex items-center gap-2" onClick={onLeft}>
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
                onClick={(e) => {
                    e.stopPropagation();
                    onMinus();
                }}
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
                onClick={(e) => {
                    e.stopPropagation();
                    onPlus();
                }}
            >
                +
            </button>
        </div>
    </div>
);
