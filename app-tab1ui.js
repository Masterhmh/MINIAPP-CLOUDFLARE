// ============================================================================
// app-tab1ui.js — NÚT "+" TRÊN THANH ĐIỀU HƯỚNG & LỊCH THÁNG/TUẦN (TAB 2)
// ----------------------------------------------------------------------------
// Vai trò: Nâng cấp giao diện mà KHÔNG sửa các file cũ:
//   1) Thêm nút "+" NẰM NGAY TRÊN THANH ĐIỀU HƯỚNG (bottom-nav), bên phải,
//      ngang hàng với các tab. Bấm vào bung menu: Thêm thu nhập / Thêm chi tiêu
//      / Tìm kiếm / Giới thiệu / Cài đặt.
//   2) Ẩn 2 tab "Cài đặt" và "Giới thiệu" khỏi thanh điều hướng (đã gom vào +).
//   3) Khi chọn "Thêm thu nhập" / "Thêm chi tiêu": modal chỉ hiển thị đúng 1
//      loại (ẩn ô chọn Thu nhập/Chi tiêu), tiêu đề đổi theo loại.
//   4) Lịch tháng/tuần thu gọn đặt ở TAB 2 (Báo cáo): mũi tên lên/xuống ẩn-hiện,
//      mũi tên trái/phải lùi/tiến kỳ, bấm 1 ngày sẽ mở Tab 1 xem ngày đó.
// Phụ thuộc (biến/hàm toàn cục có sẵn): fetchTransactions, fetchMonthData,
//   formatDateToYYYYMMDD, triggerHaptic, openAddForm, openSearchModal,
//   transactionDate (input ẩn).
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
      // --- LỊCH ---
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
      // --- NÚT "+" TRONG BOTTOM-NAV ---
      + '.bottom-nav .t1navadd{cursor:pointer;}'
      + '.t1navadd .t1navadd-circle{display:flex;align-items:center;justify-content:center;width:42px;height:42px;margin:0 auto;border-radius:50%;background:linear-gradient(135deg,var(--primary,#6366F1),var(--primary-light,#818cf8));color:#fff;font-size:1.2rem;box-shadow:0 4px 12px rgba(99,102,241,.45);transition:transform .3s ease;}'
      + '.t1navadd.open .t1navadd-circle{transform:rotate(135deg);}'
      // --- MENU BUNG RA TỪ NÚT "+" ---
      + '.t1menu-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.35);opacity:0;visibility:hidden;transition:opacity .25s ease;z-index:80;}'
      + '.t1menu-backdrop.open{opacity:1;visibility:visible;}'
      + '.t1menu{position:fixed;right:14px;bottom:84px;z-index:81;display:flex;flex-direction:column;align-items:flex-end;gap:12px;}'
      + '.t1menu-item{display:flex;align-items:center;gap:10px;opacity:0;transform:translateY(12px) scale(.9);pointer-events:none;transition:opacity .2s ease,transform .2s ease;}'
      + '.t1menu.open .t1menu-item{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}'
      + '.t1menu.open .t1menu-item:nth-child(1){transition-delay:.02s;}'
      + '.t1menu.open .t1menu-item:nth-child(2){transition-delay:.05s;}'
      + '.t1menu.open .t1menu-item:nth-child(3){transition-delay:.08s;}'
      + '.t1menu.open .t1menu-item:nth-child(4){transition-delay:.11s;}'
      + '.t1menu.open .t1menu-item:nth-child(5){transition-delay:.14s;}'
      + '.t1menu-label{background:var(--bg-card);color:var(--text-1);font-size:.8rem;font-weight:600;padding:6px 11px;border-radius:9px;box-shadow:0 4px 14px rgba(0,0,0,.18);white-space:nowrap;border:1px solid var(--border-color);}'
      + '.t1menu-mini{width:46px;height:46px;border-radius:50%;border:none;color:#fff;display:flex;align-items:center;justify-content:center;font-size:1rem;box-shadow:0 6px 16px rgba(0,0,0,.25);cursor:pointer;flex-shrink:0;}'
      + '.t1menu-mini.inc{background:#10B981;}'
      + '.t1menu-mini.exp{background:#F43F5E;}'
      + '.t1menu-mini.search{background:#6366F1;}'
      + '.t1menu-mini.about{background:#0EA5E9;}'
      + '.t1menu-mini.settings{background:#64748B;}';
    var s = document.createElement('style'); s.id = STYLE_ID; s.textContent = css;
    document.head.appendChild(s);
  }

  function hap(style) { try { if (typeof window.triggerHaptic === 'function') window.triggerHaptic(style || 'light'); } catch (e) {} }

  // ============================================================
  // MENU "+" (gắn vào bottom-nav)
  // ============================================================
  function closeMenu() { var m = document.querySelector('.t1menu'); var b = document.querySelector('.t1menu-backdrop'); var n = document.querySelector('.t1navadd'); if (m) m.classList.remove('open'); if (b) b.classList.remove('open'); if (n) n.classList.remove('open'); }
  function openMenu() { var m = document.querySelector('.t1menu'); var b = document.querySelector('.t1menu-backdrop'); var n = document.querySelector('.t1navadd'); if (m) m.classList.add('open'); if (b) b.classList.add('open'); if (n) n.classList.add('open'); }
  function toggleMenu() { var m = document.querySelector('.t1menu'); if (m && m.classList.contains('open')) closeMenu(); else openMenu(); }

  // Mở form Thêm với DUY NHẤT 1 loại (ẩn ô chọn Thu nhập/Chi tiêu)
  function openAdd(type) {
    closeMenu();
    if (typeof window.openAddForm !== 'function') return;
    var want = type === 'Thu nhập' ? 'Thu nhập' : 'Chi tiêu';
    Promise.resolve(window.openAddForm()).then(function () {
      var modal = document.getElementById('addModal');
      if (!modal) return;
      var pills = modal.querySelectorAll('.type-pill');
      var row = null;
      pills.forEach(function (p) {
        if (p.textContent.indexOf(want) !== -1) { p.click(); row = p.parentElement; }
      });
      if (row) row.style.display = 'none';            // ẩn ô chọn loại
      var title = modal.querySelector('.modal-title');
      if (title) title.textContent = (want === 'Thu nhập' ? 'Thêm thu nhập' : 'Thêm chi tiêu');
    });
  }

  function goTab(tab) {
    closeMenu();
    var btn = document.querySelector('.nav-btn[data-tab="' + tab + '"]');
    if (btn) btn.click();                              // nút vẫn click được dù đang ẩn
    else if (typeof window.openTab === 'function') window.openTab(tab);
  }

  function buildNav() {
    var nav = document.querySelector('.bottom-nav');
    if (!nav || nav.querySelector('.t1navadd')) return;
    // 1) Ẩn 2 tab Cài đặt (tab4) & Giới thiệu (tab5) khỏi thanh điều hướng
    ['tab4', 'tab5'].forEach(function (t) {
      var b = nav.querySelector('.nav-btn[data-tab="' + t + '"]');
      if (b) b.style.display = 'none';
    });
    // 2) Tạo nút "+" bằng cách nhân bản 1 nav-btn (giữ đúng cỡ/bố cục), bỏ data-tab
    var sample = nav.querySelector('.nav-btn');
    var addBtn;
    if (sample) { addBtn = sample.cloneNode(true); addBtn.removeAttribute('data-tab'); addBtn.classList.remove('active'); }
    else { addBtn = document.createElement('button'); addBtn.className = 'nav-btn'; }
    addBtn.classList.add('t1navadd');
    addBtn.innerHTML = '<span class="t1navadd-circle"><i class="fas fa-plus"></i></span>';
    addBtn.onclick = function (e) { if (e) e.preventDefault(); hap('light'); toggleMenu(); };
    nav.appendChild(addBtn);                           // đặt ở cuối (bên phải)
  }

  function buildMenu() {
    if (document.querySelector('.t1menu')) return;
    var backdrop = document.createElement('div'); backdrop.className = 't1menu-backdrop'; backdrop.onclick = closeMenu;
    var menu = document.createElement('div'); menu.className = 't1menu';
    var defs = [
      { cls: 'inc', icon: 'fa-hand-holding-dollar', label: 'Thêm thu nhập', act: function () { openAdd('Thu nhập'); } },
      { cls: 'exp', icon: 'fa-money-bill-transfer', label: 'Thêm chi tiêu', act: function () { openAdd('Chi tiêu'); } },
      { cls: 'search', icon: 'fa-search', label: 'Tìm kiếm', act: function () { closeMenu(); if (typeof window.openSearchModal === 'function') window.openSearchModal(); } },
      { cls: 'about', icon: 'fa-circle-info', label: 'Giới thiệu', act: function () { goTab('tab5'); } },
      { cls: 'settings', icon: 'fa-cog', label: 'Cài đặt', act: function () { goTab('tab4'); } }
    ];
    defs.forEach(function (d) {
      var it = document.createElement('div'); it.className = 't1menu-item';
      it.innerHTML = '<span class="t1menu-label">' + d.label + '</span><button class="t1menu-mini ' + d.cls + '"><i class="fas ' + d.icon + '"></i></button>';
      it.onclick = function () { hap('light'); d.act(); };
      menu.appendChild(it);
    });
    document.body.appendChild(backdrop);
    document.body.appendChild(menu);
  }

  // ============================================================
  // LỊCH THÁNG / TUẦN (đặt ở TAB 2)
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
          var b = document.querySelector('.nav-btn[data-tab="tab1"]');
          if (b) b.click();                                  // sang Tab 1 xem ngày đã chọn
          else if (typeof window.fetchTransactions === 'function') window.fetchTransactions(false);
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
    var t2 = document.getElementById('tab2'); if (!t2) return;
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
    t2.insertBefore(wrap, t2.firstChild);              // đặt ở đầu Tab 2

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
    buildCalendar();   // -> Tab 2
    buildNav();        // nút "+" trong bottom-nav + ẩn tab Cài đặt/Giới thiệu
    buildMenu();       // menu bung ra
    wrapFetch();
    document.querySelectorAll('.nav-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        closeMenu();
        if (b.dataset && b.dataset.tab === 'tab2' && calOpen) setTimeout(render, 60);
      });
    });
    setLabel();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
