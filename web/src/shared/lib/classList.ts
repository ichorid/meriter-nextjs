export const classList = (
    ...classes: (string | { [key: string]: boolean })[]
) => {
    return (
        classes &&
        classes
            .filter((cls) => cls !== undefined)
            .map((cls) =>
                typeof cls == "object"
                    ? (() => {
                        const key = Object.keys(cls)[0];
                        return key && cls[key] ? key : "undefined";
                    })()
                    : cls
            )
            .filter((c) => c != "undefined")
            .map((c) => String(c).toLowerCase())
            .join(" ")
    );
};
