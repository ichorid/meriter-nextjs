'use client';

import { useState } from "react";
import { etv } from '@shared/lib/input-utils';
import Slider from "rc-slider";
import { useTranslation } from 'react-i18next';

export const FormWithdraw = ({
    comment,
    setComment,
    amount,
    setAmount,
    maxWithdrawAmount,
    maxTopUpAmount,
    onSubmit,
    children,
    isWithdrawal,
}) => {
    const { t } = useTranslation('shared');
    const [selected, setSelected] = useState(false);

    return (
        <div className="card bg-base-100 shadow-lg rounded-2xl p-5">
            <div className="border-t-2 border-base-300 w-full mb-4"></div>

            <div className="text-sm mb-4 opacity-70">{children}</div>

            {((isWithdrawal && maxWithdrawAmount >= 1) ||
                (!isWithdrawal && maxTopUpAmount >= 1)) && (
                <div>
                    <div className="mb-4 px-2">
                        <Slider
                            min={0}
                            max={
                                isWithdrawal
                                    ? maxWithdrawAmount
                                    : maxTopUpAmount
                            }
                            value={amount}
                            onChange={setAmount}
                        />
                    </div>
                    <div className="relative">
                        <textarea
                            onClick={() => setSelected(true)}
                            className="textarea textarea-bordered w-full bg-base-100 text-base resize-none"
                            style={
                                selected
                                    ? { height: "100px" }
                                    : { height: "50px" }
                            }
                            placeholder={t('writeComment')}
                            {...etv(comment, setComment)}
                        />
                        <button
                            onClick={onSubmit}
                            className="btn btn-circle btn-primary absolute bottom-2 right-2"
                        >
                            <img src={"/meriter/send.svg"} alt="Send" className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
