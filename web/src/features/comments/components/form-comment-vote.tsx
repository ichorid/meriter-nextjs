'use client';

import { useState } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
import { classList } from '@lib/classList';

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
                "p-5 rounded-2xl shadow-lg",
                directionPlus ? "bg-success/10" : directionMinus ? "bg-error/10" : "bg-base-100"
            )}
        >
            <div className="border-t-2 border-base-300 w-full mb-4"></div>
            {directionPlus && (
                <div className="text-sm mb-2 text-success">
                    Плюсануть на {Math.min(freePlus, Math.abs(amount))}/
                    {freePlus} суточной квоты
                </div>
            )}
            {directionPlus && (
                <div className="text-sm mb-2 text-success">
                    Плюсануть на {overflow ? amount - freePlus : 0} с Баланса
                </div>
            )}
            {amount === 0 && (
                <div className="text-sm mb-2 opacity-60">Слайдер вправо - плюсануть</div>
            )}
            {amount === 0 && maxMinus != 0 && (
                <div className="text-sm mb-2 opacity-60">Слайдер влево - минусануть</div>
            )}
            {directionMinus && freeMinus > 0 && (
                <div className="text-sm mb-2 text-error">
                    Минусануть на {Math.min(freeMinus, Math.abs(amount))}/
                    {freeMinus} суточной квоты
                </div>
            )}
            {directionMinus && (
                <div className="text-sm mb-2 text-error">
                    Минусануть на {overflow ? amount - freeMinus : 0} с Баланса
                </div>
            )}

            <div className="mb-4 px-2">
                <Slider
                    min={-maxMinus}
                    max={maxPlus}
                    value={amount}
                    onChange={setAmount}
                />
            </div>
            <div className="relative">
                <textarea
                    onClick={() => setSelected(true)}
                    className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                    style={selected ? { height: "100px" } : { height: "75px" }}
                    placeholder={
                        reason ?? amount == 0
                            ? "Двигайте слайдер, чтобы выбрать количество баллов"
                            : "Расскажите, почему вы поставили такую оценку. Нам ценно ваше мнение"
                    }
                    {...etv(comment, setComment)}
                />
                {amount != 0 && (
                    <button
                        onClick={() => commentAdd(directionPlus ? true : false)}
                        className="btn btn-circle btn-primary absolute bottom-2 right-2"
                    >
                        <img src={"/meriter/send.svg"} alt="Send" className="w-5 h-5" />
                    </button>
                )}
            </div>
            {error && <div className="alert alert-error mt-2">{error}</div>}
        </div>
    );
};
