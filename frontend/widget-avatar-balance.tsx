import { classList } from "utils/classList";

export const WidgetAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    onClick,
}) => (
    <div className="widget-avatar-balance-outer clickable" onClick={onClick}>
        <div className="line-shadow"></div>
        <div className="widget-avatar-balance">
            <div className="balances">
                <div className="balances-inner">
                    {balance1 && (
                        <div className="balance">
                            {balance1.icon && "Баланс: "}
                            <img className="inline" src={balance1.icon} />{" "}
                            {balance1.amount}
                        </div>
                    )}
                    {balance2 && (
                        <div className="balance">
                            <img className="inline" src={balance2.icon} />{" "}
                            {balance2.amount}
                        </div>
                    )}
                </div>
            </div>
            <div className="avatar">
                <img src={avatarUrl} onError={onAvatarUrlNotFound} />
            </div>
        </div>
        <div className="line-shadow"></div>
    </div>
);
