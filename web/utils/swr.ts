import useSWR from "swr";
import useSWRInfinite from "swr/infinite";

const _fetch = async function (input, ...args) {
    const res = await fetch(input, ...args);
    return res.json();
};
//const prefix="http://localhost:3000"

//const fetcher = url => fetch(url).then(r => r.json())

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
    //console.log(path,key,data,error);
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
    console.log(swrr);
    const { data, size, setSize, error } = swrr;
    //console.log(error);
    //console.log(path,key,data,error);
    return [data, size, setSize, error];
};

export const swrPrefetch = (path) => {};
