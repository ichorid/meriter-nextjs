import axios from 'axios'
import { useEffect, useState } from 'react'
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
