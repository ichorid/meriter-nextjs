'use client';

const linebr = (text) => {
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
    const messageText = children;
    
    // Handle undefined or null messageText
    if (!messageText) {
        return null;
    }
    
    function onlyUnique(value, index, self) {
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
        if (!type) return <span key={`seg-${index}`}>{linebr(messageText.substring(start, end))}</span>;
        if (type === "bold") {
            return <b key={`seg-${index}`}>{linebr(messageText.substring(start, end))}</b>;
        }
        if (type === "italic") {
            return <em key={`seg-${index}`}>{linebr(messageText.substring(start, end))}</em>;
        }
        if (type === "url") {
            return (
                <a
                    key={`seg-${index}`}
                    style={{ wordWrap: "break-word" }}
                    href={messageText.substring(start, end)}
                >
                    {linebr(messageText.substring(start, end))}
                </a>
            );
        }
        if (type === "text_url") {
            const ent = activeEntities.find((e) => e.offset === start);
            return (
                <a key={`seg-${index}`} style={{ wordWrap: "break-word" }} href={ent?.url}>
                    {linebr(messageText.substring(start, end))}
                </a>
            );
        }
    });

    return <div className={"tttt"}>{decorated}</div>;
};
