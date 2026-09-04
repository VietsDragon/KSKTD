(function () {
  'use strict';

  const SIMPLE = '[KSK COMPACT UX]';
  const ROOT_ID = 'ksk-compact-root';
  const LEGACY_HIDDEN_CLASS = 'ksk-compact-legacy-hidden';
  const LOGIN_RE = /\/account\/login(?:\/|$)/i;

  const state = {
    busy: false,
    lastContext: '',
    lastMessage: ''
  };

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function norm(s) { return (s || '').replace(/\s+/g, ' ').trim().toLowerCase(); }
  function isLoginPage() { return LOGIN_RE.test(location.pathname); }

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

  function detectContext() {
    const tab = getTabTitle();
    const body = norm(document.body?.innerText || '');
    if (body.includes('kết quả xét nghiệm máu')) return 'Cận lâm sàng';
    if (tab.includes('hỏi bệnh và khám lâm sàng')) return 'Hỏi bệnh & khám';
    if (tab.includes('đánh giá sức khỏe tâm thần')) return 'Đánh giá tâm thần';
    if (tab.includes('thông tin khám')) return 'Khám lâm sàng';
    if (body.includes('chưa phát hiện bất thường')) return 'Khám lâm sàng';
    if (body.includes('tiền sử')) return 'Tiền sử';
    return 'Hồ sơ khám';
  }

  function findEngineButton() {
    const tab = getTabTitle();
    const body = norm(document.body?.innerText || '');
    const url = location.href.toLowerCase();

    if (url.includes('nguoilaixe') || url.includes('kskdk_oto') || body.includes('người lái xe')) {
      return document.getElementById('medinet-auto-m5m6');
    }
    if (
      tab.includes('tiền sử bệnh nhân dưới 18 tuổi') ||
      tab.includes('đánh giá sức khỏe tâm thần') ||
      tab.includes('thông tin khám bệnh nhân dưới 18 tuổi') ||
      body.includes('thông tin khám bệnh nhân dưới 18 tuổi')
    ) {
      return document.getElementById('medinet-auto-m2');
    }
    if (tab.includes('hỏi bệnh và khám lâm sàng') || body.includes('d8.5.1') || body.includes('hầu như không')) {
      return document.getElementById('medinet-auto-m4');
    }
    return document.getElementById('medinet-auto-m3');
  }

  function findWarningButton() {
    return document.getElementById('medinet-xem-canhbao');
  }

  function looksLegacy(el) {
    if (!el || el.closest?.(`#${ROOT_ID}`)) return false;
    const id = norm(el.id || '');
    const cls = norm(typeof el.className === 'string' ? el.className : '');
    if (id.startsWith('medinet-auto-') || id === 'medinet-xem-canhbao') return true;
    if (cls.includes('medinet-toolbar-btn')) return true;
    return false;
  }

  function hideLegacyControls() {
    document.querySelectorAll('[id^="medinet-auto-"], #medinet-xem-canhbao, .medinet-toolbar-btn')
      .forEach(el => el.classList.add(LEGACY_HIDDEN_CLASS));
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
    if (document.getElementById('ksk-compact-style')) return;
    const s = document.createElement('style');
    s.id = 'ksk-compact-style';
    s.textContent = `
      .${LEGACY_HIDDEN_CLASS}{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
      #${ROOT_ID}{position:fixed;right:18px;bottom:18px;z-index:1000005;font-family:"Segoe UI",Roboto,Arial,sans-serif;display:flex;align-items:center;gap:7px}
      #${ROOT_ID} *{box-sizing:border-box}
      .kskc-main{height:38px;padding:0 14px;border:0;border-radius:999px;background:#2563eb;color:#fff;font-size:12.5px;font-weight:700;cursor:pointer;box-shadow:0 5px 14px rgba(15,23,42,.18);display:flex;align-items:center;gap:7px;white-space:nowrap;transition:transform .12s ease,filter .12s ease,box-shadow .12s ease}
      .kskc-main:hover{filter:brightness(.98);box-shadow:0 7px 18px rgba(15,23,42,.22)}
      .kskc-main:active{transform:translateY(1px)}
      .kskc-main:disabled{opacity:.72;cursor:progress}
      .kskc-warning{width:34px;height:34px;border:1px solid #e2e8f0;border-radius:50%;background:#fff;color:#b45309;cursor:pointer;box-shadow:0 4px 12px rgba(15,23,42,.14);font-size:15px;display:flex;align-items:center;justify-content:center;padding:0}
      .kskc-warning:hover{background:#fff7ed}
      .kskc-dot{width:7px;height:7px;border-radius:50%;background:#22c55e;box-shadow:0 0 0 3px rgba(34,197,94,.14)}
      .kskc-spinner{width:12px;height:12px;border:2px solid rgba(255,255,255,.42);border-top-color:#fff;border-radius:50%;animation:kskc-spin .7s linear infinite}
      @keyframes kskc-spin{to{transform:rotate(360deg)}}
      #ksk-compact-toast{position:fixed;right:18px;bottom:66px;z-index:10000030;max-width:320px;padding:10px 13px;border-radius:10px;color:#fff;background:#15803d;box-shadow:0 8px 24px rgba(15,23,42,.20);font:600 12.5px/1.4 "Segoe UI",Roboto,Arial,sans-serif;opacity:0;transform:translateY(6px);transition:.18s;pointer-events:none}
      #ksk-compact-toast.show{opacity:1;transform:translateY(0)}
      #ksk-compact-toast.warn{background:#b45309}
      #ksk-compact-toast.error{background:#b91c1c}
      @media (max-width: 900px){#${ROOT_ID}{right:10px;bottom:10px}.kskc-main{height:36px;padding:0 12px;font-size:12px}#ksk-compact-toast{right:10px;bottom:56px;max-width:min(300px,calc(100vw - 20px))}}
    `;
    document.head.appendChild(s);
  }

  function toast(msg, type='ok', ms=3200) {
    let el = document.getElementById('ksk-compact-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ksk-compact-toast';
      document.body.appendChild(el);
    }
    el.className = type === 'warn' ? 'warn' : type === 'error' ? 'error' : '';
    el.textContent = msg;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(el._hideTimer);
    el._hideTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  function render() {
    if (isLoginPage()) {
      document.getElementById(ROOT_ID)?.remove();
      return;
    }

    ensureStyles();
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement('div');
      root.id = ROOT_ID;
      document.body.appendChild(root);
    }

    const engine = findEngineButton();
    const warning = findWarningButton();
    const context = detectContext();

    root.innerHTML = `
      <button id="kskc-run" class="kskc-main" ${state.busy || !engine ? 'disabled' : ''} title="${context}">
        ${state.busy ? '<span class="kskc-spinner"></span><span>Đang xử lý…</span>' : '<span class="kskc-dot"></span><span>Tự động điền</span>'}
      </button>
      ${warning ? '<button id="kskc-warning" class="kskc-warning" title="Xem cảnh báo gần nhất">!</button>' : ''}
    `;

    root.querySelector('#kskc-run')?.addEventListener('click', runAuto);
    root.querySelector('#kskc-warning')?.addEventListener('click', () => findWarningButton()?.click());
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
      toast(
        saves.length === 0
          ? 'Đã điền xong. Chưa tìm thấy nút Lưu trên trang này.'
          : 'Đã điền xong. Có nhiều nút Lưu nên hệ thống chưa tự bấm.',
        'warn',
        4600
      );
      return false;
    }

    toast('Đang lưu hồ sơ…', 'ok', 1800);
    saves[0].click();
    await sleep(1000);

    const body = norm(document.body?.innerText || '');
    if (body.includes('lưu thất bại') || body.includes('không thể lưu') || body.includes('lỗi máy chủ')) {
      toast('Đã điền nhưng lưu chưa thành công. Vui lòng kiểm tra lại.', 'error', 5000);
      return false;
    }

    toast('✓ Đã tự động điền và lưu hồ sơ.', 'ok', 3400);
    return true;
  }

  async function runAuto() {
    if (state.busy) return;
    const btn = findEngineButton();

    if (!btn) {
      toast('Trang này chưa hỗ trợ tự động điền.', 'warn', 3600);
      return;
    }

    state.busy = true;
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
        if (!btn.disabled) {
          finished = true;
          break;
        }
      }

      if (!finished) {
        toast('Tự động điền chưa kết thúc nên hệ thống không tự lưu.', 'warn', 5000);
        return;
      }

      if (failed) {
        toast('Có lỗi khi tự động điền. Hồ sơ chưa được tự lưu.', 'error', 5000);
        return;
      }

      await sleep(200);
      const changed = snapshotForm() > before;

      if (!successAlert && !changed) {
        toast('Không có dữ liệu mới. Hệ thống không lưu để tránh hồ sơ trống.', 'warn', 5000);
        return;
      }

      await autoSave();

    } catch (e) {
      console.error(SIMPLE, e);
      toast('Có lỗi khi chạy tự động điền. Hồ sơ chưa được tự lưu.', 'error', 5000);
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
    const ctx = detectContext();
    if (ctx !== state.lastContext && !state.busy) {
      state.lastContext = ctx;
      render();
    }
  }

  function boot() {
    ensureStyles();
    const obs = new MutationObserver(sync);
    obs.observe(document.documentElement, { childList: true, subtree: true });
    setInterval(sync, 1000);
    setTimeout(() => {
      hideLegacyControls();
      render();
    }, 350);
    console.info(SIMPLE, 'loaded');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();
