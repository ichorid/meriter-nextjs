export interface IPageWithCoverContent {
    uri?: string;
    meta: {
        image: string;
        title: string;
        description: string;
    };
    content: {
        sections?: ISections;
    };
}

interface IPageWithCoverProps {
    data: IPageWithCoverContent;
    plugins: object;
    children?: any;
}

interface ISections {
    [key: string]: ISection;
}
interface ISection {
    idx?: number;
    h: string;
    d: string;
    t: string[] | string;
    image?: string;
}

export const PageWithCover = ({
    data,
    plugins,
    children,
}: IPageWithCoverProps) => {
    return <div></div>;
};
