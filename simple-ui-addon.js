(function () {
  'use strict';

  const SIMPLE = '[KSK SIMPLE UX]';
  const ROOT_ID = 'ksk-simple-root';
  const LEGACY_HIDDEN_CLASS = 'ksk-simple-legacy-hidden';
  const LOGIN_RE = /\/account\/login(?:\/|$)/i;

  const state = {
    busy: false,
    status: 'Sẵn sàng',
    detail: 'Hệ thống sẽ tự nhận diện phần đang làm.',
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
    if (tab.includes('thông tin khám')) return 'Khám lâm sàng';
    if (body.includes('chưa phát hiện bất thường')) return 'Khám lâm sàng';
    if (body.includes('tiền sử')) return 'Tiền sử';
    return 'Hồ sơ khám sức khỏe';
  }

  function findLegacyAutoButton() {
    const els = [...document.querySelectorAll('button, [role="button"], .dx-button, [id^="medinet-auto-"]')]
      .filter(el => !el.closest(`#${ROOT_ID}`))
      .filter(isVisible);

    const tab = getTabTitle();
    const body = norm(document.body?.innerText || '');

    // Ưu tiên đúng nút theo ngữ cảnh nếu script gốc tạo nhiều nút.
    const wanted = [];
    if (tab.includes('hỏi bệnh và khám lâm sàng') || body.includes('d8.5.1')) wanted.push('m4');
    if (body.includes('thông tin khám bệnh nhân dưới 18 tuổi')) wanted.push('m2');
    if (body.includes('người lái xe') || location.href.toLowerCase().includes('nguoilaixe') || location.href.toLowerCase().includes('oto')) {
      wanted.push('m5/m6', 'm5', 'm6');
    }
    wanted.push('m3', 'm4', 'm2', 'm5/m6', 'm5', 'm6');

    for (const key of wanted) {
      const hit = els.find(el => {
        const t = norm(el.innerText || el.textContent || el.value || '');
        return t.includes('auto') && t.includes(key);
      });
      if (hit) return hit;
    }
    return null;
  }

  function findWarningButton() {
    return [...document.querySelectorAll('button, [role="button"], .dx-button, a')]
      .filter(el => !el.closest(`#${ROOT_ID}`))
      .find(el => norm(el.innerText || el.textContent || '') === 'xem cảnh báo') || null;
  }

  function looksLegacy(el) {
    if (!el || el.closest?.(`#${ROOT_ID}`)) return false;
    const id = norm(el.id || '');
    const cls = norm(typeof el.className === 'string' ? el.className : '');
    const text = norm(el.innerText || el.textContent || el.value || '');
    if (id.startsWith('medinet-auto-')) return true;
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

  function ensureStyles() {
    if (document.getElementById('ksk-simple-style')) return;
    const s = document.createElement('style');
    s.id = 'ksk-simple-style';
    s.textContent = `
      .${LEGACY_HIDDEN_CLASS}{visibility:hidden!important;opacity:0!important;pointer-events:none!important}
      #${ROOT_ID}{position:fixed;right:18px;bottom:18px;width:250px;z-index:1000005;font-family:"Segoe UI",Roboto,Arial,sans-serif;color:#0f172a;background:rgba(255,255,255,.98);border:1px solid #dbe4ee;border-radius:16px;box-shadow:0 14px 36px rgba(15,23,42,.16);overflow:hidden;backdrop-filter:blur(10px)}
      #${ROOT_ID} *{box-sizing:border-box}
      .ksks-head{padding:13px 14px 11px;border-bottom:1px solid #eef2f7}
      .ksks-title{font-size:13px;font-weight:800;letter-spacing:.2px}
      .ksks-context{margin-top:4px;color:#64748b;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .ksks-body{padding:12px}
      .ksks-run{width:100%;min-height:50px;border:0;border-radius:12px;background:#2563eb;color:#fff;font-size:14px;font-weight:800;cursor:pointer;box-shadow:0 7px 16px rgba(37,99,235,.20)}
      .ksks-run:hover{filter:brightness(.98)}
      .ksks-run:disabled{opacity:.62;cursor:progress}
      .ksks-status{margin-top:10px;padding:10px 11px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
      .ksks-status strong{display:block;font-size:12.5px}
      .ksks-status span{display:block;margin-top:3px;color:#64748b;font-size:11.5px;line-height:1.35}
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
    await sleep(220);
    const saves = [...new Set(getSaveButtons())];
    if (saves.length !== 1) {
      state.status = 'Đã điền xong';
      state.detail = saves.length === 0 ? 'Chưa tìm thấy nút Lưu.' : 'Có nhiều nút Lưu nên hệ thống chưa tự bấm.';
      toast('Đã điền xong nhưng chưa thể tự lưu an toàn.', 'warn', 4500);
      return false;
    }

    state.status = 'Đang lưu…';
    state.detail = 'Vui lòng chờ trong giây lát.';
    render();
    saves[0].click();

    await sleep(900);
    const body = norm(document.body?.innerText || '');
    if (body.includes('lưu thất bại') || body.includes('không thể lưu') || body.includes('lỗi máy chủ')) {
      state.status = 'Lưu chưa thành công';
      state.detail = 'Medinet báo lỗi khi lưu.';
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
      state.detail = 'Không nhận diện được chức năng tự động ở trang này.';
      render();
      return;
    }

    state.busy = true;
    state.status = 'Đang xử lý…';
    state.detail = 'Không cần thao tác thêm.';
    render();

    const originalAlert = window.alert;
    let success = false;
    let failed = false;

    window.alert = function(message) {
      const t = norm(String(message || ''));
      if (t.includes('✅') || t.includes('đã auto fill')) {
        success = true;
        return;
      }
      if (t.includes('❌') || t.includes('lỗi auto')) failed = true;
      return originalAlert.call(window, message);
    };

    try {
      btn.click();

      for (let i = 0; i < 20 && !btn.disabled; i++) await sleep(50);

      let finished = false;
      for (let i = 0; i < 720; i++) {
        await sleep(250);
        if (!btn.disabled) { finished = true; break; }
      }

      if (!finished) {
        state.status = 'Chưa hoàn tất';
        state.detail = 'Quá thời gian chờ. Hệ thống không tự lưu.';
        toast('Tự động điền chưa kết thúc nên chưa lưu.', 'warn', 5000);
        return;
      }

      if (failed) {
        state.status = 'Có lỗi khi tự động điền';
        state.detail = 'Hệ thống không tự lưu để tránh sai dữ liệu.';
        return;
      }

      if (!success) {
        // Nếu routine không dùng alert thành công, vẫn cho lưu sau khi nút đã chạy xong.
        // Điều này tương thích với các routine dùng modal/toast riêng trong script gốc.
        success = true;
      }

      if (success) await autoSave();
    } catch (e) {
      console.error(SIMPLE, e);
      state.status = 'Có lỗi';
      state.detail = 'Không tự lưu hồ sơ.';
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
