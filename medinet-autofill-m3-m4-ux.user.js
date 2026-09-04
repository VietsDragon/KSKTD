// ==UserScript==
// @name         Auto KSK TD - UX Preview
// @namespace    medinet-autofill-m3-m4-ux
// @version      8.00-preview.1
// @description  Lớp UI/UX mới cho Auto KSK TD: dock gọn, trạng thái chạy và tự lưu an toàn sau auto.
// @match        https://quanlyskcd.medinet.org.vn/*
// @grant        none
// @run-at       document-idle
// @noframes
// @require      https://raw.githubusercontent.com/VietsDragon/KSKTD/main/medinet-autofill-m3-m4.user.js
// ==/UserScript==

(function () {
    'use strict';

    const UX = '[KSK UX]';
    const STORAGE = {
        autoSave: 'ksk_ux_autosave_v1',
        collapsed: 'ksk_ux_collapsed_v1',
        forcedModel: 'ksk_ux_forced_model_v1'
    };

    const state = {
        busy: false,
        status: 'Sẵn sàng',
        detail: 'Đang nhận diện trang…',
        autoSave: readBool(STORAGE.autoSave, true),
        collapsed: readBool(STORAGE.collapsed, false),
        forcedModel: localStorage.getItem(STORAGE.forcedModel) || 'AUTO',
        lastRun: null,
        lastSave: null
    };

    function readBool(key, fallback) {
        const raw = localStorage.getItem(key);
        if (raw === null) return fallback;
        return raw === '1';
    }

    function norm(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function isVisible(el) {
        if (!el || !el.isConnected) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) {
            return false;
        }
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
    }

    function getTabTitle() {
        const el = document.querySelector('h2.hidden-web-title, .hidden-web-title');
        return el ? norm(el.innerText) : '';
    }

    function detectModel() {
        if (state.forcedModel !== 'AUTO') return state.forcedModel;

        const url = norm(location.href);
        const tab = getTabTitle();
        const body = norm(document.body ? document.body.innerText : '');

        if (
            url.includes('nguoilaixe') ||
            url.includes('nguoi_lai_xe') ||
            body.includes('người lái xe')
        ) return 'M5';

        if (
            url.includes('oto') ||
            body.includes('khám sức khỏe người lái xe ô tô')
        ) return 'M6';

        if (
            tab.includes('thông tin khám bệnh nhân dưới 18 tuổi') ||
            body.includes('thông tin khám bệnh nhân dưới 18 tuổi')
        ) return 'M2';

        if (
            tab.includes('hỏi bệnh và khám lâm sàng') ||
            body.includes('d8.5.1') ||
            body.includes('hầu như không')
        ) return 'M4';

        return 'M3';
    }

    function detectSection() {
        const tab = getTabTitle();
        const body = norm(document.body ? document.body.innerText : '');

        if (body.includes('kết quả xét nghiệm máu')) return 'Cận lâm sàng';
        if (tab.includes('hỏi bệnh và khám lâm sàng')) return 'Hỏi bệnh & khám LS';
        if (tab.includes('thông tin khám')) return 'Khám lâm sàng';
        if (body.includes('chưa phát hiện bất thường')) return 'Khám lâm sàng';
        if (body.includes('tiền sử')) return 'Tiền sử';
        return tab || 'Trang hiện tại';
    }

    function legacyButtonForModel(model) {
        const direct = document.getElementById(`medinet-auto-${model.toLowerCase()}`);
        if (direct) return direct;

        const candidates = [...document.querySelectorAll('[id^="medinet-auto-"]')]
            .filter(el => !el.closest('#ksk-ux-root'));
        return candidates.find(el => norm(el.textContent).includes(norm(model))) || null;
    }

    function legacyDebugButton() {
        return document.getElementById('medinet-auto-debug') ||
            [...document.querySelectorAll('[id^="medinet-auto-"]')]
                .find(el => norm(el.textContent).includes('debug')) || null;
    }

    function snapshotForm() {
        let nonEmptyInputs = 0;
        let selectedControls = 0;

        document.querySelectorAll('input, textarea, select').forEach(el => {
            if (el.closest('#ksk-ux-root')) return;
            if (el.disabled) return;
            const value = String(el.value || '').trim();
            if (value) nonEmptyInputs++;
        });

        document.querySelectorAll(
            '.dx-checkbox-checked, [role="radio"][aria-checked="true"], .dx-list-item-selected, input[type="checkbox"]:checked, input[type="radio"]:checked'
        ).forEach(el => {
            if (!el.closest('#ksk-ux-root')) selectedControls++;
        });

        return {
            nonEmptyInputs,
            selectedControls,
            score: nonEmptyInputs + selectedControls
        };
    }

    function setStatus(status, detail) {
        state.status = status;
        if (detail !== undefined) state.detail = detail;
        renderStatus();
    }

    function renderStatus() {
        const statusEl = document.getElementById('ksk-ux-status');
        const detailEl = document.getElementById('ksk-ux-detail');
        const root = document.getElementById('ksk-ux-root');
        if (!statusEl || !detailEl || !root) return;

        statusEl.textContent = state.status;
        detailEl.textContent = state.detail;
        root.classList.toggle('ksk-ux-busy', state.busy);
    }

    function showToast(message, type = 'ok', duration = 3200) {
        let host = document.getElementById('ksk-ux-toast-host');
        if (!host) {
            host = document.createElement('div');
            host.id = 'ksk-ux-toast-host';
            document.body.appendChild(host);
        }

        const toast = document.createElement('div');
        toast.className = `ksk-ux-toast ksk-ux-toast-${type}`;
        toast.textContent = message;
        host.appendChild(toast);

        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 220);
        }, duration);
    }

    function textOfButton(el) {
        return norm(el ? (el.innerText || el.textContent || el.value || '') : '');
    }

    function findSaveCandidates() {
        const selector = [
            'button',
            '[role="button"]',
            '.dx-button',
            'input[type="button"]',
            'input[type="submit"]'
        ].join(',');

        const all = [...document.querySelectorAll(selector)]
            .filter(el => !el.closest('#ksk-ux-root'))
            .filter(isVisible)
            .filter(el => !el.disabled)
            .filter(el => textOfButton(el) === 'lưu');

        return [...new Set(all)];
    }

    async function safeAutoSave(reason) {
        if (!state.autoSave) {
            setStatus('✓ Auto xong', 'Tự động lưu đang tắt');
            return { ok: false, skipped: true, reason: 'disabled' };
        }

        setStatus('Đang kiểm tra trước khi lưu…', reason || '');
        await sleep(250);

        const candidates = findSaveCandidates();

        if (candidates.length === 0) {
            setStatus('⚠ Auto xong nhưng chưa lưu', 'Không tìm thấy nút Lưu trên tab hiện tại');
            showToast('Auto xong nhưng KHÔNG tìm thấy nút Lưu', 'warn', 5200);
            return { ok: false, reason: 'no-save-button' };
        }

        if (candidates.length > 1) {
            setStatus('⚠ Chưa tự lưu', `Có ${candidates.length} nút Lưu khả dụng — cần tránh bấm nhầm`);
            showToast(`Có ${candidates.length} nút Lưu; đã bỏ qua Auto Save để an toàn`, 'warn', 5200);
            return { ok: false, reason: 'ambiguous-save-button' };
        }

        const saveButton = candidates[0];
        const beforeText = norm(document.body.innerText);

        setStatus('Đang lưu hồ sơ…', 'Đã Auto Fill xong');
        saveButton.click();
        state.lastSave = Date.now();

        // Theo dõi phản hồi giao diện. Không tự bấm nút xác nhận/hoàn chỉnh.
        let success = false;
        let failure = false;
        let successText = '';

        for (let i = 0; i < 18; i++) {
            await sleep(250);
            const bodyNow = norm(document.body.innerText);
            const delta = bodyNow === beforeText ? '' : bodyNow;

            const successHints = [
                'lưu thành công',
                'cập nhật thành công',
                'thành công',
                'đã lưu'
            ];
            const failureHints = [
                'lưu thất bại',
                'không thể lưu',
                'có lỗi xảy ra',
                'lỗi máy chủ'
            ];

            const foundFailure = failureHints.find(x => delta.includes(x));
            const foundSuccess = successHints.find(x => delta.includes(x));

            if (foundFailure) {
                failure = true;
                successText = foundFailure;
                break;
            }
            if (foundSuccess) {
                success = true;
                successText = foundSuccess;
                break;
            }
        }

        if (failure) {
            setStatus('⚠ Auto xong nhưng lưu lỗi', successText);
            showToast('Đã Auto Fill nhưng Medinet báo lỗi khi lưu', 'error', 6000);
            return { ok: false, reason: 'save-failed' };
        }

        if (success) {
            setStatus('✓ Đã Auto Fill & lưu', detectSection());
            showToast('✓ Đã tự động điền và lưu hồ sơ', 'ok');
            return { ok: true };
        }

        // Một số màn hình Medinet không phát thông báo dạng text.
        // Chỉ xác nhận rằng lệnh Lưu đã được gửi, không tuyên bố lưu thành công.
        setStatus('✓ Đã gửi lệnh Lưu', 'Chưa đọc được thông báo xác nhận từ Medinet');
        showToast('Đã Auto Fill và bấm Lưu; chưa đọc được phản hồi xác nhận', 'warn', 4800);
        return { ok: true, unverified: true };
    }

    async function runCurrentAuto() {
        if (state.busy) return;

        const model = detectModel();
        const legacyButton = legacyButtonForModel(model);

        if (!legacyButton) {
            setStatus('⚠ Không tìm thấy Auto', `Không thấy nút legacy ${model}`);
            showToast(`Không tìm thấy nút AUTO ${model}`, 'error');
            return;
        }

        const before = snapshotForm();
        const originalAlert = window.alert;
        const capturedAlerts = [];
        let hadSuccessAlert = false;
        let hadErrorAlert = false;

        window.alert = function (message) {
            const text = String(message || '');
            capturedAlerts.push(text);
            const n = norm(text);

            if (n.includes('✅') || n.includes('đã auto fill')) {
                hadSuccessAlert = true;
                return; // thay alert thành toast/status để giảm click thừa
            }

            if (n.includes('❌') || n.includes('lỗi auto')) {
                hadErrorAlert = true;
            }

            return originalAlert.call(window, message);
        };

        state.busy = true;
        state.lastRun = Date.now();
        setStatus(`⏳ Đang chạy ${model}`, detectSection());
        render();

        try {
            legacyButton.click();

            // Chờ routine thực sự bắt đầu.
            for (let i = 0; i < 20 && !legacyButton.disabled; i++) {
                await sleep(50);
            }

            // Chờ routine kết thúc. Modal nhập SID/tên có thể khiến thời gian chờ dài,
            // nên timeout 3 phút nhưng không chặn UI trang.
            let finished = false;
            for (let i = 0; i < 720; i++) {
                await sleep(250);
                if (!legacyButton.disabled) {
                    finished = true;
                    break;
                }
            }

            if (!finished) {
                setStatus('⚠ Auto chưa kết thúc', 'Quá thời gian theo dõi — không tự lưu');
                showToast('Auto chưa hoàn tất; Auto Save đã được chặn', 'warn', 5000);
                return;
            }

            await sleep(180);
            const after = snapshotForm();
            const delta = after.score - before.score;

            if (hadErrorAlert) {
                setStatus('❌ Auto có lỗi', 'Không thực hiện Auto Save');
                return;
            }

            // Điều kiện an toàn: routine báo thành công HOẶC form thực sự có thay đổi.
            // Nếu không có cả hai, tuyệt đối không bấm Lưu.
            if (!hadSuccessAlert && delta <= 0) {
                setStatus('⚠ Không xác nhận được dữ liệu', 'Auto Save đã bị chặn để tránh lưu hồ sơ trống');
                showToast('Không thấy dữ liệu mới sau Auto — đã KHÔNG tự lưu', 'warn', 5600);
                return;
            }

            await safeAutoSave(
                hadSuccessAlert
                    ? `${model} báo hoàn tất`
                    : `Phát hiện ${delta} thay đổi trên form`
            );

        } catch (err) {
            console.error(UX, err);
            setStatus('❌ Lỗi UI Auto', err.message || String(err));
            showToast('Lỗi lớp UX — không thực hiện Auto Save', 'error', 6000);
        } finally {
            window.alert = originalAlert;
            state.busy = false;
            render();
        }
    }

    function runDebug() {
        const btn = legacyDebugButton();
        if (!btn) {
            showToast('Không tìm thấy DEBUG D-CODE trong script hiện tại', 'warn');
            return;
        }
        btn.click();
    }

    function ensureStyles() {
        if (document.getElementById('ksk-ux-style')) return;

        const style = document.createElement('style');
        style.id = 'ksk-ux-style';
        style.textContent = `
            #medinet-auto-m2,
            #medinet-auto-m3,
            #medinet-auto-m4,
            #medinet-auto-m5,
            #medinet-auto-m6,
            #medinet-auto-debug {
                visibility: hidden !important;
                pointer-events: none !important;
            }

            #ksk-ux-root {
                position: fixed;
                right: 18px;
                bottom: 18px;
                width: 248px;
                z-index: 1000002;
                font-family: "Segoe UI", Roboto, Arial, sans-serif;
                color: #0f172a;
                background: rgba(255,255,255,.98);
                border: 1px solid #dbe3ec;
                border-radius: 16px;
                box-shadow: 0 14px 36px rgba(15,23,42,.18);
                overflow: hidden;
                backdrop-filter: blur(10px);
            }
            #ksk-ux-root * { box-sizing: border-box; }
            .ksk-ux-head {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                padding: 12px 13px 10px;
                border-bottom: 1px solid #eef2f7;
            }
            .ksk-ux-brand { min-width: 0; }
            .ksk-ux-brand strong { display:block; font-size: 13px; letter-spacing: .2px; }
            .ksk-ux-context {
                margin-top: 3px;
                color: #64748b;
                font-size: 11.5px;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                max-width: 180px;
            }
            .ksk-ux-icon-btn {
                width: 28px; height: 28px;
                border: 0;
                background: #f1f5f9;
                color: #475569;
                border-radius: 8px;
                cursor: pointer;
                font-size: 16px;
            }
            .ksk-ux-body { padding: 12px; }
            .ksk-ux-primary {
                width: 100%;
                min-height: 48px;
                border: 0;
                border-radius: 11px;
                background: #2563eb;
                color: #fff;
                font-size: 13.5px;
                font-weight: 700;
                cursor: pointer;
                box-shadow: 0 6px 14px rgba(37,99,235,.20);
            }
            .ksk-ux-primary:hover { filter: brightness(.97); }
            .ksk-ux-primary:disabled { opacity: .62; cursor: progress; }
            .ksk-ux-status-card {
                margin-top: 10px;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 9px 10px;
                background: #f8fafc;
            }
            #ksk-ux-status { font-size: 12.5px; font-weight: 700; }
            #ksk-ux-detail { margin-top: 3px; font-size: 11.5px; color: #64748b; line-height: 1.35; }
            .ksk-ux-busy .ksk-ux-status-card { border-color: #bfdbfe; background: #eff6ff; }
            .ksk-ux-row {
                display:flex;
                align-items:center;
                justify-content:space-between;
                gap: 8px;
                margin-top: 11px;
                font-size: 12px;
                color: #334155;
            }
            .ksk-ux-switch {
                position:relative;
                width: 38px; height: 22px;
                flex: 0 0 auto;
            }
            .ksk-ux-switch input { display:none; }
            .ksk-ux-slider {
                position:absolute; inset:0;
                border-radius:99px;
                background:#cbd5e1;
                cursor:pointer;
                transition:.18s;
            }
            .ksk-ux-slider:after {
                content:"";
                position:absolute;
                width:16px; height:16px;
                left:3px; top:3px;
                border-radius:50%;
                background:#fff;
                box-shadow:0 1px 3px rgba(0,0,0,.25);
                transition:.18s;
            }
            .ksk-ux-switch input:checked + .ksk-ux-slider { background:#2563eb; }
            .ksk-ux-switch input:checked + .ksk-ux-slider:after { transform:translateX(16px); }
            .ksk-ux-select {
                width: 86px;
                border: 1px solid #dbe3ec;
                border-radius: 8px;
                padding: 5px 7px;
                background:#fff;
                color:#334155;
                font-size:11.5px;
            }
            .ksk-ux-tools {
                margin-top: 10px;
                padding-top: 10px;
                border-top: 1px solid #eef2f7;
                display:flex;
                gap:7px;
            }
            .ksk-ux-secondary {
                flex:1;
                border:1px solid #dbe3ec;
                background:#fff;
                color:#475569;
                border-radius:8px;
                padding:7px 8px;
                font-size:11.5px;
                cursor:pointer;
            }
            .ksk-ux-foot {
                padding: 8px 12px;
                border-top: 1px solid #eef2f7;
                color:#94a3b8;
                font-size:10.5px;
                display:flex;
                justify-content:space-between;
            }
            #ksk-ux-root.ksk-ux-collapsed { width: 54px; border-radius: 14px; }
            #ksk-ux-root.ksk-ux-collapsed .ksk-ux-brand,
            #ksk-ux-root.ksk-ux-collapsed .ksk-ux-body,
            #ksk-ux-root.ksk-ux-collapsed .ksk-ux-foot { display:none; }
            #ksk-ux-root.ksk-ux-collapsed .ksk-ux-head { border:0; padding:12px; justify-content:center; }
            #ksk-ux-root.ksk-ux-collapsed .ksk-ux-icon-btn { width:30px; height:30px; }

            #ksk-ux-toast-host {
                position:fixed;
                left:50%; bottom:28px;
                transform:translateX(-50%);
                z-index:10000020;
                display:flex;
                flex-direction:column;
                align-items:center;
                gap:8px;
                pointer-events:none;
            }
            .ksk-ux-toast {
                padding:10px 14px;
                border-radius:10px;
                color:#fff;
                font:600 12.5px/1.4 "Segoe UI", Roboto, Arial, sans-serif;
                box-shadow:0 10px 28px rgba(15,23,42,.22);
                opacity:0;
                transform:translateY(8px);
                transition:.2s;
                max-width:min(520px,90vw);
                text-align:center;
            }
            .ksk-ux-toast.show { opacity:1; transform:translateY(0); }
            .ksk-ux-toast-ok { background:#15803d; }
            .ksk-ux-toast-warn { background:#b45309; }
            .ksk-ux-toast-error { background:#b91c1c; }
        `;
        document.head.appendChild(style);
    }

    function createDock() {
        ensureStyles();
        if (document.getElementById('ksk-ux-root')) return;

        const root = document.createElement('aside');
        root.id = 'ksk-ux-root';
        document.body.appendChild(root);
        render();
    }

    function render() {
        const root = document.getElementById('ksk-ux-root');
        if (!root) return;

        const model = detectModel();
        const section = detectSection();
        const legacyExists = !!legacyButtonForModel(model);

        root.classList.toggle('ksk-ux-collapsed', state.collapsed);

        root.innerHTML = `
            <div class="ksk-ux-head">
                <div class="ksk-ux-brand">
                    <strong>KSK AUTO</strong>
                    <div class="ksk-ux-context">${escapeHtml(model)} · ${escapeHtml(section)}</div>
                </div>
                <button id="ksk-ux-collapse" class="ksk-ux-icon-btn" title="Thu gọn/mở rộng">${state.collapsed ? '⚡' : '−'}</button>
            </div>
            <div class="ksk-ux-body">
                <button id="ksk-ux-run" class="ksk-ux-primary" ${state.busy || !legacyExists ? 'disabled' : ''}>
                    ${state.busy ? `⏳ Đang chạy ${escapeHtml(model)}…` : `🚀 Tự động điền · ${escapeHtml(model)}`}
                </button>

                <div class="ksk-ux-status-card">
                    <div id="ksk-ux-status">${escapeHtml(state.status)}</div>
                    <div id="ksk-ux-detail">${escapeHtml(state.detail)}</div>
                </div>

                <div class="ksk-ux-row">
                    <span>Tự động lưu sau khi điền</span>
                    <label class="ksk-ux-switch" title="Chỉ lưu khi script xác nhận có dữ liệu/hoàn tất">
                        <input id="ksk-ux-autosave" type="checkbox" ${state.autoSave ? 'checked' : ''}>
                        <span class="ksk-ux-slider"></span>
                    </label>
                </div>

                <div class="ksk-ux-row">
                    <span>Nhận diện mẫu</span>
                    <select id="ksk-ux-model" class="ksk-ux-select">
                        ${['AUTO','M2','M3','M4','M5','M6'].map(x => `<option value="${x}" ${state.forcedModel === x ? 'selected' : ''}>${x}</option>`).join('')}
                    </select>
                </div>

                <div class="ksk-ux-tools">
                    <button id="ksk-ux-debug" class="ksk-ux-secondary">🔍 DEBUG</button>
                    <button id="ksk-ux-save-now" class="ksk-ux-secondary">💾 Lưu ngay</button>
                </div>
            </div>
            <div class="ksk-ux-foot">
                <span>UX preview</span><span>v8.00</span>
            </div>
        `;

        root.querySelector('#ksk-ux-collapse')?.addEventListener('click', () => {
            state.collapsed = !state.collapsed;
            localStorage.setItem(STORAGE.collapsed, state.collapsed ? '1' : '0');
            render();
        });

        root.querySelector('#ksk-ux-run')?.addEventListener('click', runCurrentAuto);

        root.querySelector('#ksk-ux-autosave')?.addEventListener('change', e => {
            state.autoSave = !!e.target.checked;
            localStorage.setItem(STORAGE.autoSave, state.autoSave ? '1' : '0');
            showToast(state.autoSave ? 'Đã bật tự động lưu' : 'Đã tắt tự động lưu', 'ok', 1800);
        });

        root.querySelector('#ksk-ux-model')?.addEventListener('change', e => {
            state.forcedModel = e.target.value;
            localStorage.setItem(STORAGE.forcedModel, state.forcedModel);
            setStatus('Sẵn sàng', `${detectModel()} · ${detectSection()}`);
            render();
        });

        root.querySelector('#ksk-ux-debug')?.addEventListener('click', runDebug);
        root.querySelector('#ksk-ux-save-now')?.addEventListener('click', async () => {
            if (state.busy) return;
            await safeAutoSave('Lưu thủ công từ KSK AUTO');
        });

        renderStatus();
    }

    function escapeHtml(text) {
        return String(text ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function refreshContext() {
        if (state.busy) return;
        const expected = `${detectModel()} · ${detectSection()}`;
        const contextEl = document.querySelector('#ksk-ux-root .ksk-ux-context');
        if (contextEl && norm(contextEl.textContent) !== norm(expected)) {
            state.detail = expected;
            render();
        }
    }

    async function boot() {
        // @require chạy trước script này. Chờ userscript gốc tạo các nút điều khiển.
        for (let i = 0; i < 120; i++) {
            if (document.querySelector('[id^="medinet-auto-"]')) break;
            await sleep(100);
        }

        createDock();
        state.detail = `${detectModel()} · ${detectSection()}`;
        render();

        // SPA Angular có thể đổi tab mà không reload.
        setInterval(refreshContext, 1000);

        console.info(UX, 'UX Preview loaded. Auto Save:', state.autoSave);
    }

    boot().catch(err => console.error(UX, err));
})();
