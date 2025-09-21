
import Head from 'next/head'
import { Fragment } from 'react'

export const MetrikaMeriter = () => (
    <Head>
        <script
            dangerouslySetInnerHTML={{
                __html: `(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
                m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
                (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
             
                ym(70720492, "init", {
                     clickmap:true,
                     trackLinks:true,
                     accurateTrackBounce:true
                });`,
            }}
        />
        <noscript
            dangerouslySetInnerHTML={{
                __html: `<img src="https://mc.yandex.ru/watch/70720492" style="position:absolute; left:-9999px;" alt="" /></div>`,
            }}
        />
    </Head>
)

/*
<!-- Yandex.Metrika counter -->
<script type="text/javascript" >
   (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
   m[i].l=1*new Date();k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
   (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");

   ym(70720492, "init", {
        clickmap:true,
        trackLinks:true,
        accurateTrackBounce:true
   });
</script>
<noscript><div><img src="https://mc.yandex.ru/watch/70720492" style="position:absolute; left:-9999px;" alt="" /></div></noscript>
<!-- /Yandex.Metrika counter -->
  */
