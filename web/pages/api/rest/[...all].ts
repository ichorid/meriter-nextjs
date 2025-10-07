import httpProxyMiddleware from "next-http-proxy-middleware";

const proxyTarget = process.env.BACKEND_URL || "http://localhost:8002";

export default (req, res) => {
    try {
        return httpProxyMiddleware(req, res, {
            // You can use the `http-proxy` option
            target: proxyTarget,
            // In addition, you can use the `pathRewrite` option provided by `next-http-proxy`
            /*  pathRewrite: {
                '^/api/new': '/v2',
                '^/api': '',
            },*/
        });
    } catch (e) {
        console.log(e);
    }
    return "unavaliable";
};
