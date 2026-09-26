// 🔥 通用工具：JS 脚本激活器 (供所有 App 使用)
function executeScriptsInElement(element) {
    // 1. 激活 <script> 标签
    const scripts = element.querySelectorAll('script');
    scripts.forEach(oldScript => {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => newScript.setAttribute(attr.name, attr.value));
        newScript.appendChild(document.createTextNode(oldScript.innerHTML));
        oldScript.parentNode.replaceChild(newScript, oldScript);
    });

    // 2. 激活 <audio> 元素 — 重新创建以确保浏览器识别
    const audios = element.querySelectorAll('audio');
    audios.forEach(oldAudio => {
        const newAudio = oldAudio.cloneNode(true);
        oldAudio.parentNode.replaceChild(newAudio, oldAudio);
        newAudio.load(); // 强制加载音频源
    });

    // 3. 修复 onclick 字符串属性的按钮/元素（innerHTML 不会自动绑定）
    element.querySelectorAll('[onclick]').forEach(el => {
        const handler = el.getAttribute('onclick');
        el.classList.add('wc-rich-clickable');
        el.dataset.wcRichClick = '1';
        el.dataset.wcRichOriginalOnclick = handler || '';
        el.removeAttribute('onclick');
        el.addEventListener('click', function(e) {
            const isDecryptHandler = /decryptContent/i.test(handler || '');
            if (isDecryptHandler && decryptWechatRichSection(this)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            const isModalHandler = /showModal|secretModal|hideModal|closeModal/i.test(handler || '');
            if (isModalHandler && openWechatRichModal(this, element)) {
                e.preventDefault();
                e.stopPropagation();
                return false;
            }
            try {
                const result = new Function('event', `with (this) { ${handler} }`).call(this, e);
                if (result === false) {
                    e.preventDefault();
                    e.stopPropagation();
                }
            } catch(err) {
                console.warn('onclick eval error:', err);
                if (isModalHandler) {
                    openWechatRichModal(this, element);
                }
            }
        });
    });

    bindWechatRichRevealFallbacks(element);
    bindWechatRichDetailsFallbacks(element);
}

