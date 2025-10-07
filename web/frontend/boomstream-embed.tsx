export const BoomstreamEmbed = ({ boomstreamId }) => {
    return (
        <iframe
            width="640"
            height="360"
            style={{ maxWidth: '100%', boxSizing: 'border-box' }}
            src={`https://play.boomstream.com/${boomstreamId}`}
            frameBorder="0"
            scrolling="no"
            allowFullScreen></iframe>
    )
}
