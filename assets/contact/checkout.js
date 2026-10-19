(function () {
    'use strict';
    const number = document.getElementById('qq-number'), status = document.getElementById('qq-status');
    document.getElementById('qq-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(number.value);
            status.textContent = '已复制 QQ 号，去 QQ 搜索添加好友吧。';
        } catch {
            number.focus(); number.select();
            status.textContent = '无法自动复制，请长按号码手动复制。';
        }
    };
})();
