import Head from 'next/head'

export const HeadPageMeta = ({ metaContent }) => {
    return (
        <Head>
            <title key="title">{metaContent.title ?? ' '}</title>

            <link
                href="https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,300;0,500;0,700;1,600&display=swap"
                rel="stylesheet"></link>
            <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@300;400;600;800;900&display=swap" rel="stylesheet"></link>

            <meta name="og:title" content={metaContent.title ?? ' '} key="og:title" />
            <meta name="description" content={metaContent.description ?? ' '} key="description" />

            <meta name="og:description" content={metaContent.description ?? ' '} key="og:description" />
            <meta name="og:image" content={metaContent.image ?? ' '} key="og:image" />
        </Head>
    )
}
