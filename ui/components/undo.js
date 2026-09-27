(function () {
    'use strict';
    function offer({ label = '已删除', undo, duration = 8000 }) {
        const phone = document.querySelector('.phone-container');
        if (!phone || typeof undo !== 'function') return null;
        let tray = document.getElementById('bynd-undo-tray');
        if (!tray) { tray = document.createElement('div'); tray.id = 'bynd-undo-tray'; phone.appendChild(tray); }
        const row = document.createElement('div'); row.className = 'bynd-undo-row'; row.setAttribute('role', 'status');
        const text = document.createElement('span'); text.textContent = label;
        const button = document.createElement('button'); button.type = 'button'; button.textContent = '撤销';
        row.append(text, button); tray.appendChild(row);
        let timer;
        const expire = () => { clearTimeout(timer); row.remove(); if (!tray.children.length) tray.remove(); };
        const arm = () => { clearTimeout(timer); timer = setTimeout(expire, duration); };
        arm();
        row.addEventListener('pointerenter', () => clearTimeout(timer)); row.addEventListener('pointerleave', arm);
        row.addEventListener('focusin', () => clearTimeout(timer)); row.addEventListener('focusout', arm);
        button.addEventListener('click', async () => {
            clearTimeout(timer); button.disabled = true;
            try { if (await undo() === false) throw new Error('恢复未能保存'); expire(); window.showWechatToast?.('已恢复'); }
            catch (error) { console.warn('撤销失败', error); text.textContent = `恢复失败：${error.message || '请重试'}`; button.textContent = '重试撤销'; button.disabled = false; }
        });
        return { expire };
    }
    window.ByndUndo = { offer };
})();
