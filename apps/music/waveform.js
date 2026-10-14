// A full-track amplitude waveform with a playhead driven by HTMLAudioElement.
// Decoding never changes the playback pipeline (including CORS-restricted sources).
(() => {
    'use strict';
    const COUNT = 112, MAX_BYTES = 24 * 1024 * 1024;
    const cache = new Map();
    let currentKey = null, currentPeaks = null, controller = null, frame = 0;
    const source = track => String(track?.audioUrl || '');
    // Some music services reuse one stream endpoint for multiple song IDs.
    // Cache by song and source together so switching songs cannot reuse old peaks.
    const trackKey = track => {
        const url = source(track);
        return url ? JSON.stringify([String(track?.sourceKey || ''), String(track?.id ?? track?.remoteId ?? `${track?.trackName || ''}|${track?.artistName || ''}`), url]) : '';
    };
    function peaksFromBuffer(buffer, count = COUNT) {
        const bins = new Array(count).fill(0);
        for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
            const samples = buffer.getChannelData(channel);
            for (let i = 0; i < count; i++) {
                const start = Math.floor(i * samples.length / count), end = Math.floor((i + 1) * samples.length / count);
                const step = Math.max(1, Math.floor((end - start) / 1024));
                let sum = 0, peak = 0, n = 0;
                for (let j = start; j < end; j += step) {
                    const sample = samples[j];
                    sum += sample * sample; peak = Math.max(peak, Math.abs(sample)); n++;
                }
                // Keep short transients visible instead of averaging every spike away.
                const amplitude = n ? Math.sqrt(sum / n) * 0.7 + peak * 0.3 : 0;
                bins[i] = Math.max(bins[i], amplitude);
            }
        }
        const max = Math.max(...bins);
        return bins.map(value => max > 0 ? Math.pow(Math.min(1, value / max), 1.6) : 0);
    }
    function barsMarkup(peaks = null, className = 'music-wave-bar') {
        return Array.from({ length: COUNT }, (_, i) => {
            const height = Math.round(2 + (peaks?.[i] || 0) * 60);
            return `<span class="${className}" style="--h:${height}px;--bar-h:${height}px;--wave-i:${i};--bar-i:${i}"></span>`;
        }).join('');
    }
    function paint(state) {
        document.querySelectorAll('#app-music-window .music-wave, #mn-player-progress').forEach(node => {
            node.innerHTML = barsMarkup(currentPeaks, node.id === 'mn-player-progress' ? 'mn-wave-bar' : 'music-wave-bar');
            node.dataset.waveformState = state;
            node.title = state === 'unavailable' ? '该音源无法读取完整波形，播放进度仍可点击调整' : '点击波形调整播放位置';
        });
        if (typeof updateMusicProgress === 'function') updateMusicProgress();
    }
    async function readBounded(response) {
        if (!response.ok) throw new Error('audio HTTP ' + response.status);
        if (Number(response.headers.get('content-length')) > MAX_BYTES) throw new Error('audio exceeds waveform limit');
        if (!response.body?.getReader) {
            const bytes = await response.arrayBuffer();
            if (bytes.byteLength > MAX_BYTES) throw new Error('audio exceeds waveform limit');
            return bytes;
        }
        const reader = response.body.getReader(), chunks = []; let size = 0;
        try {
            for (;;) {
                const {done, value} = await reader.read(); if (done) break;
                size += value.byteLength;
                if (size > MAX_BYTES) { await reader.cancel(); throw new Error('audio exceeds waveform limit'); }
                chunks.push(value);
            }
        } finally { reader.releaseLock(); }
        const bytes = new Uint8Array(size); let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
        return bytes.buffer;
    }
    async function setTrack(track) {
        const url = source(track), key = trackKey(track);
        if (key === currentKey) return;
        currentKey = key; currentPeaks = null; controller?.abort();
        if (!key) { paint('empty'); return; }
        if (cache.has(key)) { currentPeaks = cache.get(key); paint(currentPeaks ? 'ready' : 'unavailable'); return; }
        const taskController = new AbortController(); controller = taskController;
        paint('loading');
        const timer = setTimeout(() => taskController.abort(), 15000);
        let context;
        try {
            const bytes = await readBounded(await fetch(url, { signal:taskController.signal }));
            if (taskController.signal.aborted || currentKey !== key) return;
            const Offline = window.OfflineAudioContext || window.webkitOfflineAudioContext;
            const Live = window.AudioContext || window.webkitAudioContext;
            if (!Offline && !Live) throw new Error('audio decoding unavailable');
            context = Offline ? new Offline(1, 1, 8000) : new Live();
            const buffer = await context.decodeAudioData(bytes);
            const peaks = peaksFromBuffer(buffer);
            if (taskController.signal.aborted || currentKey !== key) return;
            cache.set(key, peaks); currentPeaks = peaks; paint('ready');
        } catch (_) {
            if (currentKey !== key || controller !== taskController) return;
            cache.set(key, null); currentPeaks = null; paint('unavailable');
        } finally {
            clearTimeout(timer);
            if (context?.close) await context.close().catch(() => {});
            while (cache.size > 8) cache.delete(cache.keys().next().value);
        }
    }
    function sync(current, total, playing) {
        const ratio = Number.isFinite(total) && total > 0 ? Math.max(0, Math.min(1, (Number(current) || 0) / total)) : 0;
        document.querySelectorAll('#app-music-window .music-wave, #mn-player-progress').forEach(node => {
            node.style.setProperty('--music-wave-progress', `${ratio * 100}%`);
            node.classList.toggle('is-playing', playing);
            node.setAttribute('aria-valuemax', String(Number.isFinite(total) && total > 0 ? Math.round(total) : 0));
            node.setAttribute('aria-valuenow', String(Math.round(Number(current) || 0)));
            const bars = node.querySelectorAll('span'), active = Math.floor(ratio * bars.length);
            bars.forEach((bar, i) => {
                bar.classList.toggle('active', i < active);
                bar.classList.toggle('near', ratio > 0 && ratio < 1 && Math.abs(i - active) <= 2);
            });
        });
    }
    function follow(audio) {
        cancelAnimationFrame(frame);
        let last = 0;
        const tick = stamp => {
            if (audio.paused || audio.ended) { frame = 0; return; }
            if (stamp - last >= 32) { sync(audio.currentTime, audio.duration, true); last = stamp; }
            frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
    }
    function stop() { cancelAnimationFrame(frame); frame = 0; }
    function keySeek(event) {
        if (typeof musicAudio === 'undefined' || !musicAudio || !Number.isFinite(musicAudio.duration) || musicAudio.duration <= 0) return;
        const moves = { ArrowLeft:-5, ArrowDown:-5, ArrowRight:5, ArrowUp:5 };
        if (!(event.key in moves) && !['Home','End'].includes(event.key)) return;
        event.preventDefault(); event.stopPropagation();
        const target = event.key === 'Home' ? 0 : event.key === 'End' ? musicAudio.duration : musicAudio.currentTime + moves[event.key];
        musicAudio.currentTime = Math.max(0, Math.min(musicAudio.duration, target)); updateMusicProgress();
    }
    window.ByndMusicWaveform = { setTrack, sync, follow, stop, keySeek, peaksFromBuffer, barsMarkup,
        markup: track => barsMarkup(cache.get(trackKey(track)), 'mn-wave-bar') };
})();
