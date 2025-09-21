import { BOT_USERNAME } from "projects/meriter/config";
import Page from "projects/meriter/components/page";
import { swr } from "utils/swr";
import Router from "next/router";
import { useEffect, useState } from "react";
import Axios from "axios";

const CardCommunity = ({ h, d, rating }) => {
    return (
        <div className="card-community">
            <div className="content">
                <div className="h">{h}</div>
                <div className="d">{d}</div>
            </div>
            <div className="rating">{rating}</div>
        </div>
    );
};

const PageMeriterIndex = () => {
    const addr = BOT_USERNAME;
    const [user] = swr("/api/rest/getme", { init: true });
    useEffect(() => {
        if (user?.token) document.location.href = "/mt/balance";
    }, [user]);
    //const communities = []
    useEffect(() => {
        const fullPath = document.location.search.replace("?", "");

        Axios.get("/api/d/meriter/redirectlink", { params: { fullPath } })
            .then((d) => d.data)
            .then((d) => {
                if (d.short_id) {
                    setRedirect(d.short_id);
                }
            });
    }, []);
    const [redirect, setRedirect] = useState("");
    const addred = redirect ? "__" + redirect : "";
    return (
        <Page className="index">
            <div className="center">
                <div>
                    <img src="/meriter/meriterralogobig.svg" />
                </div>

                <div className="mar-80">
                    <a
                        className="oval-button"
                        href={`https://t.me/${addr}?start=auth${addred}`}
                    >
                        Войти
                    </a>
                </div>
            </div>
        </Page>
    );
};

export default PageMeriterIndex;
