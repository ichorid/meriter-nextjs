import { useState } from "react";
import { etv } from "utils/input";
import Slider from "rc-slider";

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
    const [selected, setSelected] = useState(false);

    return (
        <div className="form-withdraw">
            <div className="line-shadow" style={{ width: "100%" }}></div>

            <div className="info">{children}</div>

            {((isWithdrawal && maxWithdrawAmount >= 1) ||
                (!isWithdrawal && maxTopUpAmount >= 1)) && (
                <div>
                    <div className="range">
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
                    <div className="send-wrapper">
                        <textarea
                            onClick={() => setSelected(true)}
                            style={
                                selected
                                    ? { height: "100px" }
                                    : { height: "50px" }
                            }
                            placeholder="Напишите комментарий"
                            {...etv(comment, setComment)}
                        />
                        <div onClick={onSubmit} className="add-comment-button">
                            <img src={"/meriter/send.svg"} />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
