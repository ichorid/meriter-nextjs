import Axios from 'axios'

export const getIconsLogojoyProxy = (term, page) => {
    return Axios.get('/api/geticonslogojoy', { params: { term, page } }).then((d) => d.data)
}
export const getIconsLogojoy = (term, page) => {
    return Axios({
        url: 'https://symbols.production.logojoy.com/symbols',
        method: 'post',
        data: JSON.stringify({ term: term, page: page }),
        headers: {
            Origin: 'https://logojoy.com',
            Referer: 'https://logojoy.com/logo-maker',
            'Content-Type': 'application/json',
        },
    }).then((d) => d.data)
}
