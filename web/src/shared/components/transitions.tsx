'use client';

import { useRef } from 'react'
import { Transition } from 'react-transition-group'

const duration = 300

const defaultStyle = {
    transition: `opacity ${duration}ms ease-in-out`,
    opacity: 0,
}

const transitionStyles = {
    entering: { opacity: 1 },
    entered: { opacity: 1 },
    exiting: { opacity: 0 },
    exited: { opacity: 0 },
}

export const DivFade = ({ text, className }) => {
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
