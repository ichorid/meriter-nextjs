import { classList } from "utils/classList";
import Head from 'next/head'

export const Page = ({ theme, children }) => {
    return (
        <div className={theme ? "theme " + theme : theme}>
             <Head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,300&display=swap"
                    rel="stylesheet"
                />
            </Head>
            <div className="page">
                <div className="page-inner">{children}</div>
            </div>
        </div>
    );
};
