import { request } from 'graphql-request'
import useSWR from 'swr'

const API = '/api/graphql'
const fetcher = (query) => request(API, query)

const PageTest = () => {
    const { data, error } = useSWR(
        `{
            hello
          }`,
        fetcher
    )
    console.log(data)
    return <div></div>
}
export default PageTest
