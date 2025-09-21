import { useEffect } from 'react'
import { classList } from 'utils/classList'

export const SimplePage = ({ children, coverImageUrl, blur, className }: any) => {
    useEffect(() => {
        const sc = (e) => {
            //   const r = Math.max(0, 1 - window.scrollY / 500)
            //     ;(document.querySelector('.simple-page-cover') as any).style.opacity = r
        }
        document.addEventListener('scroll', sc)
        return () => document.removeEventListener('scroll', sc)
    }, [])

    return (
        <div className={classList(className, 'simple-page')}>
            <div
                className="simple-page-cover"
                style={{ backgroundImage: `url(${coverImageUrl})`, filter: `blur(${blur ?? 20}px)brightness(50%)` }}></div>
            <div className="simple-page-overlay"></div>
            <div className="simple-page-inner">{children}</div>
        </div>
    )
}
