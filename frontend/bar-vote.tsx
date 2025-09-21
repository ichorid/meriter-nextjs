export const BarVote = ({ onPlus, onMinus, plus, minus, onLeft }) => (
    <div className="bar-vote">
        <div className="left-info" onClick={onLeft}>
            <img style={{ opacity: 0.3 }} src={"/meriter/comment.svg"} />
        </div>
        <div className="vote-widget">
            <span
                className={
                    minus > plus
                        ? "minus clickable negative"
                        : "minus clickable"
                }
                onClick={onMinus}
            >
                -
            </span>
            <span className={minus > plus ? "count negative" : "count"}>
                {plus - minus ?? 0}
            </span>
            <span
                className={
                    minus > plus ? "plus clickable negative" : "plus clickable"
                }
                onClick={onPlus}
            >
                +
            </span>
        </div>
    </div>
);
