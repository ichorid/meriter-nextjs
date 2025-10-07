import axios from 'axios'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import _fetch from 'isomorphic-unfetch'
import { encode } from 'querystring'

export const apiGET = (addr, params = {}) => {
    return axios.get(addr, { params }).then((d) => d.data)
}

export const useApiGET = (addr, initial, params = {}) => {
    const [data, setData] = useState(initial)
    useEffect(() => {
        apiGET(addr, params).then((d) => setData(d))
    }, [])
    return [data]
}

export const apiPOST = (addr, data = {}) => {
    return axios.post(addr, data).then((d) => d.data)
}

export const useApiPOST = (addr, initial, params = {}) => {
    const [resp, setResp] = useState(initial)
    useEffect(() => {
        apiPOST(addr, params).then((d) => setResp(d))
    }, [])
    return [resp]
}

const fetch = async function (p1, p2) {
    const res = await _fetch(p1, p2)
    return res.json()
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

    const { data, mutate, error } = useSWR(path, fetch, {
        initialData: key ? { [key]: initialData } : initialData,
        revalidateOnMount: true,
        ...options,
    })
    //console.log(path,key,data,error);
    return [key ? data && data[key] : data, key ? (data, shouldRevalidate) => mutate({ [key]: data }, shouldRevalidate) : mutate, error]
}

export const swrPrefetch = (path) => {}
