// ==UserScript==
// @name         Auto KSK TD - Simple UI
// @namespace    medinet-autofill-simple-ui
// @version      8.00-preview.3
// @description  Giao diện tối giản: một nút tự động điền, trạng thái rõ ràng, tự lưu chạy ngầm.
// @match        https://quanlyskcd.medinet.org.vn/*
// @grant        none
// @run-at       document-idle
// @noframes
// @require      https://raw.githubusercontent.com/VietsDragon/KSKTD/ux-autosave-refactor/medinet-autofill-m3-m4-ux-v2.user.js
// ==/UserScript==

(function () {
    'use strict';

    function norm(text) {
        return (text || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    function isLoginPage() {
        const p = norm(location.pathname);
        return p.includes('/account/login') || p.endsWith('/login');
    }

    function ensureStyle() {
        if (document.getElementById('ksk-simple-ui-style')) return;
        const style = document.createElement('style');
        style.id = 'ksk-simple-ui-style';
        style.textContent = `
            body.ksk-simple-login #ksk-ux-root,
            body.ksk-simple-login #ksk-ux-toast-host {
                display:none !important;
            }

            #ksk-ux-root {
                width: 226px !important;
                border-radius: 15px !important;
                border: 1px solid #e2e8f0 !important;
                box-shadow: 0 12px 30px rgba(15,23,42,.15) !important;
            }

            #ksk-ux-root .ksk-ux-row,
            #ksk-ux-root .ksk-ux-tools,
            #ksk-ux-root .ksk-ux-foot {
                display:none !important;
            }

            #ksk-ux-root .ksk-ux-head {
                padding: 11px 12px 9px !important;
            }

            #ksk-ux-root .ksk-ux-body {
                padding: 11px 12px 12px !important;
            }

            #ksk-ux-root .ksk-ux-primary {
                min-height: 46px !important;
                border-radius: 11px !important;
                font-size: 13.5px !important;
                font-weight: 700 !important;
                box-shadow: 0 5px 14px rgba(37,99,235,.18) !important;
            }

            #ksk-ux-root .ksk-ux-status-card {
                margin-top: 9px !important;
                padding: 8px 10px !important;
                border-radius: 9px !important;
            }

            #ksk-ux-root #ksk-ux-status { font-size: 12px !important; }
            #ksk-ux-root #ksk-ux-detail { font-size: 11px !important; margin-top: 2px !important; }
            #ksk-ux-root .ksk-ux-context { font-size: 11px !important; max-width: 160px !important; }
        `;
        document.head.appendChild(style);
    }

    function simplify() {
        if (!document.body) return;
        document.body.classList.toggle('ksk-simple-login', isLoginPage());

        const root = document.getElementById('ksk-ux-root');
        if (!root || isLoginPage()) return;

        const brand = root.querySelector('.ksk-ux-brand strong');
        if (brand) brand.textContent = 'KSK AUTO';

        const context = root.querySelector('.ksk-ux-context');
        if (context) {
            const parts = (context.textContent || '').split('·');
            if (parts.length > 1) context.textContent = parts.slice(1).join('·').trim();
        }

        const run = root.querySelector('#ksk-ux-run');
        if (run) {
            if (run.disabled && norm(run.textContent).includes('đang')) {
                run.textContent = '⏳ ĐANG XỬ LÝ…';
            } else if (!run.disabled) {
                run.textContent = '⚡ TỰ ĐỘNG ĐIỀN';
            }
        }

        const autoSave = root.querySelector('#ksk-ux-autosave');
        if (autoSave && !autoSave.checked) autoSave.click();
    }

    function boot() {
        ensureStyle();
        simplify();
        const observer = new MutationObserver(simplify);
        observer.observe(document.documentElement, { childList:true, subtree:true });
        setInterval(simplify, 900);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot, { once:true });
    } else {
        boot();
    }
})();
