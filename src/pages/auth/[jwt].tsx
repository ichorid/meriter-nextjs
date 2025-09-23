import Axios from "axios";
import {
    verifyJWT,
    getAuth,
    getAuthTgUserId,
    setCookie,
} from "projects/meriter/utils/auth";
import { useEffect } from "react";
import { linkResolveShort } from "transactions/links/links";

export async function getServerSideProps(ctx) {
    const { query, req, res } = ctx;
    console.log("QUERY", query);
    let error = false;
    let redirect = "/mt/balance";
    if (!query.jwt) throw "no jwt";
    try {
        const auth = verifyJWT(query.jwt);
        console.log("AUTH", auth);
        setCookie(res, "jwt", query.jwt);
        if (auth?.redirect && !auth?.redirect.match("fullPath"))
            redirect = auth.redirect.replace(/#/g, "/");
        else redirect = auth.redirect;
        /* if (auth.tgUserId) {
            let token = await getAuthTgUserId(
                req,
                res,
                auth.tgUserId,
                auth.name
            );
            if (auth?.redirect) redirect = auth.redirect.replace(/#/g, "/");
            console.log(token);*/
    } catch (e) {
        error = true;
        console.log(e);
    }
    let fullPath = null;
    if (redirect) {
        if (!redirect.match("fullPath")) {
            const payload = await linkResolveShort(redirect);
            fullPath = payload?.fullPath;
        } else fullPath = redirect.replace("fullPath://", "");
    }
    console.log("fullPath", fullPath);
    return {
        props: { redirect: fullPath, error },
    };
}

const AuthPage = ({ redirect, error }) => {
    console.log("PROPS", redirect);

    if (error) return <div>Ссылка устарела</div>;
    useEffect(() => {
        if (redirect == "manage") document.location.href = "/meriter/manage";
        else {
            document.location.href = redirect ? redirect : "/";
        }
    }, []);
    return <div></div>;
};
export default AuthPage;
