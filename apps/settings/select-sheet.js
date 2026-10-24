// Settings pickers: a field-styled button that opens a bottom sheet inside the phone frame.
// The native <select> stays in the DOM as the source of truth (value, change events, existing code);
// it is only visually hidden. Call sync(select) after setting select.value from code.
(function () {
    'use strict';
    const enhanced = new WeakMap();
    let open = null;

    function labelFor(select) {
        const option = select.options[select.selectedIndex];
        return option ? option.textContent.trim() : '';
    }

    function sync(select) {
        const entry = enhanced.get(select);
        if (!entry) return;
        entry.label.textContent = labelFor(select) || entry.placeholder;
        const style = entry.optionStyle?.(select.value);
        entry.label.style.fontFamily = style?.fontFamily || '';
        entry.trigger.disabled = select.disabled;
    }

    function close(focus) {
        if (!open) return;
        const { layer, trigger } = open;
        open = null;
        layer.remove();
        trigger.setAttribute('aria-expanded', 'false');
        if (focus && trigger.isConnected) trigger.focus({ preventScroll: true });
    }

    function choose(select, value) {
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
        button.disabled = option.disabled;
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
        open = { layer, trigger: entry.trigger };
        entry.trigger.setAttribute('aria-expanded', 'true');
        layer.addEventListener('click', event => { if (event.target === layer) close(true); });
        layer.addEventListener('keydown', event => {
            const buttons = [...sheet.querySelectorAll('button:not(:disabled)')];
            const index = buttons.indexOf(document.activeElement);
            if (event.key === 'Escape') { event.preventDefault(); close(true); return; }
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
                : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
            buttons[next]?.focus();
        });
        const current = list.querySelector('[aria-selected="true"]') || list.querySelector('button:not(:disabled)') || done;
        current.focus({ preventScroll: true });
        current.scrollIntoView({ block: 'center' });
    }

    function enhance(select, options = {}) {
        if (!select) return null;
        if (enhanced.has(select)) { sync(select); return enhanced.get(select).trigger; }
        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'bynd-sheet-trigger';
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        const labelledBy = select.id ? document.querySelector(`label[for="${select.id}"]`) : null;
        const title = options.title || labelledBy?.textContent.trim() || select.getAttribute('aria-label') || '选择';
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
        if (labelledBy) labelledBy.addEventListener('click', event => { event.preventDefault(); trigger.focus(); });
        enhanced.set(select, { trigger, label, title, placeholder: options.placeholder || '请选择', optionStyle: options.optionStyle });
        trigger.addEventListener('click', () => openSheet(select));
        select.addEventListener('change', () => sync(select));
        // Options are often re-rendered with innerHTML; keep the label current.
        new MutationObserver(() => sync(select)).observe(select, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
        sync(select);
        return trigger;
    }

    window.ByndSheetSelect = { enhance, sync, close };
})();
