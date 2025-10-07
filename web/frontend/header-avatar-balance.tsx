import { WidgetAvatarBalance } from "./widget-avatar-balance";

export const HeaderAvatarBalance = ({
    balance1,
    balance2,
    avatarUrl,
    onAvatarUrlNotFound,
    children,
    onClick,
}) => (
    <div className="header-avatar-balance-wrapper">
        <div className="header-avatar-balance two-cols">
            <div className="content">{children?.[0] ?? children ?? null}</div>
            <WidgetAvatarBalance
                balance1={balance1}
                balance2={balance2}
                avatarUrl={avatarUrl}
                onAvatarUrlNotFound={onAvatarUrlNotFound}
                onClick={onClick}
            />
        </div>
        <div className="description">{children?.[1] ?? null}</div>
    </div>
);
