export function fillDefined(obj) {
    return Object.entries(obj).reduce((obj, cur) => {
        if (typeof cur[1] !== "undefined" && cur[0] !== "undefined")
            obj[cur[0]] = cur[1];

        return obj;
    }, {});
}
export function fillDefinedAndNotEmpty(obj) {
    return Object.entries(obj).reduce((obj, cur) => {
        if (
            typeof cur[1] !== "undefined" &&
            cur[0] !== "undefined" &&
            cur[1] !== ""
        )
            obj[cur[0]] = cur[1];

        return obj;
    }, {});
}

export function arraysHasIntersection(array1: string[], array2: string[]) {
    return array1.find((e1) => array2.find((e2) => e1 === e2));
}

export function objectSpreadMeta(metaCondition: Record<string, unknown>) {
    return Object.fromEntries(
        Object.entries(metaCondition).map(([k, v]) => ["meta." + k, v])
    );
}
