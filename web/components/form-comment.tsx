import Link from "next/link";
import { FormCommentVote } from "../frontend/form-comment-vote";

export const FormComment = ({
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
}) => (
    <div
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
                закрыть[x]
            </span>
        </div>
        {maxMinus == 0 && amount < 0 && (
            <div className="notice" style={{ padding: "20px" }}>
                Минусовое голосование возможно только с Баланса.{" "}
                <Link href="/mt/balance">
                    Cнимите баллы с публикаций на свой Баланс
                </Link>{" "}
            </div>
        )}

        {maxMinus == 0 && amount < 0 ? null : !hasPoints ? (
            <div className="notice" style={{ padding: "20px" }}>
                Недостаточно баллов.{" "}
                <Link href="/mt/balance">Добавьте их на свой Баланс</Link>{" "}
            </div>
        ) : (
            <FormCommentVote
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
