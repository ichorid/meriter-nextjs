import { useState } from "react";
import { etv } from "utils/input";
import Slider from "rc-slider";
import { classList } from "utils/classList";

interface iFormCommentVoteProps {
    comment: string;
    setComment: Function;
    freePlus: number;
    freeMinus: number;
    amount: number;
    setAmount: (number) => void;
    maxPlus: number;
    maxMinus: number;
    commentAdd: (any) => void;
    error: string;
    reason?: string;
}

export const FormCommentVote = ({
    comment,
    setComment,
    freePlus,
    freeMinus,
    amount,
    setAmount,
    maxPlus,
    maxMinus,
    commentAdd,
    error,
    reason,
}: iFormCommentVoteProps) => {
    const [selected, setSelected] = useState(false);
    const overflow = amount >= 0 ? amount > freePlus : amount < -freeMinus;
    const directionPlus = amount > 0 ? true : false;
    const directionMinus = amount < 0 ? true : false;

    return (
        <div
            className={classList(
                "form-comment-vote",
                directionPlus ? "plus" : directionMinus ? "minus" : "neutral"
            )}
        >
            <div className="line-shadow" style={{ width: "100%" }}></div>
            {directionPlus && (
                <div className="info">
                    Плюсануть на {Math.min(freePlus, Math.abs(amount))}/
                    {freePlus} суточной квоты
                </div>
            )}
            {directionPlus && (
                <div className="info">
                    Плюсануть на {overflow ? amount - freePlus : 0} с Баланса
                </div>
            )}
            {amount === 0 && (
                <div className="info">Слайдер вправо - плюсануть</div>
            )}
            {amount === 0 && maxMinus != 0 && (
                <div className="info">Слайдер влево - минусануть</div>
            )}
            {directionMinus && freeMinus > 0 && (
                <div className="info">
                    Минусануть на {Math.min(freeMinus, Math.abs(amount))}/
                    {freeMinus} суточной квоты
                </div>
            )}
            {directionMinus && (
                <div className="info">
                    Минусануть на {overflow ? amount - freeMinus : 0} с Баланса
                </div>
            )}

            <div className="range">
                {false && (
                    <input
                        type="number"
                        min={-maxMinus}
                        max={maxPlus}
                        {...etv(amount, setAmount)}
                    ></input>
                )}
                {false && (
                    <input
                        type="range"
                        min={-maxMinus}
                        max={maxPlus}
                        {...etv(amount, setAmount)}
                    />
                )}
                <Slider
                    min={-maxMinus}
                    max={maxPlus}
                    value={amount}
                    onChange={setAmount}
                />
            </div>
            <div className="send-wrapper">
                <textarea
                    onClick={() => setSelected(true)}
                    style={selected ? { height: "100px" } : { height: "75px" }}
                    placeholder={
                        reason ?? amount == 0
                            ? "Двигайте слайдер, чтобы выбрать количество баллов"
                            : "Расскажите, почему вы поставили такую оценку. Нам ценно ваше мнение"
                    }
                    {...etv(comment, setComment)}
                />
                {amount != 0 && (
                    <div
                        onClick={() => commentAdd(directionPlus ? true : false)}
                        className="add-comment-button"
                    >
                        <img src={"/meriter/send.svg"} />
                    </div>
                )}
            </div>
            {error && <div className={"error"}>{error}</div>}
        </div>
    );
};
