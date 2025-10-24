import useSWR from "swr";

const _fetch = async function (input: RequestInfo | URL, ...args: any[]) {
    const res = await fetch(input, ...args);
    return res.json();
};

export const swr = (
    path: string,
    initialData: object,
    key?: string | undefined,
    options = {}
) => {
    const { data, mutate, error } = useSWR(path, _fetch, {
        initialData: key ? { [key]: initialData } : initialData,
        revalidateOnMount: true,
        ...options,
    });
    return [
        key ? data && data[key] : data,
        key
            ? (data: any, shouldRevalidate: any) =>
                  mutate({ [key]: data }, shouldRevalidate)
            : mutate,
        error,
    ];
};

export const swrPrefetch = (path: string) => {};
