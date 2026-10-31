// Settings pickers: a field-styled button that opens a bottom sheet inside the phone frame.
// The native <select> stays in the DOM as the source of truth (value, change events, existing code);
// it is only visually hidden. Call sync(select) after setting select.value from code.
(function () {
    'use strict';
    const enhanced = new WeakMap();
    let open = null;
    const appRoots = '#app-settings-window, #app-theme-window, #app-mcp-window, #app-role-tools-window';

    function fieldTitle(select) {
        const titles = { 'ls-shortcut-left': '左侧快捷按钮', 'ls-shortcut-right': '右侧快捷按钮',
            'lock-top-icon': '拍立得上方图标', 'lock-bottom-icon': '拍立得下方图标',
            'widget-type-1': '组件一类型', 'widget-type-2': '组件二类型',
            'widget-style-1': '组件一样式', 'widget-style-2': '组件二样式' };
        if (titles[select.id]) return titles[select.id];
        const label = select.labels?.[0] || select.closest('label');
        const directText = label && [...label.childNodes].filter(node => node.nodeType === 3).map(node => node.textContent).join(' ').trim();
        return select.dataset.sheetTitle || directText || label?.querySelector('span, strong')?.textContent.trim()
            || select.closest('.ls-shortcut-item')?.querySelector('.sub-label')?.textContent.trim()
            || select.getAttribute('aria-label') || '选择';
    }

    function labelFor(select) {
        const option = select.options[select.selectedIndex];
        return option ? option.textContent.trim() : '';
    }

    function sync(select) {
        const entry = enhanced.get(select);
        if (!entry) return;
        const text = labelFor(select) || entry.placeholder;
        if (entry.label.textContent !== text) entry.label.textContent = text;
        const style = entry.optionStyle?.(select.value);
        entry.label.style.fontFamily = style?.fontFamily || '';
        entry.trigger.disabled = select.disabled;
    }

    function close(focus) {
        if (!open) return;
        const { layer, trigger, select } = open;
        open = null;
        layer.remove();
        trigger.setAttribute('aria-expanded', 'false');
        if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
        else if (focus && select.id) {
            const replacement = document.getElementById(select.id);
            if (replacement && !replacement.disabled) enhance(replacement)?.focus({ preventScroll: true });
        }
    }

    function choose(select, value) {
        if (select.disabled || !select.isConnected) { close(true); return; }
        if (select.value !== value) {
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
        sync(select);
        close(true);
    }

    function optionButton(select, option, entry) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'bynd-sheet-option';
        button.setAttribute('role', 'option');
        const selected = option.value === select.value;
        button.setAttribute('aria-selected', String(selected));
        button.disabled = option.disabled || (option.parentElement?.tagName === 'OPTGROUP' && option.parentElement.disabled);
        const text = document.createElement('span');
        text.textContent = option.textContent.trim();
        const style = entry.optionStyle?.(option.value);
        if (style?.fontFamily) text.style.fontFamily = style.fontFamily;
        const check = document.createElement('i');
        check.className = 'ri-check-line';
        check.setAttribute('aria-hidden', 'true');
        button.append(text, check);
        button.addEventListener('click', () => choose(select, option.value));
        return button;
    }

    function openSheet(select) {
        close(false);
        const entry = enhanced.get(select);
        const phone = select.closest('.phone-container');
        if (!entry || !phone || select.disabled) return;
        const layer = document.createElement('div');
        layer.className = 'bynd-sheet-layer';
        const sheet = document.createElement('div');
        sheet.className = 'bynd-sheet';
        sheet.setAttribute('role', 'dialog');
        sheet.setAttribute('aria-modal', 'true');
        sheet.setAttribute('aria-label', entry.title);
        const head = document.createElement('div');
        head.className = 'bynd-sheet-head';
        const title = document.createElement('strong');
        title.textContent = entry.title;
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'bynd-sheet-close';
        done.textContent = '完成';
        done.addEventListener('click', () => close(true));
        head.append(title, done);
        const list = document.createElement('div');
        list.className = 'bynd-sheet-list';
        list.setAttribute('role', 'listbox');
        list.setAttribute('aria-label', entry.title);
        for (const child of select.children) {
            if (child.tagName === 'OPTGROUP') {
                const group = document.createElement('div');
                group.className = 'bynd-sheet-group';
                group.setAttribute('role', 'presentation');
                group.textContent = child.label;
                list.append(group);
                for (const option of child.children) list.append(optionButton(select, option, entry));
            } else if (child.tagName === 'OPTION') {
                list.append(optionButton(select, child, entry));
            }
        }
        sheet.append(head, list);
        layer.append(sheet);
        phone.append(layer);
        open = { layer, trigger: entry.trigger, select };
        entry.trigger.setAttribute('aria-expanded', 'true');
        layer.addEventListener('click', event => { if (event.target === layer) close(true); });
        layer.addEventListener('keydown', event => {
            const buttons = [...sheet.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement);
            if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Tab'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (index + (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey) ? -1 : 1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
        });
        const current = list.querySelector('[aria-selected="true"]:not(:disabled)') || list.querySelector('button:not(:disabled)') || done;
        current.focus({ preventScroll: true });
        current.scrollIntoView({ block: 'center' });
    }

    function enhance(select, options = {}) {
        if (!select) return null;
        if (enhanced.has(select)) {
            const entry = enhanced.get(select);
            if (options.title) { entry.title = options.title; entry.trigger.setAttribute('aria-label', options.title); }
            if (options.optionStyle) entry.optionStyle = options.optionStyle;
            if (options.placeholder !== undefined) entry.placeholder = options.placeholder;
            sync(select); return entry.trigger;
        }
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'bynd-sheet-trigger';
        trigger.setAttribute('aria-haspopup', 'dialog');
        trigger.setAttribute('aria-expanded', 'false');
        const labelledBy = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;
        const title = options.title || labelledBy?.textContent.trim() || fieldTitle(select);
        trigger.setAttribute('aria-label', title);
        const label = document.createElement('span');
        label.className = 'bynd-sheet-trigger-label';
        const arrow = document.createElement('i');
        arrow.className = 'ri-arrow-down-s-line';
        arrow.setAttribute('aria-hidden', 'true');
        trigger.append(label, arrow);
        select.classList.add('bynd-sheet-native');
        select.tabIndex = -1;
        select.setAttribute('aria-hidden', 'true');
        select.after(trigger);
        for (const linkedLabel of select.labels || (labelledBy ? [labelledBy] : [])) {
            linkedLabel.addEventListener('click', event => {
                if (event.target.closest('button, a, input, textarea') || event.target === select) return;
                event.preventDefault(); trigger.focus();
            });
        }
        enhanced.set(select, { trigger, label, title, placeholder: options.placeholder || '请选择', optionStyle: options.optionStyle });
        trigger.addEventListener('click', () => openSheet(select));
        select.addEventListener('change', () => sync(select));
        // Options are often re-rendered with innerHTML; keep the label current.
        new MutationObserver(() => {
            sync(select);
            if (open?.select === select) close(true);
        }).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        sync(select);
        return trigger;
    }

    function enhanceAll(root) {
        root?.querySelectorAll('select').forEach(select => {
            // API/model editors have their own searchable picker; keep its single trigger.
            if (select.matches('[multiple], [data-native-select], .api-model-native, .api-native-hidden, .notify-native-select, .elevenlabs-select-native') || select.closest('.api-model-picker')) return;
            enhance(select);
        });
    }

    function watchApps() {
        // Storage-only hosts may load the settings bundle without a complete DOM.
        if (typeof document.querySelectorAll !== 'function' || typeof MutationObserver !== 'function') return;
        for (const root of document.querySelectorAll(appRoots)) {
            enhanceAll(root);
            let scheduled = false;
            new MutationObserver(() => {
                if (scheduled) return;
                scheduled = true;
                requestAnimationFrame(() => {
                    scheduled = false;
                    if (open && (!open.select.isConnected || !open.select.closest('.app-window.active'))) close(false);
                    enhanceAll(root);
                });
            }).observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
        }
    }

    window.ByndSheetSelect = { enhance, enhanceAll, sync, close };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchApps, { once: true });
    else watchApps();
})();
