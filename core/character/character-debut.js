// A first-add cinematic. Normal chat navigation never calls this player.
(() => {
    const SOURCE = 'assets/characters/builtin/shanghuan-debut.mp4?v=op-pv-8';
    let active = null;

    function play(char) {
        if (!char || char.builtinId !== 'shanghuan') return Promise.resolve();
        if (active) return active.promise;
        const root = document.getElementById('app-wechat-window');
        if (!root) return Promise.resolve();
        const previousFocus = document.activeElement;
        const layer = document.createElement('section');
        layer.id = 'bynd-character-debut';
        layer.className = 'bynd-character-debut';
        layer.setAttribute('role', 'dialog');
        layer.setAttribute('aria-modal', 'true');
        layer.setAttribute('aria-label', '商桓 · 初次见面');
        layer.innerHTML = `<video playsinline webkit-playsinline preload="auto" poster="assets/characters/builtin/shanghuan-debut-poster.jpg?v=op-pv-8" aria-label="商桓的开场 OP，包括转笔和摘眼镜的亮相，接着过渡到回家做饭的剧情 PV。"></video>
            <div class="bynd-debut-controls"><button type="button" class="bynd-debut-sound" aria-label="关闭声音">声音开</button><button type="button" class="bynd-debut-skip">进入聊天 <span aria-hidden="true">↗</span></button></div>
            <button type="button" class="bynd-debut-resume" hidden>播放</button>
            <p class="bynd-debut-status" role="status">正在加载…</p>`;
        const video = layer.querySelector('video');
        const sound = layer.querySelector('.bynd-debut-sound');
        const skip = layer.querySelector('.bynd-debut-skip');
        const resume = layer.querySelector('.bynd-debut-resume');
        const status = layer.querySelector('.bynd-debut-status');
        let resolve, finished = false, timer, wasPlaying = false;
        const promise = new Promise(done => { resolve = done; });
        active = { promise, finish };
        root.appendChild(layer);

        function finish(reason = '', cancelled = false) {
            if (finished) return;
            finished = true;
            clearTimeout(timer);
            document.removeEventListener('keydown', onKey);
            document.removeEventListener('visibilitychange', onVisibility);
            video.pause();
            video.removeAttribute('src');
            video.load();
            layer.remove();
            active = null;
            if (previousFocus?.isConnected) previousFocus.focus();
            if (reason && typeof showWechatToast === 'function') showWechatToast(reason);
            resolve({ cancelled });
        }
        function armTimeout() {
            if (finished) return;
            clearTimeout(timer);
            if (!document.hidden) timer = setTimeout(() => finish('亮相视频暂时无法播放，已进入聊天。'), 15000);
        }
        function syncSound() {
            sound.textContent = video.muted ? '开启声音' : '声音开';
            sound.setAttribute('aria-label', video.muted ? '开启声音' : '关闭声音');
            sound.setAttribute('aria-pressed', String(!video.muted));
        }
        async function start() {
            try {
                await video.play();
            } catch (error) {
                if (finished || document.hidden) return;
                if (error.name !== 'NotAllowedError') { finish('亮相视频暂时无法播放，已进入聊天。'); return; }
                // Saving the card can outlast the tap's audio autoplay permission.
                video.muted = true;
                syncSound();
                try { await video.play(); }
                catch (_) { if (!finished) { clearTimeout(timer); resume.hidden = false; status.textContent = '轻触播放，或直接进入聊天'; } }
            }
        }
        function onKey(event) {
            if (event.key === 'Escape') { event.preventDefault(); finish(); }
            if (event.key === 'Tab') {
                const buttons = [sound, skip, ...(!resume.hidden ? [resume] : [])];
                const index = buttons.indexOf(document.activeElement);
                event.preventDefault();
                buttons[(index + (event.shiftKey ? buttons.length - 1 : 1)) % buttons.length].focus();
            }
        }
        function onVisibility() {
            if (document.hidden) { wasPlaying = !video.paused; video.pause(); clearTimeout(timer); }
            else if (wasPlaying) { armTimeout(); start(); }
        }
        skip.addEventListener('click', () => finish());
        sound.addEventListener('click', () => { video.muted = !video.muted; syncSound(); if (video.paused) start(); });
        resume.addEventListener('click', () => { resume.hidden = true; video.muted = false; syncSound(); armTimeout(); start(); });
        video.addEventListener('ended', () => finish());
        video.addEventListener('error', () => finish('亮相视频暂时无法播放，已进入聊天。'));
        video.addEventListener('timeupdate', armTimeout);
        video.addEventListener('playing', () => { status.textContent = ''; resume.hidden = true; armTimeout(); });
        document.addEventListener('keydown', onKey);
        document.addEventListener('visibilitychange', onVisibility);
        video.src = SOURCE;
        syncSound();
        skip.focus();
        armTimeout();
        start();
        return promise;
    }
    window.ByndCharacterDebut = { play, close: () => active?.finish('', true) };
})();
