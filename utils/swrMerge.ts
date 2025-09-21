import useSWR from "swr";

const _fetch = async function (input, ...args) {
    const res = await fetch(input, ...args);
    return res.json();
};
//const prefix="http://localhost:3000"

//const fetcher = url => fetch(url).then(r => r.json())

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

export const swrPrefetch = (path) => {};
