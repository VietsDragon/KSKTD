// ==UserScript==
// @name         Auto KSK TD - UX Preview v2
// @namespace    medinet-autofill-m3-m4-ux-v2
// @version      8.00-preview.2
// @description  Bản vá UI preview: ẩn toàn bộ nút legacy và không hiển thị KSK AUTO ở trang đăng nhập.
// @match        https://quanlyskcd.medinet.org.vn/*
// @grant        none
// @run-at       document-idle
// @noframes
// @require      https://raw.githubusercontent.com/VietsDragon/KSKTD/ux-autosave-refactor/medinet-autofill-m3-m4-ux.user.js
// ==/UserScript==

(function () {
    'use strict';

    const PATCH = '[KSK UX v2]';
    const HIDDEN_CLASS = 'ksk-ux-legacy-hidden';

    function norm(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function isLoginPage() {
        const path = norm(location.pathname);
        return (
            path.includes('/account/login') ||
            path.endsWith('/login')
        );
    }

    function ensurePatchStyle() {
        if (document.getElementById('ksk-ux-v2-style')) return;

        const style = document.createElement('style');
        style.id = 'ksk-ux-v2-style';
        style.textContent = `
            .${HIDDEN_CLASS} {
                visibility: hidden !important;
                opacity: 0 !important;
                pointer-events: none !important;
            }

            body.ksk-ux-login #ksk-ux-root,
            body.ksk-ux-login #ksk-ux-toast-host {
                display: none !important;
            }
        `;
        document.head.appendChild(style);
    }

    function isUxElement(el) {
        return !!(
            el.closest &&
            (
                el.closest('#ksk-ux-root') ||
                el.closest('#ksk-ux-toast-host')
            )
        );
    }

    function looksLikeLegacyControl(el) {
        if (!el || isUxElement(el)) return false;

        const id = norm(el.id);
        const cls = norm(typeof el.className === 'string' ? el.className : '');
        const text = norm(el.innerText || el.textContent || el.value || '');

        // ID/class do chính userscript gốc tạo.
        if (id.startsWith('medinet-auto-')) return true;
        if (cls.includes('medinet-toolbar-btn')) return true;

        // Bắt các nút cũ có tên không thống nhất như AUTO M5/M6,
        // XEM CẢNH BÁO, DEBUG D-CODE... nhưng không đụng nút Medinet bình thường.
        const legacyText = (
            /^🚀?\s*auto\s*m\d/.test(text) ||
            text.includes('auto m2') ||
            text.includes('auto m3') ||
            text.includes('auto m4') ||
            text.includes('auto m5') ||
            text.includes('auto m6') ||
            text.includes('auto m5/m6') ||
            text === 'xem cảnh báo' ||
            text.includes('debug d-code')
        );

        if (!legacyText) return false;

        // Chỉ che control dạng nút/interactive để không che chữ trong nội dung hồ sơ.
        const tag = el.tagName ? el.tagName.toLowerCase() : '';
        const role = norm(el.getAttribute ? el.getAttribute('role') : '');
        return (
            tag === 'button' ||
            tag === 'a' ||
            tag === 'input' ||
            role === 'button' ||
            cls.includes('dx-button')
        );
    }

    function hideLegacyControls() {
        const selectors = [
            '[id^="medinet-auto-"]',
            '.medinet-toolbar-btn',
            'button',
            '[role="button"]',
            'a',
            'input[type="button"]',
            'input[type="submit"]',
            '.dx-button'
        ].join(',');

        document.querySelectorAll(selectors).forEach(el => {
            if (looksLikeLegacyControl(el)) {
                el.classList.add(HIDDEN_CLASS);
            }
        });
    }

    function syncRouteUi() {
        if (!document.body) return;

        const login = isLoginPage();
        document.body.classList.toggle('ksk-ux-login', login);

        if (login) {
            const root = document.getElementById('ksk-ux-root');
            if (root) root.style.display = 'none';
        } else {
            const root = document.getElementById('ksk-ux-root');
            if (root) root.style.removeProperty('display');
        }

        hideLegacyControls();
    }

    function boot() {
        ensurePatchStyle();
        syncRouteUi();

        // Medinet là SPA, nút có thể được Angular tạo lại sau khi đổi tab.
        // MutationObserver giữ giao diện sạch mà không cần biết ID mới của từng nút.
        const observer = new MutationObserver(() => {
            syncRouteUi();
        });

        observer.observe(document.documentElement, {
            childList: true,
            subtree: true
        });

        // Dự phòng cho thay đổi history/router không tạo mutation đáng kể.
        setInterval(syncRouteUi, 1000);

        console.info(PATCH, 'loaded');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once: true });
    } else {
        boot();
    }
})();
