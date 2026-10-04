/* Small, project-owned line icons keep the home controls usable offline. */
(function (H) {
    'use strict';
    const paths = {
        'ri-arrow-left-s-line': '<path d="m14 5-7 7 7 7"/>',
        'ri-arrow-right-line': '<path d="M4 12h15m-6-6 6 6-6 6"/>',
        'ri-arrow-right-s-line': '<path d="m9 5 7 7-7 7"/>',
        'ri-close-line': '<path d="m6 6 12 12M18 6 6 18"/>',
        'ri-add-line': '<path d="M12 5v14M5 12h14"/>',
        'ri-subtract-line': '<path d="M5 12h14"/>',
        'ri-settings-4-line': '<circle cx="12" cy="12" r="3"/><path d="m10 3 4 0 .7 2.5 2.3 1 2.3-.7 2 3.4-1.7 1.8v2l1.7 1.8-2 3.5-2.3-.7-2.3 1L14 21h-4l-.7-2.4-2.3-1-2.3.7-2-3.5 1.7-1.8v-2L2.7 9.2l2-3.4 2.3.7 2.3-1z"/>',
        'ri-home-heart-line': '<path d="m3 10 9-7 9 7M5 9v11h14V9"/><path d="M12 17c-6-3-4-7-1-4 3-3 5 1 1 4z"/>',
        'ri-heart-3-line': '<path d="M12 20C-5 10 4 0 12 7 20 0 29 10 12 20z"/>',
        'ri-sofa-line': '<path d="M6 12V7c0-2 12-2 12 0v5M4 10c-3 0-3 6 0 6h16c3 0 3-6 0-6M4 16v4h16v-4M6 20v2m12-2v2M4 10c2 0 2 4 2 4h12s0-4 2-4"/>',
        'ri-hotel-bed-line': '<path d="M3 18V7m18 11V7M3 15h18v5M3 10h18M5 10V6h6v4m2 0V6h6v4"/>',
        'ri-gamepad-line': '<path d="M7 7h10c4 0 6 12 3 13l-5-4H9l-5 4C1 19 3 7 7 7zM7 10v5m-2.5-2.5h5M16 11h.1M18 14h.1"/>',
        'ri-fridge-line': '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M5 10h14M8 5v2m0 6v4"/>',
        'ri-restaurant-line': '<path d="M5 3v6c0 3 6 3 6 0V3M8 3v19M19 3c-5 2-5 9 0 9m0-9v19"/>',
        'ri-sparkling-line': '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5zM20 2v4m-2-2h4"/>',
        'ri-book-open-line': '<path d="M12 6C8 3 3 4 3 4v15s5-1 9 2c4-3 9-2 9-2V4s-5-1-9 2v15"/>',
        'ri-focus-3-line': '<path d="M3 8V3h5m8 0h5v5M3 16v5h5m8 0h5v-5"/><circle cx="12" cy="12" r="3"/>',
        'ri-smartphone-line': '<rect x="6" y="2" width="12" height="20" rx="3"/><path d="M10 5h4m-2 13v.1"/>',
        'ri-user-smile-line': '<circle cx="12" cy="8" r="5"/><path d="M3 22c0-10 18-10 18 0M10 9c0 2 4 2 4 0"/>',
        'ri-emotion-happy-line': '<circle cx="12" cy="12" r="9"/><path d="M8 10h.1M16 10h.1M8 14c0 5 8 5 8 0"/>',
        'ri-chat-1-line': '<path d="M4 4h16v13H9l-5 4z"/><path d="M7 9h10M7 13h7"/>',
        'ri-image-add-line': '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="m4 17 5-5 4 4 3-3 5 5M16 5v6m-3-3h6"/>',
        'ri-information-line': '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
        'ri-refresh-line': '<path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6"/>',
        'ri-plant-line': '<path d="M8 22h8l2-8H6zM12 14V8C5 10 3 7 3 3c6-1 10 2 9 7 1-7 5-8 9-7 0 6-3 8-9 6"/>',
        'ri-drop-line': '<path d="M12 2s-8 10-8 14a8 8 0 0 0 16 0c0-4-8-14-8-14z"/>',
        'ri-shirt-line': '<path d="m7 3-5 3 3 5 2-1v11h10V10l2 1 3-5-5-3c-1 4-9 4-10 0z"/>',
        'ri-gift-line': '<path d="M3 9h18v4H3zM5 13v8h14v-8M12 9v12M12 9C2 9 3 1 8 3l4 6c10 0 9-8 4-6z"/>'
    };
    H.Icons = { paint: name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || '<rect x="4" y="4" width="16" height="16" rx="5"/><path d="M8 12h8"/>') + '</svg>' };
})(window.ByndHome3D);
