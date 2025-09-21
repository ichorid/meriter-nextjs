import { useEffect, useLayoutEffect, useState } from 'react'

const hashCode = function (str) {
    var hash = 0
    if (str.length == 0) {
        return hash
    }
    for (var i = 0; i < str.length; i++) {
        var char = str.charCodeAt(i)
        hash = (hash << 5) - hash + char
        hash = hash & hash // Convert to 32bit integer
    }
    return hash
}

const TgEmbed1 = ({ src }) => {
    useLayoutEffect(() => {
        const script = document.createElement('script')
        script.src = 'https://telegram.org/js/telegram-widget.js?10'
        script.dataset['telegramPost'] = src
        script.dataset['width'] = '100%'
        script.dataset['userpic'] = 'false'
        document.getElementsByClassName(String(hashCode(src)))[0].appendChild(script)
    }, [])
    return (
        <div className="tg-embed">
            <div className={String(hashCode(src))}></div>
        </div>
    )
}

const TgEmbed = ({ src }) => {
    useState()
    return <div>{src}</div>
}

export default TgEmbed
