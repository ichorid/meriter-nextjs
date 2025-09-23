import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

export const BottomPortal = ({ children }) => {
    const [el, setEl] = useState(null);
    useEffect(() => {
        let el = document.querySelector(".bottom-widget-area");
        //el.innerHTML = "";
        setEl(el);
    }, []);
    if (!el) return null;
    return createPortal(children, el);
};
