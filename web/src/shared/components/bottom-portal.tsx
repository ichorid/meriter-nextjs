'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

interface BottomPortalProps {
    children: React.ReactNode;
}

export const BottomPortal: React.FC<BottomPortalProps> = ({ children }) => {
    const [el, setEl] = useState<Element | null>(null);
    useEffect(() => {
        const findElement = () => {
            const found = document.querySelector(".bottom-widget-area");
            if (found) {
                setEl(found);
            } else {
                // Retry after a short delay if element not found immediately
                setTimeout(findElement, 100);
            }
        };
        findElement();
    }, []);
    if (!el) {
        // Log for debugging
        if (typeof window !== 'undefined') {
            console.log('⚠️ BottomPortal: .bottom-widget-area not found');
        }
        return null;
    }
    return createPortal(children, el);
};
