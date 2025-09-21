import Head from "next/head";
import {MetrikaMeriter} from 'transactions/pixels/metrikameriter'

const Page = (props) => {
    const { children, className } = props;
    return (
        <div className={"meriter page " + className ?? ""}>
            <Head>
                <link
                    href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,400;0,500;0,700;1,300&display=swap"
                    rel="stylesheet"
                />
                <link
                    href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;800;900&display=swap"
                    rel="stylesheet"
                ></link>
                
            </Head>
            <MetrikaMeriter/>
            
            {children}
            <div className="bottom-widget">
                <div className="bottom-widget-area">{}</div>
            </div>
        </div>
    );
};

export default Page;
