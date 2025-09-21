import { linkResolveLong, linkResolveShort } from 'transactions/links/links'
import { useEffect } from 'react'
import { setCookie } from 'users/useraccess/auth'

export async function getServerSideProps({ req, res, params }) {
    try {
        const { link_id } = params
        let payload
        let redirect
        if (link_id?.length > 30) payload = await linkResolveLong(link_id)
        else if (link_id) payload = await linkResolveShort(link_id)

        redirect = payload?.redirect

        if (payload?.action == 'setCookie') {
            const { jwt, redirect } = payload
            setCookie(res, 'jwt', jwt)
        }

        if (payload?.action == 'redirect')
            if (res) {
                res.setHeader('Location', redirect)
                /* res.writeHead(
                    302,
                    fillDefined({
                        Location: redirect,
                        "Set-Cookie": res.headers["Set-Cookie"],
                    })
                );*/
                res.statusCode = 302
                res.end()
            }
        return { props: { redirect } }
    } catch (e) {
        return { props: {} }
    }
}

export default ({ redirect }) => {
    useEffect(() => {
        document.location.href = redirect
    }, [])
    if (!redirect) return <div>Ссылка не найдена или устарела</div>
    else return <div>Перенаправляю</div>
}
