// ============================================================================
// app-tab1ui.js — THANH CÔNG CỤ NỔI (+) & LỊCH THÁNG/TUẦN CHO TAB 1
// ----------------------------------------------------------------------------
// Vai trò: Nâng cấp giao diện Tab 1 mà KHÔNG sửa các file cũ:
//   1) Nút "+" nổi (speed-dial) góc phải dưới: Thêm thu nhập / Thêm chi tiêu /
//      Tìm kiếm / Giới thiệu / Cài đặt. Ẩn hàng quick-actions cũ.
//   2) Lịch tháng/tuần thu gọn ngay dưới hero card: mũi tên lên/xuống ẩn-hiện,
//      mũi tên trái/phải lùi/tiến kỳ, chọn ngày để xem giao dịch ngày đó.
// Phụ thuộc (đều là biến/hàm toàn cục có sẵn): fetchTransactions, fetchMonthData,
//   formatDateToYYYYMMDD, formatCurrencyWithUnit, triggerHaptic, openAddForm,
//   openSearchModal, transactionDate (input ẩn).
// Thứ tự nạp: CUỐI CÙNG (sau app-init.js).
// ============================================================================
(function () {
  'use strict';

  var STYLE_ID = 't1ui-styles';

  // ---------------- TRẠNG THÁI LỊCH ----------------
  var calMode = localStorage.getItem('t1CalMode') === 'week' ? 'week' : 'month';
  var calOpen = localStorage.getItem('t1CalOpen') === '1';
  var anchor = new Date(); anchor.setHours(0, 0, 0, 0);
  var renderToken = 0;

  // ---------------- CSS ----------------
  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = ''
      + '#tab1 .quick-actions{display:none !important;}'
      + '.t1cal{margin:0 0 16px;}'
      + '.t1cal-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;background:var(--bg-card);border:1px solid var(--border-color);border-radius:14px;padding:8px 10px;}'
      + '.t1cal-title{display:flex;align-items:center;gap:8px;background:none;border:none;color:var(--text-1);font-family:inherit;font-weight:700;font-size:.95rem;cursor:pointer;padding:6px;border-radius:10px;}'
      + '.t1cal-title .cal-ic{color:var(--primary);}'
      + '.t1cal-title .chev{color:var(--text-3);transition:transform .3s ease;font-size:.78rem;}'
      + '.t1cal.open .t1cal-title .chev{transform:rotate(180deg);}'
      + '.t1cal-nav{display:flex;align-items:center;gap:6px;}'
      + '.t1cal-nav button{width:34px;height:34px;border-radius:10px;border:1px solid var(--border-color);background:transparent;color:var(--text-2);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:.85rem;}'
      + '.t1cal-nav button:active{transform:scale(.92);}'
      + '.t1cal-panel{overflow:hidden;max-height:0;opacity:0;transition:max-height .35s ease,opacity .25s ease,margin .3s ease;}'
      + '.t1cal.open .t1cal-panel{max-height:680px;opacity:1;margin-top:10px;}'
      + '.t1cal-modes{display:flex;gap:6px;margin-bottom:10px;}'
      + '.t1cal-mode{flex:1;text-align:center;padding:7px 0;border-radius:10px;font-size:.8rem;font-weight:600;color:var(--text-2);background:var(--bg-card);border:1px solid var(--border-color);cursor:pointer;}'
      + '.t1cal-mode.active{background:var(--primary);color:#fff;border-color:var(--primary);}'
      + '.t1cal-wk{display:grid;grid-template-columns:repeat(7,1fr);text-align:center;font-size:.62rem;font-weight:700;color:var(--text-3);margin-bottom:5px;}'
      + '.t1cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;}'
      + '.t1cal-day{min-height:46px;border-radius:9px;background:var(--bg-card);border:1px solid var(--border-color);padding:3px 1px;display:flex;flex-direction:column;align-items:center;gap:1px;cursor:pointer;overflow:hidden;}'
      + '.t1cal-day.empty{background:transparent;border:none;cursor:default;}'
      + '.t1cal-day .d-num{font-size:.72rem;font-weight:700;color:var(--text-1);}'
      + '.t1cal-day .d-inc{font-size:.55rem;font-weight:800;color:var(--income);line-height:1.1;}'
      + '.t1cal-day .d-exp{font-size:.55rem;font-weight:800;color:var(--expense);line-height:1.1;}'
      + '.t1cal-day.today{border-color:var(--primary);}'
      + '.t1cal-day.today .d-num{color:var(--primary);}'
      + '.t1cal-day.selected{background:var(--primary);border-color:var(--primary);}'
      + '.t1cal-day.selected .d-num,.t1cal-day.selected .d-inc,.t1cal-day.selected .d-exp{color:#fff;}'
      + '.t1cal-week .t1cal-day{min-height:62px;}'
      + '.t1fab-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);opacity:0;visibility:hidden;transition:opacity .25s ease;z-index:60;}'
      + '.t1fab-backdrop.open{opacity:1;visibility:visible;}'
      + '.t1fab{position:fixed;right:18px;bottom:90px;z-index:61;display:flex;flex-direction:column;align-items:flex-end;gap:14px;}'
      + '.t1fab-items{display:flex;flex-direction:column;align-items:flex-end;gap:12px;}'
      + '.t1fab-item{display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(12px) scale(.9);pointer-events:none;transition:opacity .2s ease,transform .2s ease;}'
      + '.t1fab.open .t1fab-item{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}'
      + '.t1fab.open .t1fab-item:nth-child(1){transition-delay:.02s;}'
      + '.t1fab.open .t1fab-item:nth-child(2){transition-delay:.05s;}'
      + '.t1fab.open .t1fab-item:nth-child(3){transition-delay:.08s;}'
      + '.t1fab.open .t1fab-item:nth-child(4){transition-delay:.11s;}'
      + '.t1fab.open .t1fab-item:nth-child(5){transition-delay:.14s;}'
      + '.t1fab-label{background:var(--bg-card);color:var(--text-1);font-size:.8rem;font-weight:600;padding:6px 11px;border-radius:9px;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap;border:1px solid var(--border-color);}'
      + '.t1fab-mini{width:46px;height:46px;border-radius:50%;border:none;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 6px 16px rgba(0,0,0,.25);cursor:pointer;flex-shrink:0;}'
      + '.t1fab-mini.inc{background:#10B981;}'
      + '.t1fab-mini.exp{background:#F43F5E;}'
      + '.t1fab-mini.search{background:#6366F1;}'
      + '.t1fab-mini.about{background:#0EA5E9;}'
      + '.t1fab-mini.settings{background:#64748B;}'
      + '.t1fab-main{width:58px;height:58px;border-radius:50%;border:none;background:linear-gradient(135deg,var(--primary,#6366F1),var(--primary-light,#818cf8));color:#fff;font-size:1.5rem;display:flex;align-items:center;justify-content:center;box-shadow:0 8px 22px rgba(99,102,241,.45);cursor:pointer;transition:transform .3s ease;}'
      + '.t1fab.open .t1fab-main{transform:rotate(135deg);}';
    var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  function hap(style) { try { if (typeof window.triggerHaptic === 'function') window.triggerHaptic(style || 'light'); } catch (e) {} }

  // ============================================================
  // NÚT "+" NỔI (SPEED-DIAL)
  // ============================================================
  function closeFab() { var f = document.querySelector('.t1fab'); var b = document.querySelector('.t1fab-backdrop'); if (f) f.classList.remove('open'); if (b) b.classList.remove('open'); }
  function openFab() { var f = document.querySelector('.t1fab'); var b = document.querySelector('.t1fab-backdrop'); if (f) f.classList.add('open'); if (b) b.classList.add('open'); }

  function fabAdd(type) {
    closeFab();
    if (typeof window.openAddForm !== 'function') return;
    Promise.resolve(window.openAddForm()).then(function () {
      var pills = document.querySelectorAll('#addModal .type-pill');
      pills.forEach(function (p) {
        if (type === 'Thu nhập' && p.textContent.indexOf('Thu nhập') !== -1) p.click();
        if (type === 'Chi tiêu' && p.textContent.indexOf('Chi tiêu') !== -1) p.click();
      });
    });
  }

  function goTab(tab) { closeFab(); var btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]'); if (btn) btn.click(); }

  function buildFab() {
    if (document.querySelector('.t1fab')) return;
    var backdrop = document.createElement('div'); backdrop.className = 't1fab-backdrop'; backdrop.onclick = closeFab;
    var fab = document.createElement('div'); fab.className = 't1fab';
    var items = document.createElement('div'); items.className = 't1fab-items';
    var defs = [
      { cls: 'inc', icon: 'fa-hand-holding-dollar', label: 'Thêm thu nhập', act: function () { fabAdd('Thu nhập'); } },
      { cls: 'exp', icon: 'fa-money-bill-transfer', label: 'Thêm chi tiêu', act: function () { fabAdd('Chi tiêu'); } },
      { cls: 'search', icon: 'fa-search', label: 'Tìm kiếm', act: function () { closeFab(); if (typeof window.openSearchModal === 'function') window.openSearchModal(); } },
      { cls: 'about', icon: 'fa-circle-info', label: 'Giới thiệu', act: function () { goTab('tab5'); } },
      { cls: 'settings', icon: 'fa-cog', label: 'Cài đặt', act: function () { goTab('tab4'); } }
    ];
    defs.forEach(function (d) {
      var it = document.createElement('div'); it.className = 't1fab-item';
      it.innerHTML = '<span class="t1fab-label">' + d.label + '</span><button class="t1fab-mini ' + d.cls + '"><i class="fas ' + d.icon + '"></i></button>';
      it.onclick = function () { hap('light'); d.act(); };
      items.appendChild(it);
    });
    var main = document.createElement('button'); main.className = 't1fab-main'; main.innerHTML = '<i class="fas fa-plus"></i>';
    main.onclick = function () { hap('light'); var f = document.querySelector('.t1fab'); if (f && f.classList.contains('open')) closeFab(); else openFab(); };
    fab.appendChild(items); fab.appendChild(main);
    document.body.appendChild(backdrop); document.body.appendChild(fab);
    updateFabVisibility();
  }

  function updateFabVisibility() {
    var fab = document.querySelector('.t1fab'); if (!fab) return;
    var t1 = document.getElementById('tab1');
    var visible = !!(t1 && t1.classList.contains('active'));
    fab.style.display = visible ? 'flex' : 'none';
    if (!visible) closeFab();
  }

  // ============================================================
  // LỊCH THÁNG / TUẦN
  // ============================================================
  function startOfWeek(date) {
    var sow = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    var d = new Date(date); d.setHours(0, 0, 0, 0);
    var day = d.getDay();
    var diff = sow === 1 ? ((day === 0 ? 7 : day) - 1) : day;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function vnWeekHeader() {
    var sow = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    return sow === 1 ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
  }

  function pad2(n) { return ('0' + n).slice(-2); }

  function compact(n) {
    n = Math.abs(Number(n) || 0);
    if (n >= 1e9) return String(Math.round(n / 1e8) / 10).replace('.', ',') + 'B';
    if (n >= 1e6) return String(Math.round(n / 1e5) / 10).replace('.', ',') + 'M';
    if (n >= 1e3) return Math.round(n / 1e3) + 'K';
    return String(n);
  }

  function setLabel() {
    var lab = document.getElementById('t1calLabel'); if (!lab) return;
    if (calMode === 'month') {
      lab.textContent = 'Tháng ' + (anchor.getMonth() + 1) + ', ' + anchor.getFullYear();
    } else {
      var s = startOfWeek(anchor); var e = new Date(s); e.setDate(e.getDate() + 6);
      lab.textContent = pad2(s.getDate()) + '/' + pad2(s.getMonth() + 1) + ' – ' + pad2(e.getDate()) + '/' + pad2(e.getMonth() + 1);
    }
  }

  function updateModeUI() {
    document.querySelectorAll('.t1cal-mode').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-mode') === calMode);
    });
  }

  // Gom thu/chi theo từng ngày trong khoảng [start,end]
  function getRangeData(start, end) {
    var months = {}; var cur = new Date(start);
    while (cur <= end) { months[cur.getMonth() + 1] = true; cur.setDate(cur.getDate() + 1); }
    var nums = Object.keys(months).map(Number);
    return Promise.all(nums.map(function (m) {
      return Promise.resolve(fetchMonthData(m)).catch(function () { return []; });
    })).then(function (results) {
      var all = []; results.forEach(function (arr) { if (Array.isArray(arr)) all = all.concat(arr); });
      var daily = {};
      all.forEach(function (t) {
        if (!t || !t.date) return; var p = String(t.date).split('/'); if (p.length !== 3) return;
        var dt = new Date(parseInt(p[2], 10), parseInt(p[1], 10) - 1, parseInt(p[0], 10)); dt.setHours(0, 0, 0, 0);
        if (dt < start || dt > end) return;
        var key = formatDateToYYYYMMDD(dt);
        if (!daily[key]) daily[key] = { inc: 0, exp: 0 };
        if (t.type === 'Thu nhập') daily[key].inc += Number(t.amount) || 0; else daily[key].exp += Number(t.amount) || 0;
      });
      return daily;
    });
  }

  function cellHTML(d, data) {
    var html = '<span class="d-num">' + d.getDate() + '</span>';
    if (data && (data.inc > 0 || data.exp > 0)) {
      if (data.inc > 0) html += '<span class="d-inc">+' + compact(data.inc) + '</span>';
      if (data.exp > 0) html += '<span class="d-exp">−' + compact(data.exp) + '</span>';
    }
    return html;
  }

  function markSelected() {
    var inp = document.getElementById('transactionDate');
    var selKey = inp ? inp.value : '';
    document.querySelectorAll('.t1cal-day').forEach(function (c) {
      if (c.getAttribute('data-key') === selKey) c.classList.add('selected');
      else c.classList.remove('selected');
    });
  }

  function render() {
    var grid = document.getElementById('t1calGrid'); var wk = document.getElementById('t1calWk'); var panel = document.getElementById('t1calPanel');
    if (!grid || !wk || !panel) return;
    var modeWeek = calMode === 'week';
    panel.classList.toggle('t1cal-week', modeWeek);
    wk.innerHTML = vnWeekHeader().map(function (x) { return '<span>' + x + '</span>'; }).join('');
    setLabel();
    var token = ++renderToken;

    var start, end, leading = 0, days = [], i, j;
    if (modeWeek) {
      start = startOfWeek(anchor); end = new Date(start); end.setDate(end.getDate() + 6);
      for (i = 0; i < 7; i++) { var dd = new Date(start); dd.setDate(start.getDate() + i); days.push(dd); }
    } else {
      var y = anchor.getFullYear(), m = anchor.getMonth();
      start = new Date(y, m, 1); end = new Date(y, m + 1, 0);
      var sow = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
      var fd = start.getDay(); leading = sow === 1 ? (fd === 0 ? 6 : fd - 1) : fd;
      var dim = end.getDate();
      for (j = 1; j <= dim; j++) days.push(new Date(y, m, j));
    }

    var todayKey = formatDateToYYYYMMDD(new Date());
    var inp = document.getElementById('transactionDate');
    var selKey = inp ? inp.value : '';

    function paint(daily) {
      grid.innerHTML = '';
      var k;
      for (k = 0; k < leading; k++) { var emp = document.createElement('div'); emp.className = 't1cal-day empty'; grid.appendChild(emp); }
      days.forEach(function (d) {
        var key = formatDateToYYYYMMDD(d);
        var data = daily ? daily[key] : null;
        var cell = document.createElement('div'); cell.className = 't1cal-day'; cell.setAttribute('data-key', key);
        if (key === todayKey) cell.classList.add('today');
        if (key === selKey) cell.classList.add('selected');
        cell.innerHTML = cellHTML(d, data);
        cell.onclick = function () {
          hap('light');
          var inp2 = document.getElementById('transactionDate');
          if (inp2) inp2.value = key;
          if (typeof window.fetchTransactions === 'function') window.fetchTransactions(false);
          markSelected();
        };
        grid.appendChild(cell);
      });
    }

    paint(null);
    getRangeData(start, end).then(function (daily) {
      if (token !== renderToken) return;
      paint(daily);
    }).catch(function () {});
  }

  function toggleCal() {
    var w = document.querySelector('.t1cal'); if (!w) return;
    calOpen = !calOpen; localStorage.setItem('t1CalOpen', calOpen ? '1' : '0');
    w.classList.toggle('open', calOpen);
    if (calOpen) render();
  }

  function setMode(mode) {
    if (mode === calMode) return;
    calMode = mode; localStorage.setItem('t1CalMode', mode);
    if (mode === 'week') anchor = startOfWeek(new Date(anchor));
    else anchor = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
    updateModeUI();
    if (calOpen) render(); else setLabel();
  }

  function shift(dir) {
    if (calMode === 'month') anchor = new Date(anchor.getFullYear(), anchor.getMonth() + dir, 1);
    else { anchor = new Date(anchor); anchor.setDate(anchor.getDate() + dir * 7); }
    if (calOpen) render(); else setLabel();
  }

  function buildCalendar() {
    if (document.querySelector('.t1cal')) return;
    var hero = document.querySelector('#tab1 .hero-card'); if (!hero || !hero.parentNode) return;
    var wrap = document.createElement('div'); wrap.className = 't1cal' + (calOpen ? ' open' : '');
    wrap.innerHTML = ''
      + '<div class="t1cal-bar">'
      + '<button class="t1cal-title" id="t1calTitle"><i class="fas fa-calendar-days cal-ic"></i><span id="t1calLabel">—</span><i class="fas fa-chevron-down chev"></i></button>'
      + '<div class="t1cal-nav"><button id="t1calPrev"><i class="fas fa-chevron-left"></i></button><button id="t1calNext"><i class="fas fa-chevron-right"></i></button></div>'
      + '</div>'
      + '<div class="t1cal-panel" id="t1calPanel">'
      + '<div class="t1cal-modes"><div class="t1cal-mode" data-mode="month">Tháng</div><div class="t1cal-mode" data-mode="week">Tuần</div></div>'
      + '<div class="t1cal-wk" id="t1calWk"></div>'
      + '<div class="t1cal-grid" id="t1calGrid"></div>'
      + '</div>';
    hero.parentNode.insertBefore(wrap, hero.nextSibling);

    document.getElementById('t1calTitle').onclick = function () { hap('light'); toggleCal(); };
    document.getElementById('t1calPrev').onclick = function () { hap('light'); shift(-1); };
    document.getElementById('t1calNext').onclick = function () { hap('light'); shift(1); };
    wrap.querySelectorAll('.t1cal-mode').forEach(function (el) { el.onclick = function () { hap('light'); setMode(el.getAttribute('data-mode')); }; });

    updateModeUI();
    if (calOpen) render(); else setLabel();
  }

  // Bọc fetchTransactions để đồng bộ ô ngày đang chọn trên lịch (không gọi mạng).
  function wrapFetch() {
    if (window.__t1CalFetchWrapped) return;
    if (typeof window.fetchTransactions !== 'function') return;
    window.__t1CalFetchWrapped = true;
    var orig = window.fetchTransactions;
    window.fetchTransactions = function () {
      var r = orig.apply(this, arguments);
      try { markSelected(); } catch (e) {}
      return r;
    };
  }

  // ---------------- KHỞI ĐỘNG ----------------
  function init() {
    injectStyles();
    buildCalendar();
    buildFab();
    wrapFetch();
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () { setTimeout(updateFabVisibility, 0); });
    });
    updateFabVisibility();
    setLabel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
