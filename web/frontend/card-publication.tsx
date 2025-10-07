import { classList } from "utils/classList";

export const CardPublication = ({
    title,
    subtitle,
    description,
    avatarUrl,
    children,
    bottom,
    onClick,
    onAvatarUrlNotFound,
    onDescriptionClick,
}) => (
    <div className="card-publication">
        <div className="inner">
            <div className="header">
                <div className="author">
                    <div className="avatar">
                        <img src={avatarUrl} onError={onAvatarUrlNotFound} />
                    </div>
                    <div className="info">
                        <div className="title">{title}</div>
                        <div className="subtitle">{subtitle}</div>
                    </div>
                </div>
                <div
                    className="description clickable"
                    onClick={onDescriptionClick}
                >
                    {description}
                </div>
            </div>
            <div
                className="content clickable"
                style={{ overflowY: "hidden" }}
                onClick={onClick}
            >
                {children}
            </div>
            <div className="bottom">{bottom}</div>
        </div>
    </div>
);
