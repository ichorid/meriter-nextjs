'use client';

import React, { Children, Fragment } from "react";
import { classList } from '@lib/classList';

export const parseMarkDown = (txt: unknown): React.ReactNode => {
    if (typeof txt !== "string") return null;
    const accent = txt.match("(.*)\\*\\*(.*?)\\*\\*(.*)");
    const newline = txt.match("\\|\\|\\|");
    const linebreak = txt.match("\\|\\|");
    if (newline)
        return txt
            .split("|||")
            .map((t, i) => <div key={i}>{parseMarkDown(t)}</div>);
    if (linebreak)
        return txt
            .split("||")
            .map((t, i) => <span key={i}>{parseMarkDown(t)}</span>);
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

interface ParagraphProps {
    type: string;
    props: {
        right?: boolean;
        center?: boolean;
        thin?: boolean;
        op1?: boolean;
        op0?: boolean;
        op08?: boolean;
        op05?: boolean;
        op01?: boolean;
        regular?: boolean;
        mt0?: boolean;
        mb0?: boolean;
        little?: boolean;
        red?: boolean;
        strike?: boolean;
        muted?: boolean;
    };
    children: React.ReactNode;
}

const Paragraph: React.FC<ParagraphProps> = ({ type, props, children }) => {
    const {
        right,
        center,
        thin,
        op1,
        op0,
        op08,
        op05,
        op01,
        regular,
        mt0,
        mb0,
        little,
        red,
        strike,
        muted,
    } = props;
    let className = classList(
        right ? { right } : "",
        center ? { center } : "",
        thin ? { thin } : "",
        op1 ? { op1 } : "",
        op0 ? { op0 } : "",
        op08 ? { op08 } : "",
        op05 ? { op05 } : "",
        op01 ? { op01 } : "",
        regular ? { regular } : "",
        mt0 ? { mt0 } : "",
        mb0 ? { mb0 } : "",
        little ? { little } : "",
        red ? { red } : "",
        strike ? { strike } : "",
        muted ? { muted } : ""
    );
    //const props = {}
    return React.createElement(
        type,
        { ...props, className },
        parseMarkDown(children)
    );
};
export const P: React.FC<any> = (props) => {
    return (
        <Paragraph type="p" props={props}>
            {props.children}
        </Paragraph>
    );
};
export const H1: React.FC<any> = (props) => {
    return (
        <Paragraph type="h1" props={props}>
            {props.children}
        </Paragraph>
    );
};
export const H2: React.FC<any> = (props) => {
    return (
        <Paragraph type="h2" props={props}>
            {props.children}
        </Paragraph>
    );
};
export const B: React.FC<any> = (props) => {
    return (
        <Paragraph type="b" props={props}>
            {props.children}
        </Paragraph>
    );
};

export const H3: React.FC<any> = (props) => {
    return (
        <Paragraph type="h3" props={props}>
            {props.children}
        </Paragraph>
    );
};
export const H4: React.FC<any> = (props) => {
    return (
        <Paragraph type="h4" props={props}>
            {props.children}
        </Paragraph>
    );
};
export const Li: React.FC<any> = (props) => {
    return (
        <Paragraph type="li" props={props}>
            {props.children}
        </Paragraph>
    );
};

export const A: React.FC<any> = (props) => {
    const noaccent = props.noaccent ?? false;
    const button = props.button ?? false;
    const {
        right,
        center,
        thin,
        op1,
        op08,
        op05,
        op01,
        op0,
        regular,
        mt0,
        mb0,
        inline,
        little,
        underline,
        red,
    } = props;
    let className = classList(
        { right },
        { center },
        { thin },
        { op1 },
        { op0 },
        { op08 },
        { op05 },
        { op01 },
        { mt0 },
        { mb0 },
        { red }
    );
    if (inline)
        return (
            <a
                href={props.href}
                className={classList(
                    { button },
                    { regular },
                    { little },
                    { thin },
                    { op1 },
                    { op0 },
                    { op08 },
                    { op05 },
                    { op01 },
                    { underline }
                )}
                onClick={props.onClick}
            >
                {parseMarkDown(props.children)}
            </a>
        );
    return (
        <p className={className}>
            <a
                href={props.href}
                className={classList(
                    { button },
                    { regular },
                    { little },
                    { underline }
                )}
                onClick={props.onClick}
            >
                {parseMarkDown(props.children)}
            </a>
        </p>
    );
};
export const Div: React.FC<any> = (props) => {
    return (
        <div
            className={classList(
                "div",
                props.accent && "accent",
                props.onClick && "clickable"
            )}
            onClick={props.onClick}
        >
            {props.children}
        </div>
    );
};

export const Img: React.FC<any> = (props) => {
    const { src, cover, shadowblur } = props;
    if (cover)
        return (
            <div className="img-wrapper fullwidth edge-margin">
                <img className="fullwidth" src={src} />
                <div className="edge-bloom"></div>
            </div>
        );
    if (shadowblur)
        return (
            <div className="shadowblur-wrapper">
                <div
                    className="shadowblur"
                    style={{ backgroundImage: `url(${src})` }}
                ></div>
                <div className="img-wrapper">
                    <img src={src} />
                </div>
            </div>
        );

    return <img src={src} />;
};

interface PanelBottomProps {
    children?: React.ReactNode;
    onClose: () => void;
}

export const PanelBottom = ({ children, onClose }: PanelBottomProps) => {
    const onlyPanelScreen = Array.isArray(children)
        ? children.filter((c) => c)[0] || null
        : children;

    if (!onlyPanelScreen) return null;

    return (
        <div className={classList("panel-bottom")}>
            <div
                className="panel-close-overlay"
                onClick={() => {
                    onClose();
                }}
            ></div>
            {onlyPanelScreen}
        </div>
    );
};
interface PanelScreenProps {
    children?: React.ReactNode;
    className?: string;
    scroll?: boolean;
}

export const PanelScreen = ({ children, className, scroll }: PanelScreenProps) => (
    <div className={classList("panel-screen", className || '', { scroll: scroll || false })}>
        {children}
    </div>
);
