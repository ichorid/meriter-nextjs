import axios from "axios";

function getURL() {
    let URL = process.env.URL;
    if (process.browser) {
        URL = document.location.origin;
    }
    return URL;
}
export function apiGET(url: string, params?: object) {
    const URL = getURL();

    return axios.get(URL + url, { params: params }).then((d) => d.data);
}

export function apiPOST(url: string, data?: object) {
    const URL = getURL();
    return axios.post(URL + url, data).then((d) => d.data);
}
