// ============================================================================
// app-upgrade.js — NÂNG CẤP GIAO DIỆN (nạp CUỐI CÙNG, sau app-init.js)
// ----------------------------------------------------------------------------
// 1) Tab 1: bấm dòng ngày -> bảng chọn ngày GỐC của OS.
// 2) Nút ＋ (FAB): Thêm thu nhập / chi tiêu / Cài đặt / Giới thiệu.
// 3) Cài đặt / Giới thiệu dạng trang toàn màn hình (Quay Lại bên phải + vuốt).
// 4) Tab 2: ẩn/hiện lịch + mũi tên tiến/lùi (chặn kỳ không có dữ liệu).
// 5) Ngày dd/MM/yyyy ở form Thêm/Sửa.
// 6) Nút đóng ✕ cho modal.
// 7) Tab Tìm kiếm (thêm nút Tìm kiếm vào thanh điều hướng, mở modal tìm kiếm).
// 8) Đếm tổng giao dịch + sắp xếp kết quả tìm kiếm theo ngày mới nhất.
// 9) Indicator trượt giữa các tab trên thanh điều hướng.
// 10) Chế độ Năm: so sánh năm nay với năm trước + biểu đồ xu hướng nhiều năm.
// ============================================================================

(function () {
  'use strict';

  window.__yearlyView = window.__yearlyView || 'compare';

  function fmtDMY(yyyymmdd) {
    if (!yyyymmdd) return '';
    var p = String(yyyymmdd).split('-');
    if (p.length !== 3) return '';
    return p[2] + '/' + p[1] + '/' + p[0];
  }
  function syncDateDisplay(inputId, displayId) {
    var i = document.getElementById(inputId), d = document.getElementById(displayId);
    if (i && d) d.textContent = fmtDMY(i.value);
  }
  window.__syncDateDisplay = syncDateDisplay;
  function setupDateDisplay(inputId, displayId) {
    var input = document.getElementById(inputId);
    if (!input || document.getElementById(displayId)) return;
    input.classList.add('date-native');
    var wrap = document.createElement('div');
    wrap.className = 'date-field-wrap';
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    var span = document.createElement('span');
    span.className = 'date-display';
    span.id = displayId;
    wrap.appendChild(span);
    input.addEventListener('change', function () { syncDateDisplay(inputId, displayId); });
    input.addEventListener('input', function () { syncDateDisplay(inputId, displayId); });
    syncDateDisplay(inputId, displayId);
  }

  function setupHeroDateNative() {
    var heroDate = document.getElementById('displayCurrentDate');
    var tInput = document.getElementById('transactionDate');
    if (!heroDate || !tInput) return;
    var parent = heroDate.parentNode;
    if (parent && parent.classList && parent.classList.contains('hero-date-tap')) return;
    var caret = heroDate.nextElementSibling;
    var wrap = document.createElement('span');
    wrap.className = 'hero-date-tap';
    parent.insertBefore(wrap, heroDate);
    wrap.appendChild(heroDate);
    if (caret && caret.classList && caret.classList.contains('fa-caret-down')) wrap.appendChild(caret);
    tInput.style.display = 'block';
    tInput.classList.add('hero-date-native');
    wrap.appendChild(tInput);
    tInput.addEventListener('click', function (e) { e.stopPropagation(); });
    tInput.addEventListener('change', function () { if (typeof window.fetchTransactions === 'function') window.fetchTransactions(false); });
  }

  function addModalCloseX(modalId, closeFnName) {
    var modal = document.getElementById(modalId);
    if (!modal || modal.querySelector('.modal-close-x')) return;
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'modal-close-x';
    btn.setAttribute('aria-label', 'Đóng');
    btn.innerHTML = '<i class="fas fa-times"></i>';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      triggerHaptic('light');
      if (typeof window[closeFnName] === 'function') window[closeFnName]();
    });
    modal.appendChild(btn);
  }

  function enableSwipeBack(pageId) {
    var el = document.getElementById(pageId);
    if (!el) return;
    var sx = 0, sy = 0, tracking = false;
    el.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) { tracking = false; return; }
      tracking = true;
      sx = e.touches[0].clientX;
      sy = e.touches[0].clientY;
      e.stopPropagation();
    }, { passive: true });
    el.addEventListener('touchend', function (e) {
      e.stopPropagation();
      if (!tracking) return;
      tracking = false;
      var dx = e.changedTouches[0].clientX - sx;
      var dy = e.changedTouches[0].clientY - sy;
      if (dx > 80 && Math.abs(dx) > Math.abs(dy) * 1.5) {
        window.closeFullscreen(pageId);
      }
    }, { passive: true });
  }

  function setupSearchTab() {
    var fabMenu = document.getElementById('fabMenu');
    if (fabMenu) {
      fabMenu.querySelectorAll('.fab-item').forEach(function (it) {
        var lbl = it.querySelector('.fab-item-label');
        if (lbl && lbl.textContent.trim() === 'Tìm kiếm') it.remove();
      });
    }
    var group = document.querySelector('.nav-tabs-group');
    if (group && !document.getElementById('navSearchBtn')) {
      var btn = document.createElement('button');
      btn.id = 'navSearchBtn';
      btn.className = 'nav-btn';
      btn.type = 'button';
      btn.innerHTML = '<div class="nav-icon-wrap"><i class="fas fa-search"></i></div><span class="nav-label">Tìm kiếm</span>';
      btn.onclick = function () { triggerHaptic('light'); if (typeof window.openSearchModal === 'function') window.openSearchModal(); };
      group.appendChild(btn);
    }
  }

  // ---- Indicator trượt giữa các tab ----
  function positionNavIndicator() {
    var group = document.querySelector('.nav-tabs-group');
    var ind = document.getElementById('navIndicator');
    if (!group || !ind) return;
    var active = group.querySelector('.nav-btn.active');
    if (!active) { ind.style.opacity = '0'; return; }
    ind.style.opacity = '1';
    ind.style.width = active.offsetWidth + 'px';
    ind.style.height = active.offsetHeight + 'px';
    ind.style.top = active.offsetTop + 'px';
    ind.style.transform = 'translateX(' + active.offsetLeft + 'px)';
  }
  window.__positionNavIndicator = positionNavIndicator;
  function setupNavIndicator() {
    var group = document.querySelector('.nav-tabs-group');
    if (!group || document.getElementById('navIndicator')) return;
    var ind = document.createElement('div');
    ind.id = 'navIndicator';
    ind.className = 'nav-indicator';
    group.insertBefore(ind, group.firstChild);
    positionNavIndicator();
    // Dinh vi lai sau khi bo cuc on dinh (font/icon tai xong; tren desktop khung
    // mini app tu dan ve kich thuoc cuoi cung). Dung nhieu moc de chac chan.
    requestAnimationFrame(function () { requestAnimationFrame(positionNavIndicator); });
    setTimeout(positionNavIndicator, 60);
    setTimeout(positionNavIndicator, 250);
    setTimeout(positionNavIndicator, 600);
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { try { positionNavIndicator(); } catch (e) {} });
    }
    // Theo doi moi thay doi kich thuoc cua thanh nav (vd: khung mini app tren
    // desktop tu dan kich thuoc khi moi mo) -> tu dinh vi lai pill, khong con
    // "meo" ti le va khong can nguoi dung keo dan cua so nua.
    if (typeof ResizeObserver !== 'undefined') {
      try {
        var __navRO = new ResizeObserver(function () { try { positionNavIndicator(); } catch (e) {} });
        __navRO.observe(group);
        var __activeInit = group.querySelector('.nav-btn.active');
        if (__activeInit) __navRO.observe(__activeInit);
      } catch (e) {}
    }
  }

  function setupSearchCount() {
    var container = document.getElementById('searchResultsContainer');
    if (!container || document.getElementById('searchCountLabel')) return;
    var lbl = document.createElement('div');
    lbl.id = 'searchCountLabel';
    lbl.className = 'chart-title text-left';
    lbl.style.display = 'none';
    lbl.style.marginTop = '4px';
    lbl.style.marginBottom = '10px';
    container.parentNode.insertBefore(lbl, container);
  }

  function searchDateKey(t) {
    if (!t || !t.date) return 0;
    var p = String(t.date).split('/');
    if (p.length !== 3) return 0;
    return parseInt(p[2], 10) * 10000 + parseInt(p[1], 10) * 100 + parseInt(p[0], 10);
  }

  // ------------------------------------------------------------------
  // WRAP openTab — cập nhật vị trí indicator khi đổi tab
  // ------------------------------------------------------------------
  var _origOpenTab = window.openTab;
  if (typeof _origOpenTab === 'function') {
    window.openTab = function () {
      var r = _origOpenTab.apply(this, arguments);
      try { positionNavIndicator(); } catch (e) {}
      return r;
    };
  }

  // ------------------------------------------------------------------
  // WRAP fetchTransactions — lam moi moc du lieu dieu huong khi tai lai
  // ------------------------------------------------------------------
  var _origFetchTransactions = window.fetchTransactions;
  if (typeof _origFetchTransactions === 'function') {
    window.fetchTransactions = function (force) {
      if (force === true) { window.__navBoundsPromise = null; window.monthDataCache = {}; }
      return _origFetchTransactions.apply(this, arguments);
    };
  }

  // ------------------------------------------------------------------
  // WRAP openAddForm — khóa loại giao dịch (Thu nhập / Chi tiêu)
  // ------------------------------------------------------------------
  var _origOpenAddForm = window.openAddForm;
  window.openAddForm = async function (lockType) {
    var addModal = document.getElementById('addModal');
    var typeRow = addModal ? addModal.querySelector('.type-row') : null;
    var typeGroup = typeRow ? typeRow.closest('.field-group') : null;
    var titleEl = addModal ? addModal.querySelector('.modal-title') : null;
    var locked = (lockType === 'Thu nhập' || lockType === 'Chi tiêu');

    if (typeGroup) typeGroup.style.display = locked ? 'none' : '';
    if (titleEl) titleEl.textContent = locked ? (lockType === 'Thu nhập' ? 'Thêm thu nhập' : 'Thêm chi tiêu') : 'Thêm giao dịch mới';

    if (typeof _origOpenAddForm === 'function') { await _origOpenAddForm(); }

    if (locked && addModal) {
      var addTypeInput = document.getElementById('addType');
      if (addTypeInput) addTypeInput.value = lockType;
      addModal.querySelectorAll('.type-pill').forEach(function (p) {
        if (p.textContent.indexOf(lockType) !== -1) p.click();
      });
      if (typeGroup) typeGroup.style.display = 'none';
      if (titleEl) titleEl.textContent = (lockType === 'Thu nhập' ? 'Thêm thu nhập' : 'Thêm chi tiêu');
    } else if (!locked) {
      if (typeGroup) typeGroup.style.display = '';
      if (titleEl) titleEl.textContent = 'Thêm giao dịch mới';
    }

    syncDateDisplay('addDate', 'addDateDisplay');
  };

  var _origOpenEditForm = window.openEditForm;
  window.openEditForm = async function (tx) {
    if (typeof _origOpenEditForm === 'function') { await _origOpenEditForm(tx); }
    syncDateDisplay('editDate', 'editDateDisplay');
  };

  // WRAP displayDetailTransactionsList — hiện tổng số giao dịch trên tiêu đề
  var _origDisplayDetailList = window.displayDetailTransactionsList;
  if (typeof _origDisplayDetailList === 'function') {
    window.displayDetailTransactionsList = function (txs) {
      var r = _origDisplayDetailList.apply(this, arguments);
      var title = document.getElementById('detailListTitle');
      if (title) {
        var n = (txs && txs.length) ? txs.length : 0;
        title.innerHTML = 'Giao dịch chi tiết <span style="font-size:0.72rem; color:var(--text-2); text-transform:none; font-weight:600;">(Tổng: ' + n + ')</span>';
      }
      return r;
    };
  }

  // WRAP displaySearchResults — sắp xếp theo ngày mới nhất + đếm tổng
  var _origDisplaySearch = window.displaySearchResults;
  if (typeof _origDisplaySearch === 'function') {
    window.displaySearchResults = function () {
      try {
        if (typeof cachedSearchResults !== 'undefined' && Array.isArray(cachedSearchResults)) {
          cachedSearchResults.sort(function (a, b) { return searchDateKey(b) - searchDateKey(a); });
        }
      } catch (e) {}
      var r = _origDisplaySearch.apply(this, arguments);
      var lbl = document.getElementById('searchCountLabel');
      if (lbl) {
        var n = 0;
        try { if (typeof cachedSearchResults !== 'undefined' && cachedSearchResults) n = cachedSearchResults.length; } catch (e) {}
        if (n > 0) {
          lbl.style.display = 'block';
          lbl.innerHTML = 'Kết quả <span style="font-size:0.72rem; color:var(--text-2); text-transform:none; font-weight:600;">(Tổng: ' + n + ')</span>';
        } else {
          lbl.style.display = 'none';
        }
      }
      return r;
    };
  }

  // ------------------------------------------------------------------
  // WRAP updateTimeNavUI — đồng bộ thanh điều khiển lịch (Tab 2)
  // CHE DO NAM: tu xu ly de dieu huong theo activePeriodDate (nam dang chon),
  // dat nhan "Nam xxxx" va tai bao cao 12 thang cua nam do. KHONG goi ban goc
  // vi ban goc luon tai nam hien tai (hardcode) va khong dat nhan nam.
  // Sau khi tai xong: neu che do xem la 'trend' -> ve bieu do xu huong nhieu nam;
  // nguoc lai -> chong them duong chi tieu nam truoc de so sanh.
  // ------------------------------------------------------------------
  var _origUpdateTimeNavUI = window.updateTimeNavUI;
  window.updateTimeNavUI = function () {
    if (typeof currentFilterMode !== 'undefined' && currentFilterMode === 'yearly') {
      var timeNav = document.getElementById('timeNavContainer');
      var customNav = document.getElementById('customFilterContainer');
      if (timeNav) timeNav.style.display = 'none';
      if (customNav) customNav.style.display = 'none';
      var lbl = document.getElementById('currentPeriodLabel');
      var yy = activePeriodDate.getFullYear();
      if (lbl) lbl.textContent = 'Năm ' + yy;
      (async function () {
        try { if (typeof loadCustomReport === 'function') await loadCustomReport(1, 12, yy); } catch (e) {}
        if (window.__yearlyView === 'trend') {
          try { await drawMultiYearTrend(yy); } catch (e) {}
        } else {
          try { await addPrevYearOverlay(yy); } catch (e) {}
        }
        try { injectYearlyToggle(); } catch (e) {}
      })();
      try { syncCalendarControlBar(); } catch (e) {}
      try { refreshNavArrows(); } catch (e) {}
      return;
    }
    var r = (typeof _origUpdateTimeNavUI === 'function') ? _origUpdateTimeNavUI.apply(this, arguments) : undefined;
    try { removeYearlyToggle(); } catch (e) {}
    try { syncCalendarControlBar(); } catch (e) {}
    try { refreshNavArrows(); } catch (e) {}
    return r;
  };

  function syncCalendarControlBar() {
    var bar = document.getElementById('calCtrlBar');
    if (!bar) return;
    var mode = (typeof currentFilterMode !== 'undefined') ? currentFilterMode : '';
    var isCal = (mode === 'weekly' || mode === 'monthly');
    var isYear = (mode === 'yearly');
    // Hien thanh dieu khien cho ca che do Nam (chi de dieu huong nam, khong co lich).
    bar.style.display = (isCal || isYear) ? 'flex' : 'none';
    // Nut an/hien lich chi co y nghia o Tuan/Thang; che do Nam khong co lich -> an nut nay.
    var toggle = document.getElementById('calToggleBtn');
    if (toggle) toggle.style.display = isYear ? 'none' : '';
    var label = document.getElementById('calCtrlLabel');
    var src = document.getElementById('currentPeriodLabel');
    if (label && src && src.textContent) label.textContent = src.textContent;
  }

  // ------------------------------------------------------------------
  // CHE DO NAM — BO SUNG BIEU DO
  // (1) So sanh nam nay voi nam truoc: chong them 1 duong "Chi tieu <nam truoc>"
  //     (net dut) len bieu do 12 thang cua nam dang chon.
  // (2) Xu huong nhieu nam: ve tong Thu/Chi theo tung nam.
  // Tan dung ham co san: loadCustomReport / processReportData /
  // getTransactionsInRange / formatCurrencyWithUnit / Chart.
  // ------------------------------------------------------------------
  async function addPrevYearOverlay(year) {
    if (!window.mChart) return;
    var prevExps = new Array(12).fill(0);
    try {
      var prevTx = await getTransactionsInRange(new Date(year - 1, 0, 1), new Date(year - 1, 11, 31));
      prevTx.forEach(function (t) {
        if (!t || !t.date || t.type === 'Thu nhập') return;
        var p = String(t.date).split('/');
        if (p.length !== 3) return;
        var m = parseInt(p[1], 10);
        if (m >= 1 && m <= 12) prevExps[m - 1] += t.amount;
      });
    } catch (err) { return; }
    if (!window.mChart) return;
    // Ghi ro nam vao nhan 2 nhom du lieu goc (hien trong tooltip + chu thich).
    window.mChart.data.datasets.forEach(function (d) {
      if (d.__prevYear) return;
      if (d.label === 'Thu nhập') d.label = 'Thu nhập ' + year;
      else if (d.label === 'Chi tiêu') d.label = 'Chi tiêu ' + year;
    });
    // Bo overlay cu (neu co) roi them duong chi tieu nam truoc.
    window.mChart.data.datasets = window.mChart.data.datasets.filter(function (d) { return d.__prevYear !== true; });
    window.mChart.data.datasets.push({
      label: 'Chi tiêu ' + (year - 1),
      data: prevExps,
      __prevYear: true,
      type: 'line',
      borderColor: '#F59E0B',
      backgroundColor: 'rgba(245,158,11,0.15)',
      borderWidth: 2,
      borderDash: [5, 4],
      tension: 0.4,
      pointRadius: 3,
      fill: false,
      maxBarThickness: 20
    });
    enableChartLegend();
    window.mChart.update();
  }

  function enableChartLegend() {
    if (!window.mChart) return;
    window.mChart.options.plugins = window.mChart.options.plugins || {};
    window.mChart.options.plugins.legend = window.mChart.options.plugins.legend || {};
    window.mChart.options.plugins.legend.display = true;
    window.mChart.options.plugins.legend.labels = {
      color: '#94A3B8',
      boxWidth: 12,
      font: { size: 10, family: 'Plus Jakarta Sans' }
    };
  }

  // Gom tong Thu/Chi theo tung nam, lui dan tu uptoYear; dung khi gap nam cu
  // khong co du lieu va cat bo cac nam dau tro rong -> chi hien nam co du lieu.
  async function collectYearlyTotals(uptoYear) {
    var results = [];
    var maxBack = 6;
    for (var i = 0; i < maxBack; i++) {
      var y = uptoYear - i;
      var inc = 0, exp = 0, count = 0;
      try {
        var txs = await getTransactionsInRange(new Date(y, 0, 1), new Date(y, 11, 31));
        count = txs.length;
        txs.forEach(function (t) { if (!t) return; if (t.type === 'Thu nhập') inc += t.amount; else exp += t.amount; });
      } catch (err) { count = 0; }
      results.push({ year: y, inc: inc, exp: exp, count: count });
      if (count === 0 && i > 0) break;
    }
    results.reverse();
    while (results.length > 1 && results[0].count === 0) results.shift();
    return results;
  }

  async function drawMultiYearTrend(selYear) {
    var canvas = document.getElementById('monthlyChart');
    if (!canvas) return;
    if (typeof showLoading === 'function') { try { showLoading(true, 'tab2'); } catch (e) {} }
    var rows;
    try { rows = await collectYearlyTotals(new Date().getFullYear()); }
    catch (err) { if (typeof showLoading === 'function') { try { showLoading(false, 'tab2'); } catch (e) {} } return; }
    if (typeof showLoading === 'function') { try { showLoading(false, 'tab2'); } catch (e) {} }
    if (!rows || rows.length === 0) return;
    var labels = rows.map(function (r) { return 'Năm ' + r.year; });
    var incs = rows.map(function (r) { return r.inc; });
    var exps = rows.map(function (r) { return r.exp; });
    var ctx = canvas.getContext('2d');
    if (window.mChart) window.mChart.destroy();
    var h = 250;
    var incG = ctx.createLinearGradient(0, 0, 0, h); incG.addColorStop(0, 'rgba(16, 185, 129, 0.8)'); incG.addColorStop(1, 'rgba(16, 185, 129, 0.1)');
    var expG = ctx.createLinearGradient(0, 0, 0, h); expG.addColorStop(0, 'rgba(244, 63, 94, 0.8)'); expG.addColorStop(1, 'rgba(244, 63, 94, 0.1)');
    window.mChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          { label: 'Thu nhập', data: incs, backgroundColor: incG, borderColor: '#10B981', borderWidth: 0, borderRadius: 4, maxBarThickness: 36 },
          { label: 'Chi tiêu', data: exps, backgroundColor: expG, borderColor: '#F43F5E', borderWidth: 0, borderRadius: 4, maxBarThickness: 36 }
        ]
      },
      options: {
        devicePixelRatio: 4, responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } },
        scales: {
          x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' } } },
          y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' }, callback: function (v) {
            if (typeof isPrivacyActive !== 'undefined' && isPrivacyActive) return '***';
            var o = formatCurrencyWithUnit(v); return o.val + o.unit;
          } } }
        },
        plugins: {
          legend: { display: true, labels: { color: '#94A3B8', boxWidth: 12, font: { size: 10, family: 'Plus Jakarta Sans' } } },
          tooltip: { callbacks: { label: function (c) {
            if (typeof isPrivacyActive !== 'undefined' && isPrivacyActive) return c.dataset.label + ': ***';
            var o = formatCurrencyWithUnit(c.raw); return c.dataset.label + ': ' + o.val + o.unit;
          } } }
        }
      }
    });
    var title = document.getElementById('chartTitleTab2');
    if (title) title.textContent = 'Xu hướng thu chi theo năm';
    var cc = document.querySelector('#tab2 .chart-container');
    if (cc) cc.style.display = 'block';
  }

  function styleToggleBtn(btn, active) {
    btn.style.cssText = 'padding:5px 14px; border-radius:999px; font-size:0.72rem; font-weight:700; cursor:pointer; border:1px solid var(--border-color); transition:all .15s; ' + (active ? 'background:var(--primary); color:#fff; border-color:var(--primary);' : 'background:transparent; color:var(--text-2);');
  }

  function injectYearlyToggle() {
    var title = document.getElementById('chartTitleTab2');
    if (!title || !title.parentNode) return;
    var tg = document.getElementById('yearlyViewToggle');
    if (!tg) {
      tg = document.createElement('div');
      tg.id = 'yearlyViewToggle';
      tg.style.cssText = 'display:flex; gap:8px; justify-content:center; margin:6px 0 12px;';
      var b1 = document.createElement('button');
      b1.type = 'button'; b1.id = 'yvtMonths'; b1.textContent = '12 tháng';
      b1.onclick = function () { triggerHaptic('light'); window.__yearlyView = 'compare'; if (typeof window.updateTimeNavUI === 'function') window.updateTimeNavUI(); };
      var b2 = document.createElement('button');
      b2.type = 'button'; b2.id = 'yvtTrend'; b2.textContent = 'Nhiều năm';
      b2.onclick = function () { triggerHaptic('light'); window.__yearlyView = 'trend'; if (typeof window.updateTimeNavUI === 'function') window.updateTimeNavUI(); };
      tg.appendChild(b1); tg.appendChild(b2);
      title.parentNode.insertBefore(tg, title);
    }
    tg.style.display = 'flex';
    var isTrend = window.__yearlyView === 'trend';
    var mB = document.getElementById('yvtMonths'), tB = document.getElementById('yvtTrend');
    if (mB) styleToggleBtn(mB, !isTrend);
    if (tB) styleToggleBtn(tB, isTrend);
  }

  function removeYearlyToggle() {
    var tg = document.getElementById('yearlyViewToggle');
    if (tg) tg.style.display = 'none';
  }

  // ------------------------------------------------------------------
  // GIOI HAN DIEU HUONG: khong cho sang ky (tuan/thang) khong co du lieu.
  // Vi du: dang thang 7 -> nut sang thang 8 mo di (tuong lai, khong co du lieu).
  // Tuong tu voi lui ve qua khu truoc moc du lieu dau tien.
  // ------------------------------------------------------------------
  function keyOf(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  function weekStartOf(date) {
    var sow = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    var d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    var day = d.getDay(); // 0 = CN ... 6 = T7
    var diff = (sow === 1) ? (day === 0 ? 6 : day - 1) : day;
    d.setDate(d.getDate() - diff);
    return d;
  }

  function nextPeriodStartKey() {
    if (currentFilterMode === 'monthly') {
      return keyOf(new Date(activePeriodDate.getFullYear(), activePeriodDate.getMonth() + 1, 1));
    }
    var ws = weekStartOf(activePeriodDate); ws.setDate(ws.getDate() + 7); return keyOf(ws);
  }
  function prevPeriodEndKey() {
    if (currentFilterMode === 'monthly') {
      return keyOf(new Date(activePeriodDate.getFullYear(), activePeriodDate.getMonth(), 0));
    }
    var ws = weekStartOf(activePeriodDate); ws.setDate(ws.getDate() - 1); return keyOf(ws);
  }

  // Quet 1 lan 12 thang cua nam de biet moc du lieu (min/max), co cache.
  function getNavDataBounds(force) {
    if (force) window.__navBoundsPromise = null;
    if (window.__navBoundsPromise) return window.__navBoundsPromise;
    window.__navBoundsPromise = (async function () {
      var minKey = null, maxKey = null;
      try {
        if (typeof fetchMonthData !== 'function') return { minKey: null, maxKey: null };
        var jobs = [];
        for (var i = 1; i <= 12; i++) jobs.push(fetchMonthData(i).catch(function () { return []; }));
        var results = await Promise.all(jobs);
        results.forEach(function (arr) {
          (arr || []).forEach(function (t) {
            if (!t || !t.date) return;
            var p = String(t.date).split('/');
            if (p.length !== 3) return;
            var k = parseInt(p[2], 10) * 10000 + parseInt(p[1], 10) * 100 + parseInt(p[0], 10);
            if (minKey === null || k < minKey) minKey = k;
            if (maxKey === null || k > maxKey) maxKey = k;
          });
        });
      } catch (e) {}
      return { minKey: minKey, maxKey: maxKey };
    })();
    return window.__navBoundsPromise;
  }
  window.__invalidateNavBounds = function () { window.__navBoundsPromise = null; };

  function setArrowDisabled(ids, disabled) {
    ids.forEach(function (id) {
      var b = document.getElementById(id);
      if (!b) return;
      b.disabled = !!disabled;
      b.classList.toggle('nav-disabled', !!disabled);
    });
  }

  async function refreshNavArrows() {
    var prevIds = ['calPrevBtn', 'prevPeriodBtn'];
    var nextIds = ['calNextBtn', 'nextPeriodBtn'];
    // CHE DO NAM: luon cho lui ve nam truoc (de xem 2025...); chan tien toi nam
    // tuong lai -> chua sang nam moi thi nut sang phai mo di.
    if (currentFilterMode === 'yearly') {
      setArrowDisabled(prevIds, false);
      setArrowDisabled(nextIds, activePeriodDate.getFullYear() >= new Date().getFullYear());
      return;
    }
    if (typeof currentFilterMode === 'undefined' || (currentFilterMode !== 'weekly' && currentFilterMode !== 'monthly')) {
      setArrowDisabled(prevIds, false); setArrowDisabled(nextIds, false); return;
    }
    var todayKey = keyOf(new Date());
    var nStart = nextPeriodStartKey();
    var pEnd = prevPeriodEndKey();
    // Chan tuong lai ngay lap tuc (khong can cho du lieu tai xong).
    setArrowDisabled(nextIds, nStart > todayKey);
    setArrowDisabled(prevIds, false);
    // Tinh chinh them theo moc du lieu thuc te (min/max) - bat dong bo.
    try {
      var b = await getNavDataBounds(false);
      if (b) {
        var dn = (nStart > todayKey) || (b.maxKey === null) || (nStart > b.maxKey);
        var dp = (b.minKey === null) || (pEnd < b.minKey);
        setArrowDisabled(nextIds, dn);
        setArrowDisabled(prevIds, dp);
      }
    } catch (e) {}
  }
  window.__refreshNavArrows = refreshNavArrows;

  window.calShift = function (dir) {
    if (typeof currentFilterMode === 'undefined') return;
    // CHE DO NAM: tien/lui theo tung nam; chan sang nam tuong lai.
    if (currentFilterMode === 'yearly') {
      if (dir > 0 && activePeriodDate.getFullYear() >= new Date().getFullYear()) { triggerHaptic('light'); return; }
      triggerHaptic('light');
      activePeriodDate.setFullYear(activePeriodDate.getFullYear() + dir);
      updateTimeNavUI();
      return;
    }
    if (currentFilterMode !== 'weekly' && currentFilterMode !== 'monthly') return;
    // Chan sang ky tuong lai (chac chan khong co du lieu).
    if (dir > 0 && nextPeriodStartKey() > keyOf(new Date())) { triggerHaptic('light'); return; }
    triggerHaptic('light');
    if (currentFilterMode === 'weekly') activePeriodDate.setDate(activePeriodDate.getDate() + dir * 7);
    else activePeriodDate.setMonth(activePeriodDate.getMonth() + dir);
    updateTimeNavUI();
  };

  // ------------------------------------------------------------------
  // MENU FAB (nút ＋)
  // ------------------------------------------------------------------
  window.toggleFabMenu = function () {
    triggerHaptic('light');
    var m = document.getElementById('fabMenu'), b = document.getElementById('fabBackdrop'), f = document.getElementById('fabBtn');
    if (!m) return;
    var open = m.classList.toggle('show');
    if (b) b.classList.toggle('show', open);
    if (f) f.classList.toggle('active', open);
  };
  window.closeFabMenu = function () {
    var m = document.getElementById('fabMenu'), b = document.getElementById('fabBackdrop'), f = document.getElementById('fabBtn');
    if (m) m.classList.remove('show');
    if (b) b.classList.remove('show');
    if (f) f.classList.remove('active');
  };
  window.fabAddIncome = function () { closeFabMenu(); window.openAddForm('Thu nhập'); };
  window.fabAddExpense = function () { closeFabMenu(); window.openAddForm('Chi tiêu'); };
  window.fabSearch = function () { closeFabMenu(); if (typeof window.openSearchModal === 'function') window.openSearchModal(); };
  window.fabSettings = function () { closeFabMenu(); openFullscreen('settingsPage'); };
  window.fabAbout = function () { closeFabMenu(); openFullscreen('aboutPage'); };

  // ------------------------------------------------------------------
  // TRANG TOAN MAN HINH (Cài đặt / Giới thiệu)
  // ------------------------------------------------------------------
  function openFullscreen(id) {
    triggerHaptic('light');
    var el = document.getElementById(id);
    if (el) { el.scrollTop = 0; el.classList.add('show'); document.body.classList.add('fullscreen-open'); }
  }
  window.openFullscreen = openFullscreen;
  window.closeFullscreen = function (id) {
    triggerHaptic('light');
    var el = document.getElementById(id);
    if (el) el.classList.remove('show');
    if (!document.querySelector('.fullscreen-page.show')) document.body.classList.remove('fullscreen-open');
  };

  // ------------------------------------------------------------------
  // KHỎI TẠO SAU KHI DOM SẮN SÀNG
  // ------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var fabBtn = document.getElementById('fabBtn');
    if (fabBtn) fabBtn.onclick = window.toggleFabMenu;

    setupHeroDateNative();
    setupSearchTab();
    setupSearchCount();
    setupNavIndicator();

    window.addEventListener('resize', function () { try { positionNavIndicator(); } catch (e) {} });
    window.addEventListener('load', function () { try { positionNavIndicator(); } catch (e) {} });

    var calPrev = document.getElementById('calPrevBtn'); if (calPrev) calPrev.onclick = function () { window.calShift(-1); };
    var calNext = document.getElementById('calNextBtn'); if (calNext) calNext.onclick = function () { window.calShift(1); };
    var calWidget = document.getElementById('calendarWidget');
    if (calWidget && localStorage.getItem('calCollapsed') === 'true') calWidget.classList.add('cal-collapsed');
    var calToggle = document.getElementById('calToggleBtn');
    if (calToggle) calToggle.onclick = function () {
      triggerHaptic('light');
      if (!calWidget) return;
      var c = calWidget.classList.toggle('cal-collapsed');
      localStorage.setItem('calCollapsed', c);
    };

    setupDateDisplay('addDate', 'addDateDisplay');
    setupDateDisplay('editDate', 'editDateDisplay');

    addModalCloseX('detailModal', 'closeDetailModal');
    addModalCloseX('searchModal', 'closeSearchModal');
    addModalCloseX('addModal', 'closeAddForm');
    addModalCloseX('editModal', 'closeEditForm');
    addModalCloseX('iconPickerModal', 'closeIconPickerModal');
    addModalCloseX('pdfPreviewModal', 'closeAllModals');

    document.querySelectorAll('.fs-back').forEach(function (b) {
      if (!b.querySelector('.fs-back-label')) {
        var s = document.createElement('span');
        s.className = 'fs-back-label';
        s.textContent = 'Quay Lại';
        b.appendChild(s);
      }
    });
    enableSwipeBack('settingsPage');
    enableSwipeBack('aboutPage');

    try { syncCalendarControlBar(); } catch (e) {}
    try { refreshNavArrows(); } catch (e) {}
  });
})();
