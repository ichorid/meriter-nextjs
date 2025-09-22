import { Fragment, useState } from "react";
import dynamic from "next/dynamic";

const ReactStories: any = dynamic(() => import("react-insta-stories"), {
    ssr: false,
});

interface ElemProps {
    data: any;
    className?: string;
    key?: any;
    exceptKeys?: string[];
    plugins?: object;
}
export const Collapse = ({ h, children }) => {
    const [opened, setOpened] = useState(false);
    return (
        <div className="collapse">
            {!opened && (
                <div
                    style={{ cursor: "pointer" }}
                    onClick={() => {
                        setOpened(true);
                    }}
                    className="h collapsed">
                    {h}
                </div>
            )}
            {opened && <div>{children}</div>}
        </div>
    );
};
export const Elem = ({ data, className, exceptKeys, plugins }: ElemProps) => {
    // console.log("ELEM", data);

    if (typeof data === "string" || typeof data === "number") {
        return <p className={className}>{parseMarkDown(data)}</p>;
    }

    if (Array.isArray(data)) {
        return (
            <div className={className}>
                {data.map((elem, key) => (
                    <Elem className={className + "-elem"} data={elem} key={key} exceptKeys={exceptKeys} />
                ))}
            </div>
        );
    }

    if (typeof data === "object") {
        return (
            <div className={className}>
                {Object.entries(data).map(([key, elem]) => {
                    if (plugins && Object.keys(plugins).includes(key)) {
                        if (key !== "ReactStories") return <div key={key}>{plugins[key]({ data: elem })}</div>;
                        else
                            return (
                                <div>
                                    <Collapse h={(elem as any).collapsed}>
                                        {typeof elem === 'object' && <ReactStories {...elem} isPaused={true} />}
                                    </Collapse>
                                </div>
                            );
                    }

                    if (!(exceptKeys || []).includes(key)) return <Elem key={key} data={elem} className={key} exceptKeys={exceptKeys} />;
                })}
            </div>
        );
    }

    return null;
};

// classList(["card", className, { link }])
// "card" - const
// {link} - Boolean
// className = string

export const classList = (...classes: (string | { [key: string]: boolean })[]) => {
    return (
        classes &&
        classes
            .filter((cls) => typeof cls !== "undefined")
            .map((cls) => (typeof cls == "object" ? (cls[Object.keys(cls)[0]] ? Object.keys(cls)[0] : "undefined") : cls))
            .filter((c) => c != "undefined")
            .map((c) => c.toLowerCase())
            .join(" ")
    );
};

// const classNames = (name) => {
//     const names = {
//         u: "u upper",
//         h: "h heading",
//         d: "d description",
//         t: "t txt",
//         i: "i icon",
//         img: "img image",
//         image: "img image",
//         btn: "btn button",
//     };
//     return names[name] ? names[name] : name;
// };

export const parseMarkDown = (txt) => {
    const accent = txt.match("(.*)\\[(.*?)\\](.*)", "g");
    const newline = txt.match("\\|\\|\\|");
    const linebreak = txt.match("\\|\\|");
    if (newline) return txt.split("|||").map((t, i) => <div key={i}>{parseMarkDown(t)}</div>);
    if (linebreak) return txt.split("||").map((t, i) => <span key={i}>{parseMarkDown(t)}</span>);
    if (accent) {
        const { 1: prev, 2: b, 3: next } = accent;
        return (
            <Fragment>
                {prev && parseMarkDown(prev)}
                {b && <span className="accent">{b}</span>}
                {next && parseMarkDown(next)}
            </Fragment>
        );
    }
    return txt;
};

// interface ElemProps {
//     data: any;
//     className?: string;
//     key?: string | number;
// }

// export const Elem = ({
//     data,
//     className: initialClassName = "elem",
// }: ElemProps) => {
//     const className =
//         data && data.className
//             ? classList(classNames(initialClassName), data.className())
//             : classNames(initialClassName);

//     if (!data) return null;
//     else if (data.isReactComponent) return { data };
//     else if (typeof data == "function") return null;
//     else if (typeof data == "string")
//         return <p className={className}>{parseMarkDown(data)}</p>;
//     else if (typeof data == "number")
//         return <p className={className}>{data}</p>;
//     else if (Array.isArray(data))
//         return (
//             <Fragment>
//                 {data.map((e, i) =>
//                     e ? <Elem key={i} data={e} className={className} /> : null
//                 )}
//             </Fragment>
//         );
//     else if (data)
//         return (
//             <div className={className}>
//                 {Object.entries(data).map(([f, v]) =>
//                     !["link"].includes(f) ? (
//                         <Elem key={f} data={v} className={f} />
//                     ) : null
//                 )}
//             </div>
//         );
//     else return null;
// };
