import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

const _fetch = async function (input, ...args) {
    const res = await fetch(input, ...args);
    return res.json();
};

export const swr = (
    path: string | Function,
    initialData: any,
    options: object | undefined = undefined
) => {
    const { key } = (options ?? {}) as any;
    const { data, mutate, error } = useSWR(path as any, _fetch, {
        fallbackData: key ? { [key]: initialData } : initialData,
        revalidateOnMount: true,
        ...options,
    });
    return [
        key ? data && data[key] : data,
        key
            ? (data, shouldRevalidate) =>
                  mutate({ [key]: data }, shouldRevalidate)
            : mutate,
        error,
    ];
};

export const swrInfinite = (
    getKey: any,
    initialData,
    options: object | undefined = undefined
) => {
    const swrr = useSWRInfinite(getKey, _fetch, {
        fallbackData: initialData,
        revalidateOnMount: true,
        ...options,
    });
    const { data, size, setSize, error} = swrr;
    return [data, size, setSize, error];
};

export const swrPrefetch = (path) => {};
