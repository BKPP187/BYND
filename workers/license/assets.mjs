export function websiteCacheControl(path, status = 200) {
    return [200, 304].includes(status) && /^\/assets\/website\/bynd-(?:companion-(256|480|840)|payment-frame)-[a-f0-9]{12}\.webp$/.test(path)
        ? 'public,max-age=31536000,immutable' : 'no-store';
}
export async function website(request, env) {
    const path = new URL(request.url).pathname;
    if (!['/shop.html', '/account.html', '/checkout.html', '/license-admin.html', '/license-receipt.html'].includes(path) && !/^\/assets\/website\/[a-z0-9-]+\.(css|js|png|webp)$/.test(path)) return null;
    if (!['GET', 'HEAD'].includes(request.method)) return new Response(null, { status: 405 });
    if (!env.ASSETS) return new Response('Website assets are not configured', { status: 503 });
    const response = await env.ASSETS.fetch(request), headers = new Headers(response.headers);
    headers.set('Cache-Control', websiteCacheControl(path, response.status)); headers.set('Referrer-Policy', 'no-referrer'); headers.set('X-Content-Type-Options', 'nosniff');
    headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
    return new Response(response.body, { status: response.status, headers });
}
