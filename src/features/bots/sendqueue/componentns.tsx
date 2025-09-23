import { useState } from "react";

import { swr } from "utils/swr";

export const SendqueueObserver = () => {
    const [{ sq, sent }] = swr("/api/sendqueue/aggregate", {
        sq: [],
        sent: [],
    });
    const [openIdx, setOpenIdx] = useState(-1);

    return (
        <div className="sendqueue-observer.scss">
            <h1>Sent</h1>
            {sent.map((s) => (
                <QueueElem {...s} />
            ))}
            <h1>Queue</h1>
            {sq.map((s) => (
                <QueueElem {...s} />
            ))}
        </div>
    );
};

const verboseDate = (date) => {
    return new Date(date);
};

const QueueElem = (s: any) => {
    return <div></div>;
};
