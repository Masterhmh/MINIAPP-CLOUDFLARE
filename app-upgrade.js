// ============================================================================
// app-upgrade.js — NÂNG CẤP GIAO DIỆN (nạp CUỐI CÙNG, sau app-init.js)
// ----------------------------------------------------------------------------
// Vai trò: bổ sung tính năng/giao diện mới MÀ KHÔNG sửa các file cũ:
//   1) Tab 1: bấm chữ ngày -> mở lịch chọn ngày (popup).
//   2) Nút ＋ (FAB): Thêm thu nhập / chi tiêu / Tìm kiếm / Cài đặt / Giới thiệu.
//   3) Cài đặt / Giới thiệu dạng trang toàn màn hình.
//   4) Tab 2: nút ẩn/hiện lịch + mũi tên tiến/lùi.
//   5) Hiển thị ngày dạng dd/MM/yyyy ở form Thêm/Sửa (lớp phủ đè ô date mặc định).
// ============================================================================

(function () {
  'use strict';

  // ------------------------------------------------------------------
  // Tiện ích hiển thị ngày dd/MM/yyyy đè lên ô <input type="date">
  // ------------------------------------------------------------------
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

  // ------------------------------------------------------------------
  // 1) WRAP openAddForm — khóa loại giao dịch (Thu nhập / Chi tiêu)
  //    Ẩn ô chọn loại TRƯỚC khi form hiện để tránh nháy.
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

  // WRAP openEditForm — cập nhật hiển thị ngày dd/MM/yyyy sau khi mở form sửa
  var _origOpenEditForm = window.openEditForm;
  window.openEditForm = async function (tx) {
    if (typeof _origOpenEditForm === 'function') { await _origOpenEditForm(tx); }
    syncDateDisplay('editDate', 'editDateDisplay');
  };

  // ------------------------------------------------------------------
  // 2) WRAP closeAllModals — đóng luôn popup lịch chọn ngày
  // ------------------------------------------------------------------
  var _origCloseAll = window.closeAllModals;
  window.closeAllModals = function () {
    if (typeof _origCloseAll === 'function') _origCloseAll();
    var dp = document.getElementById('datePickerModal');
    if (dp) dp.classList.remove('show');
  };

  // ------------------------------------------------------------------
  // 3) WRAP updateTimeNavUI — đồng bộ thanh điều khiển lịch (Tab 2)
  // ------------------------------------------------------------------
  var _origUpdateTimeNavUI = window.updateTimeNavUI;
  window.updateTimeNavUI = function () {
    var r = (typeof _origUpdateTimeNavUI === 'function') ? _origUpdateTimeNavUI.apply(this, arguments) : undefined;
    try { syncCalendarControlBar(); } catch (e) {}
    return r;
  };

  function syncCalendarControlBar() {
    var bar = document.getElementById('calCtrlBar');
    if (!bar) return;
    var isCal = (typeof currentFilterMode !== 'undefined') && (currentFilterMode === 'weekly' || currentFilterMode === 'monthly');
    bar.style.display = isCal ? 'flex' : 'none';
    var label = document.getElementById('calCtrlLabel');
    var src = document.getElementById('currentPeriodLabel');
    if (label && src && src.textContent) label.textContent = src.textContent;
  }

  window.calShift = function (dir) {
    triggerHaptic('light');
    if (typeof currentFilterMode === 'undefined') return;
    if (currentFilterMode === 'weekly') activePeriodDate.setDate(activePeriodDate.getDate() + dir * 7);
    else if (currentFilterMode === 'monthly') activePeriodDate.setMonth(activePeriodDate.getMonth() + dir);
    else return;
    updateTimeNavUI();
  };

  // ------------------------------------------------------------------
  // 4) MENU FAB (nút ＋)
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
  // 5) TRANG TOÀN MÀN HÌNH (Cài đặt / Giới thiệu)
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
  // 6) LỊ CH CHỌN NGÀY (TAB 1)
  // ------------------------------------------------------------------
  var dpDate = new Date();
  var DP_MONTHS = ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'];

  window.openDatePicker = function () {
    triggerHaptic('light');
    var t = document.getElementById('transactionDate');
    var cur = t ? t.value : '';
    if (cur) { var p = cur.split('-'); dpDate = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10)); }
    else { dpDate = new Date(); }
    renderDatePicker();
    var ov = document.getElementById('modalOverlay'); if (ov) ov.classList.add('show');
    setTimeout(function () { var m = document.getElementById('datePickerModal'); if (m) m.classList.add('show'); }, 10);
  };
  window.closeDatePicker = function () {
    var m = document.getElementById('datePickerModal'); if (m) m.classList.remove('show');
    setTimeout(function () { var ov = document.getElementById('modalOverlay'); if (ov) ov.classList.remove('show'); }, 300);
  };
  window.dpPrev = function () { triggerHaptic('light'); dpDate.setMonth(dpDate.getMonth() - 1); renderDatePicker(); };
  window.dpNext = function () { triggerHaptic('light'); dpDate.setMonth(dpDate.getMonth() + 1); renderDatePicker(); };
  window.dpToday = function () { triggerHaptic('light'); var k = formatDateToYYYYMMDD(new Date()); var t = document.getElementById('transactionDate'); if (t) t.value = k; closeDatePicker(); window.fetchTransactions(false); };

  function renderDatePicker() {
    var startOfWeek = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    var y = dpDate.getFullYear(), mo = dpDate.getMonth();
    var label = document.getElementById('dpMonthLabel'); if (label) label.textContent = DP_MONTHS[mo] + ' ' + y;
    var wh = document.getElementById('dpWeekHead');
    var wk = startOfWeek === 1 ? ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'] : ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
    if (wh) wh.innerHTML = wk.map(function (d) { return '<span>' + d + '</span>'; }).join('');
    var grid = document.getElementById('dpGrid'); if (!grid) return; grid.innerHTML = '';
    var firstDay = new Date(y, mo, 1).getDay();
    if (startOfWeek === 1) firstDay = firstDay === 0 ? 6 : firstDay - 1;
    var daysInMonth = new Date(y, mo + 1, 0).getDate();
    var t = document.getElementById('transactionDate');
    var selVal = t ? t.value : '';
    var todayKey = formatDateToYYYYMMDD(new Date());
    var i, cell;
    for (i = 0; i < firstDay; i++) { cell = document.createElement('div'); cell.className = 'dp-day empty'; grid.appendChild(cell); }
    for (var d = 1; d <= daysInMonth; d++) {
      (function (day) {
        var key = formatDateToYYYYMMDD(new Date(y, mo, day));
        var c = document.createElement('div'); c.className = 'dp-day';
        if (key === todayKey) c.classList.add('today');
        if (selVal === key) c.classList.add('selected');
        c.textContent = day;
        c.onclick = function () { triggerHaptic('light'); var tt = document.getElementById('transactionDate'); if (tt) tt.value = key; closeDatePicker(); window.fetchTransactions(false); };
        grid.appendChild(c);
      })(d);
    }
  }

  // ------------------------------------------------------------------
  // 7) KHỎI TẠO SAU KHI DOM SẮN SÀNG
  // ------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', function () {
    var fabBtn = document.getElementById('fabBtn');
    if (fabBtn) fabBtn.onclick = window.toggleFabMenu;

    var dateText = document.getElementById('displayCurrentDate');
    if (dateText) {
      dateText.style.cursor = 'pointer';
      dateText.addEventListener('click', function (e) { e.stopPropagation(); window.openDatePicker(); });
    }

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

    // Hiển thị ngày dd/MM/yyyy cho form Thêm & Sửa
    setupDateDisplay('addDate', 'addDateDisplay');
    setupDateDisplay('editDate', 'editDateDisplay');

    try { syncCalendarControlBar(); } catch (e) {}
  });
})();
