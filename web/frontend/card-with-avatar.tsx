import { useState } from "react";

export const CardWithAvatar = ({
    avatarUrl,
    avatarUrlUpd,
    iconUrl,
    iconOnClick,
    children,
    onClick,
}: {
    avatarUrl?: string;
    iconUrl?: string;
    iconOnClick?: () => any;
    children: React.ReactNode;
    onClick?: () => any;
    avatarUrlUpd?: (any) => any;
}) => {
    const [error, setError] = useState(false);
    if (!avatarUrl && !iconUrl)
        return (
            <div
                className={
                    onClick
                        ? "card-with-avatar no-avatar clickable"
                        : "card-with-avatar no-avatar"
                }
                onClick={onClick}
            >
                <div className="inner">
                    <div className="content">{children}</div>
                </div>
            </div>
        );

    if (iconUrl && !avatarUrl) {
        return (
            <div
                className={
                    onClick
                        ? "card-with-avatar no-avatar with-icon clickable"
                        : "card-with-avatar no-avatar with-icon"
                }
                onClick={onClick}
            >
                <div className="inner">
                    <div className="content">{children}</div>
                    <div className="photo">
                        <div
                            className="icon"
                            style={{ cursor: "pointer" }}
                            onClick={iconOnClick}
                        >
                            {iconUrl && <img src={iconUrl} />}
                        </div>
                    </div>
                </div>
            </div>
        );
    }
    return (
        <div
            className={
                onClick ? "card-with-avatar clickable" : "card-with-avatar"
            }
            onClick={onClick}
        >
            <div className="inner">
                <div className="photo">
                    <div className="avatar">
                        {avatarUrl && !error && (
                            <img onError={avatarUrlUpd} src={avatarUrl} />
                        )}
                    </div>
                </div>

                <div className="content">{children}</div>
            </div>
        </div>
    );
};
