'use client';

const linebr = (text: string) => {
    return text
        .split("\n")
        .map((t, i) => [t, <br key={`br-${i}`} />])
        .flat()
        .slice(0, -1);
};

export const WithTelegramEntities = ({
    entities,
    children,
}: {
    entities: {
        type: string;
        offset: number;
        length: number;
        url?: string;
        user_id?: string;
    }[];
    children: string;
}) => {
    // Ensure messageText is a string
    let messageText: string;
    if (typeof children === 'string') {
        messageText = children;
    } else if (typeof children === 'number') {
        messageText = String(children);
    } else if (children === null || children === undefined) {
        return null;
    } else {
        // If it's something else (object, etc.), try to stringify or return empty
        console.warn('[WithTelegramEntities] Expected string but got:', typeof children, children);
        messageText = String(children || '');
    }
    
    // Handle empty messageText
    if (!messageText) {
        return null;
    }
    
    function _onlyUnique(value: unknown, index: number, self: unknown[]) {
        return self.indexOf(value) === index;
    }

    const activeEntities =
        entities?.filter(
            (e) =>
                e.type == "bold" ||
                e.type == "italic" ||
                e.type == "url" ||
                e.type == "text_url"
        ) ?? [];
    let points = [
        0,
        messageText.length,
        ...activeEntities.map((e) => [e.offset, e.offset + e.length]).flat(),
    ];

    points?.sort((a, b) => (a < b ? -1 : 1));

    let segments = points
        .filter((v, i, a) => a.indexOf(v) === i)
        .map((p, idx, array) => (idx > 0 ? [array[idx - 1], p] : undefined))
        .filter((a) => a !== undefined);

    const decorated = segments.map(([start, end], index) => {
        const type = activeEntities.find((e) => e.offset === start)?.type;
        if (!type) return <span key={`seg-${index}`}>{linebr(messageText.substring(start || 0, end || 0))}</span>;
        if (type === "bold") {
            return <b key={`seg-${index}`}>{linebr(messageText.substring(start || 0, end || 0))}</b>;
        }
        if (type === "italic") {
            return <em key={`seg-${index}`}>{linebr(messageText.substring(start || 0, end || 0))}</em>;
        }
        if (type === "url") {
            return (
                <a
                    key={`seg-${index}`}
                    style={{ wordWrap: "break-word" }}
                    href={messageText.substring(start || 0, end || 0)}
                >
                    {linebr(messageText.substring(start || 0, end || 0))}
                </a>
            );
        }
        if (type === "text_url") {
            const ent = activeEntities.find((e) => e.offset === start);
            return (
                <a key={`seg-${index}`} style={{ wordWrap: "break-word" }} href={ent?.url}>
                    {linebr(messageText.substring(start || 0, end || 0))}
                </a>
            );
        }
        // Default case for unknown types
        return <span key={`seg-${index}`}>{linebr(messageText.substring(start || 0, end || 0))}</span>;
    });

    return <div className="text-base-content">{decorated}</div>;
};