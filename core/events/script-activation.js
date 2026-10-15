// Authored HTML stays in an opaque frame. Its only host capability is resizing.
const wechatRichFrameChannels = new WeakMap();
let wechatRichFrameListenerBound = false;

function wechatRichFrameBootstrap(channel) {
    let pending = false;
    const reportSize = () => {
        if (pending) return;
        pending = true;
        requestAnimationFrame(() => {
            pending = false;
            const content = document.getElementById('wc-rich-content');
            parent.postMessage({ type: 'bynd-rich-size', channel, height: Math.ceil(content?.getBoundingClientRect().height || 0) }, '*');
        });
    };
    document.addEventListener('DOMContentLoaded', () => {
        const content = document.getElementById('wc-rich-content');
        if (typeof ResizeObserver === 'function' && content) new ResizeObserver(reportSize).observe(content);
        document.addEventListener('load', reportSize, true);
        document.addEventListener('toggle', reportSize, true);
        document.addEventListener('click', event => {
            const trigger = event.target.closest?.('a, button, .decrypt-button, .encrypted-overlay, .secret-note, [data-secret], [data-reveal], [data-wc-rich-handler]');
            if (!trigger) return;
            // Navigation must not replace the card with a native-bridge document.
            if (trigger.matches('a')) event.preventDefault();
            const handler = trigger.getAttribute('data-wc-rich-handler') || trigger.getAttribute('onclick') || '';
            const section = trigger.closest('.encrypted-section');
            const overlay = section?.querySelector('.encrypted-overlay') || trigger.closest('.encrypted-overlay');
            if (overlay && (/decrypt|unlock|reveal/i.test(handler) || trigger.matches('.decrypt-button, .encrypted-overlay'))) {
                event.preventDefault(); overlay.classList.add('decrypted'); overlay.style.display = 'none';
            } else if (/hideModal|closeModal/i.test(handler) || trigger.matches('.close-modal, .wc-rich-modal-close')) {
                const modal = trigger.closest('.modal-overlay, .secret-modal, [id*="secretModal"], [class*="modal"]');
                if (modal) modal.style.display = 'none';
            } else if (/showModal|secretModal/i.test(handler) || trigger.matches('.secret-note, [data-secret], [data-reveal]')) {
                const modal = document.querySelector('.modal-overlay, .secret-modal, [id*="secretModal"], [class*="modal"]');
                if (modal) { modal.style.display = 'flex'; modal.classList.add('visible', 'active', 'show', 'open'); }
            }
            reportSize();
        });
        reportSize();
    });
    addEventListener('resize', reportSize);
}

function buildWechatRichFrameDocument(content, channel, nativeBridge = false) {
    const template = document.createElement('template');
    template.innerHTML = String(content || ''); // Inert; never attached to the app.
    template.content.querySelectorAll('base, meta, iframe, object, embed, link').forEach(el => el.remove());
    if (nativeBridge) {
        // Android's addJavascriptInterface is exposed even to opaque frames.
        // The APK permits only our nonced control runtime, never authored JS.
        template.content.querySelectorAll('script').forEach(el => el.remove());
        template.content.querySelectorAll('*').forEach(el => {
            for (const attr of [...el.attributes]) if (/^on/i.test(attr.name)) {
                if (attr.name.toLowerCase() === 'onclick') el.setAttribute('data-wc-rich-handler', attr.value);
                el.removeAttribute(attr.name);
            }
        });
    }
    const scriptPolicy = nativeBridge ? `'nonce-${channel}'` : "'unsafe-inline'";
    const policy = `default-src 'none'; script-src ${scriptPolicy}; style-src 'unsafe-inline'; img-src https: data: blob:; media-src https: data: blob:; font-src https: data:; connect-src 'none'; frame-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'`;
    const runtime = `(${wechatRichFrameBootstrap.toString()})(${JSON.stringify(channel)});`.replace(/<\/script/gi, '<\\/script');
    return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${policy}"><meta name="viewport" content="width=device-width, initial-scale=1"><style>html,body{margin:0;padding:0;background:transparent;font:15px/1.45 system-ui,sans-serif;color:#17212b}#wc-rich-content{display:flow-root;overflow-wrap:anywhere}*{box-sizing:border-box;max-width:100%}img,video,canvas,svg{height:auto}table{width:100%;table-layout:fixed}pre{white-space:pre-wrap}button,a,summary,[role=button]{cursor:pointer}.encrypted-overlay.decrypted{display:none!important}</style><script nonce="${channel}">${runtime}</script></head><body><main id="wc-rich-content">${template.innerHTML}</main></body></html>`;
}

function mountWechatRichMessageFrame(frame, content) {
    if (!frame) return;
    if (!wechatRichFrameListenerBound) {
        wechatRichFrameListenerBound = true;
        window.addEventListener('message', event => {
            const data = event.data;
            if (event.origin !== 'null' || !data || data.type !== 'bynd-rich-size' || !Number.isFinite(data.height)) return;
            const source = [...document.querySelectorAll('iframe.wc-rich-frame')].find(el => el.contentWindow === event.source);
            if (!source || wechatRichFrameChannels.get(source) !== data.channel) return;
            source.style.setProperty('height', `${Math.max(40, Math.min(1200, Math.ceil(data.height)))}px`, 'important');
        });
    }
    const channel = Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
    wechatRichFrameChannels.set(frame, channel);
    frame.setAttribute('sandbox', 'allow-scripts');
    frame.setAttribute('referrerpolicy', 'no-referrer');
    frame.srcdoc = buildWechatRichFrameDocument(content, channel, !!window.ByndAndroid);
}
