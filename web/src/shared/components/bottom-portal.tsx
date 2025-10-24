'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface BottomPortalProps {
    children: React.ReactNode;
}

export const BottomPortal: React.FC<BottomPortalProps> = ({ children }) => {
    const [el, setEl] = useState<Element | null>(null);
    useEffect(() => {
        let el = document.querySelector(".bottom-widget-area");
        //el.innerHTML = "";
        setEl(el);
    }, []);
    if (!el) return null;
    return createPortal(children, el);
};
