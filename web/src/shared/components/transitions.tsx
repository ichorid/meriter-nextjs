'use client';

import { useRef } from 'react'
import { Transition } from 'react-transition-group'

const duration = 300

const defaultStyle = {
    transition: `opacity ${duration}ms ease-in-out`,
    opacity: 0,
}

const transitionStyles: Record<string, { opacity: number }> = {
    entering: { opacity: 1 },
    entered: { opacity: 1 },
    exiting: { opacity: 0 },
    exited: { opacity: 0 },
    unmounted: { opacity: 0 },
}

interface DivFadeProps {
    text: any;
    className?: string;
}

export const DivFade: React.FC<DivFadeProps> = ({ text, className }) => {
    const nodeRef = useRef(null)
    
    return (
        <Transition in={!!text} timeout={duration} nodeRef={nodeRef}>
            {(state) => (
                <div
                    ref={nodeRef}
                    className={className}
                    style={{
                        ...defaultStyle,
                        ...transitionStyles[state],
                    }}>
                    {text}
                </div>
            )}
        </Transition>
    )
}
