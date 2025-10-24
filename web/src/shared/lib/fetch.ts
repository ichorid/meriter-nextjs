import axios from 'axios'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { encode } from 'querystring'

export const apiGET = async (addr: string, params = {}) => {
    const response = await axios.get(addr, { 
        params,
        withCredentials: true, // Include cookies in requests
    })
    return response.data
}

export const useApiGET = (addr: string, initial: any, params = {}) => {
    const [data, setData] = useState(initial)
    useEffect(() => {
        const fetchData = async () => {
            const result = await apiGET(addr, params)
            setData(result)
        }
        fetchData()
    }, [addr, params])
    return [data]
}

export const apiPOST = async (addr: string, data = {}) => {
    const response = await axios.post(addr, data, {
        withCredentials: true, // Include cookies in requests
    })
    return response.data
}

export const useApiPOST = (addr: string, initial: any, params = {}) => {
    const [resp, setResp] = useState(initial)
    useEffect(() => {
        const postData = async () => {
            const result = await apiPOST(addr, params)
            setResp(result)
        }
        postData()
    }, [addr, params])
    return [resp]
}

const fetchJSON = async function (input: RequestInfo, init?: RequestInit) {
    console.log('🌐 SWR Fetch request:', input);
    const res = await fetch(input, {
        ...init,
        credentials: 'include', // Include cookies in requests
    })
    console.log('🌐 SWR Fetch response status:', res.status, res.statusText);
    const data = await res.json();
    console.log('🌐 SWR Fetch response data:', data);
    return data;
}
//const prefix="http://localhost:3000"

//const fetcher = url => fetch(url).then(r => r.json())

export const swr = (fullPath, initialData, options: any = {}) => {
    let path, key
    if (typeof fullPath == 'function') {
        key = options.key
        path = fullPath
    } else {
        ;[path, key] = fullPath.split(' $')
    }
    if (options.params) path = path + encode(options.params)

    const { data, mutate, error } = useSWR(path, fetchJSON, {
        initialData: key ? { [key]: initialData } : initialData,
        revalidateOnMount: true,
        ...options,
    })
    return [key ? data && data[key] : data, key ? (data, shouldRevalidate) => mutate({ [key]: data }, shouldRevalidate) : mutate, error]
}

export const swrPrefetch = (path) => {}
