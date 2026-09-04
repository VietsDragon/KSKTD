(function () {
  'use strict';

  const SIMPLE = '[KSK SIMPLE UX]';
  const ROOT_ID = 'ksk-simple-root';
  const LEGACY_HIDDEN_CLASS = 'ksk-simple-legacy-hidden';
  const LOGIN_RE = /\/account\/login(?:\/|$)/i;

  const state = {
    busy: false,
    status: 'Sẵn sàng',
    detail: 'Bấm “Tự động điền” để bắt đầu.',
    lastContext: ''
  };

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isLoginPage() { return LOGIN_RE.test(location.pathname); }
  function escapeHtml(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function isVisible(el) {
    if (!el || !el.isConnected) return false;
    const st = getComputedStyle(el);
    if (st.display === 'none' || st.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  function getTabTitle() {
    const el = document.querySelector('h2.hidden-web-title, .hidden-web-title');
    return el ? norm(el.innerText) : '';
  }

  function detectSection() {
    const tab = getTabTitle();
    const body = norm(document.body?.innerText || '');
    if (body.includes('kết quả xét nghiệm máu')) return 'Cận lâm sàng';
    if (tab.includes('hỏi bệnh và khám lâm sàng')) return 'Hỏi bệnh và khám lâm sàng';
    if (tab.includes('đánh giá sức khỏe tâm thần')) return 'Đánh giá sức khỏe tâm thần';
    if (tab.includes('thông tin khám')) return 'Khám lâm sàng';
    if (body.includes('chưa phát hiện bất thường')) return 'Khám lâm sàng';
    if (body.includes('tiền sử')) return 'Tiền sử';
    return 'Hồ sơ khám sức khỏe';
  }

  // Engine buttons may be intentionally hidden by this UI, so DO NOT require visibility.
  function findLegacyAutoButton() {
    const els = [...document.querySelectorAll('[id^="medinet-auto-"], .medinet-toolbar-btn')]
      .filter(el => !el.closest(`#${ROOT_ID}`));

    const tab = getTabTitle();
    const body = norm(document.body?.innerText || '');
    const url = location.href.toLowerCase();

    const byId = id => document.getElementById(id);

    if (url.includes('nguoilaixe') || url.includes('kskdk_oto') || body.includes('người lái xe')) {
      return byId('medinet-auto-m5m6') || els.find(el => norm(el.textContent).includes('m5/m6')) || null;
    }

    if (
      tab.includes('tiền sử bệnh nhân dưới 18 tuổi') ||
      tab.includes('đánh giá sức khỏe tâm thần') ||
      tab.includes('thông tin khám bệnh nhân dưới 18 tuổi') ||
      body.includes('thông tin khám bệnh nhân dưới 18 tuổi')
    ) {
      return byId('medinet-auto-m2') || null;
    }

    if (tab.includes('hỏi bệnh và khám lâm sàng') || body.includes('d8.5.1') || body.includes('hầu như không')) {
      return byId('medinet-auto-m4') || null;
    }

    return byId('medinet-auto-m3') || null;
  }

  function findWarningButton() {
    return document.getElementById('medinet-xem-canhbao') ||
      [...document.querySelectorAll('button, [role="button"], .dx-button, a')]
        .filter(el => !el.closest(`#${ROOT_ID}`))
        .find(el => norm(el.innerText || el.textContent || '') === 'xem cảnh báo') || null;
  }

  function looksLegacy(el) {
    if (!el || el.closest?.(`#${ROOT_ID}`)) return false;
    const id = norm(el.id || '');
    const cls = norm(typeof el.className === 'string' ? el.className : '');
    const text = norm(el.innerText || el.textContent || el.value || '');
    if (id.startsWith('medinet-auto-') || id === 'medinet-xem-canhbao') return true;
    if (cls.includes('medinet-toolbar-btn')) return true;
    return (
      (text.includes('auto m2') || text.includes('auto m3') || text.includes('auto m4') ||
       text.includes('auto m5') || text.includes('auto m6') || text.includes('auto m5/m6') ||
       text === 'xem cảnh báo' || text.includes('debug d-code')) &&
      ['BUTTON','A','INPUT'].includes(el.tagName)
    );
  }

  function hideLegacyControls() {
    document.querySelectorAll('button, [role="button"], .dx-button, a, input[type="button"], input[type="submit"], [id^="medinet-auto-"]')
      .forEach(el => {
        if (looksLegacy(el)) el.classList.add(LEGACY_HIDDEN_CLASS);
      });
  }

  function snapshotForm() {
    let score = 0;
    document.querySelectorAll('input, textarea, select').forEach(el => {
      if (el.closest(`#${ROOT_ID}`) || el.disabled) return;
      if (String(el.value || '').trim()) score++;
    });
    score += document.querySelectorAll(
      '.dx-checkbox-checked, [role="radio"][aria-checked="true"], .dx-list-item-selected, input[type="checkbox"]:checked, input[type="radio"]:checked'
    ).length;
    return score;
  }

  function ensureStyles() {
    if (document.getElementById('ksk-simple-style')) return;
    const s = document.createElement('style');
    s.id = 'ksk-simple-style';
    s.textContent = `
      .${LEGACY_HIDDEN_CLASS}{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
      #${ROOT_ID}{position:fixed;right:18px;bottom:18px;width:244px;z-index:1000005;font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;background:rgba(255,255,255,.98);border:1px solid #dbe4ee;border-radius:16px;box-shadow:0 14px 36px rgba(15,23,42,.16);overflow:hidden;backdrop-filter:blur(10px)}
      #${ROOT_ID} *{box-sizing:border-box}
      .ksks-head{padding:13px 14px 10px;border-bottom:1px solid #eef2f7}
      .ksks-title{font-size:13px;font-weight:800;letter-spacing:.2px}
      .ksks-context{margin-top:4px;color:#64748b;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ksks-body{padding:12px}
      .ksks-run{width:100%;min-height:48px;border:0;border-radius:11px;background:#2563eb;color:#fff;font-size:13.5px;font-weight:800;cursor:pointer;box-shadow:0 7px 16px rgba(37,99,235,.20)}
      .ksks-run:hover{filter:brightness(.98)}
      .ksks-run:disabled{opacity:.62;cursor:progress}
      .ksks-status{margin-top:9px;padding:9px 10px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
      .ksks-status strong{display:block;font-size:12.3px}
      .ksks-status span{display:block;margin-top:3px;color:#64748b;font-size:11.3px;line-height:1.35}
      .ksks-warning{margin-top:8px;width:100%;border:1px solid #dbe4ee;background:#fff;color:#475569;border-radius:9px;padding:8px 10px;font-size:12px;font-weight:600;cursor:pointer}
      #ksk-simple-toast{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:10000030;padding:10px 15px;border-radius:10px;color:#fff;background:#15803d;box-shadow:0 10px 28px rgba(15,23,42,.22);font:600 12.5px/1.4 "Segoe UI",Roboto,Arial,sans-serif;opacity:0;transition:.2s;pointer-events:none}
      #ksk-simple-toast.show{opacity:1;transform:translateX(-50%) translateY(-4px)}
      #ksk-simple-toast.warn{background:#b45309}
      #ksk-simple-toast.error{background:#b91c1c}
    `;
    document.head.appendChild(s);
  }

  function toast(msg, type='ok', ms=3000) {
    let el = document.getElementById('ksk-simple-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ksk-simple-toast';
      document.body.appendChild(el);
    }
    el.className = type === 'warn' ? 'warn' : type === 'error' ? 'error' : '';
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    setTimeout(() => el.classList.remove('show'), ms);
  }

  function render() {
    if (isLoginPage()) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('aside');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }

    const section = detectSection();
    const autoBtn = findLegacyAutoButton();
    const warningBtn = findWarningButton();

    root.innerHTML = `
      <div class="ksks-head">
        <div class="ksks-title">KSK AUTO</div>
        <div class="ksks-context">${escapeHtml(section)}</div>
      </div>
      <div class="ksks-body">
        <button id="ksks-run" class="ksks-run" ${state.busy || !autoBtn ? 'disabled' : ''}>${state.busy ? '⏳ ĐANG XỬ LÝ…' : '⚡ TỰ ĐỘNG ĐIỀN'}</button>
        <div class="ksks-status"><strong>${escapeHtml(state.status)}</strong><span>${escapeHtml(state.detail)}</span></div>
        ${warningBtn ? '<button id="ksks-warning" class="ksks-warning">Xem cảnh báo</button>' : ''}
      </div>`;

    root.querySelector('#ksks-run')?.addEventListener('click', runAuto);
    root.querySelector('#ksks-warning')?.addEventListener('click', () => {
      const btn = findWarningButton();
      if (btn) btn.click();
    });
  }

  function getSaveButtons() {
    return [...document.querySelectorAll('button, [role="button"], .dx-button, input[type="button"], input[type="submit"]')]
      .filter(el => !el.closest(`#${ROOT_ID}`))
      .filter(isVisible)
      .filter(el => !el.disabled)
      .filter(el => norm(el.innerText || el.textContent || el.value || '') === 'lưu');
  }

  async function autoSave() {
    await sleep(250);
    const saves = [...new Set(getSaveButtons())];
    if (saves.length !== 1) {
      state.status = 'Đã điền xong';
      state.detail = saves.length === 0 ? 'Vui lòng bấm Lưu trên hồ sơ.' : 'Chưa tự lưu để tránh bấm nhầm.';
      toast('Đã điền xong nhưng chưa thể tự lưu an toàn.', 'warn', 4500);
      return false;
    }

    state.status = 'Đang lưu…';
    state.detail = 'Vui lòng chờ trong giây lát.';
    render();
    saves[0].click();

    await sleep(1000);
    const body = norm(document.body?.innerText || '');
    if (body.includes('lưu thất bại') || body.includes('không thể lưu') || body.includes('lỗi máy chủ')) {
      state.status = 'Lưu chưa thành công';
      state.detail = 'Vui lòng kiểm tra lại.';
      toast('Đã điền nhưng lưu chưa thành công.', 'error', 5000);
      return false;
    }

    state.status = 'Đã hoàn tất';
    state.detail = 'Đã tự động điền và gửi lệnh Lưu.';
    toast('✓ Đã tự động điền và lưu hồ sơ.');
    return true;
  }

  async function runAuto() {
    if (state.busy) return;
    const btn = findLegacyAutoButton();
    if (!btn) {
      state.status = 'Chưa sẵn sàng';
      state.detail = 'Trang này chưa hỗ trợ tự động điền.';
      render();
      return;
    }

    state.busy = true;
    state.status = 'Đang xử lý…';
    state.detail = 'Vui lòng chờ.';
    render();

    const before = snapshotForm();
    const originalAlert = window.alert;
    let successAlert = false;
    let failed = false;

    window.alert = function(message) {
      const raw = String(message || '');
      const t = norm(raw);
      if (raw.includes('✅') || t.includes('đã auto fill')) {
        successAlert = true;
        return;
      }
      if (raw.includes('❌') || t.includes('lỗi auto')) failed = true;
      return originalAlert.call(window, message);
    };

    try {
      btn.click();

      for (let i = 0; i < 30 && !btn.disabled; i++) await sleep(50);

      let finished = false;
      for (let i = 0; i < 1200; i++) {
        await sleep(250);
        if (!btn.disabled) { finished = true; break; }
      }

      if (!finished) {
        state.status = 'Chưa hoàn tất';
        state.detail = 'Hệ thống không tự lưu để đảm bảo an toàn.';
        toast('Tự động điền chưa kết thúc nên chưa lưu.', 'warn', 5000);
        return;
      }

      if (failed) {
        state.status = 'Có lỗi khi tự động điền';
        state.detail = 'Hệ thống không tự lưu.';
        return;
      }

      await sleep(200);
      const changed = snapshotForm() > before;

      // Critical guard: if user cancelled a modal or nothing was actually filled,
      // do NOT save. This prevents blank/incomplete records from being persisted.
      if (!successAlert && !changed) {
        state.status = 'Chưa có dữ liệu mới';
        state.detail = 'Hệ thống không tự lưu để tránh hồ sơ trống.';
        return;
      }

      await autoSave();
    } catch (e) {
      console.error(SIMPLE, e);
      state.status = 'Có lỗi';
      state.detail = 'Hệ thống không tự lưu hồ sơ.';
      toast('Có lỗi khi chạy tự động điền.', 'error', 5000);
    } finally {
      window.alert = originalAlert;
      state.busy = false;
      render();
    }
  }

  function sync() {
    if (isLoginPage()) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }
    hideLegacyControls();
    const ctx = detectSection();
    if (!state.busy && ctx !== state.lastContext) {
      state.lastContext = ctx;
      state.status = 'Sẵn sàng';
      state.detail = 'Bấm “Tự động điền” để bắt đầu.';
      render();
    }
  }

  function boot() {
    ensureStyles();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(sync, 1000);
    setTimeout(() => { sync(); render(); }, 350);
    console.info(SIMPLE, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();