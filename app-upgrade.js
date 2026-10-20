// ============================================================================
// app-upgrade.js — NÂNG CẤP GIAO DIỆN (nạp CUỐI CÙNG, sau app-init.js)
// ----------------------------------------------------------------------------
// 1) Tab 1: bấm dòng ngày -> bảng chọn ngày GỐC của OS.
// 2) Nút ＋ (FAB): Thêm thu nhập / chi tiêu / Cài đặt / Giới thiệu.
// 3) Cài đặt / Giới thiệu dạng trang toàn màn hình (Quay lại bên phải + vuốt).
// 4) Tab 2: ẩn/hiện lịch + mũi tên tiến/lùi (chặn kỳ không có dữ liệu).
// 5) Ngày dd/MM/yyyy ở form Thêm/Sửa.
// 6) Nút đóng ✕ cho modal.
// 7) Tab Tìm kiếm (thêm nút Tìm kiếm vào thanh điều hướng, mở modal tìm kiếm).
// 8) Đếm tổng giao dịch + sắp xếp kết quả tìm kiếm theo ngày mới nhất.
// 9) Indicator trượt giữa các tab trên thanh điều hướng.
// 10) Nhãn so sánh ghi rõ kỳ trước (so với tuần 26 / tháng 6 / năm 2025).
// 11) Che do Nam: lam mo mui ten lui khi nam lien truoc khong co du lieu.
// 12) Tang toc: tai CA NAM trong 1 request (bao cao Nam tu 24 -> 2 request);
//     nap ngam nam nay + nam truoc khi vao tab Bao cao de che do Nam mo tuc thi.
// 13) Tinh chinh toc do: CHI gom-tai ca nam cho bao cao Nam/Tuy chon (>=4 thang);
//     Tuan/Thang giu ban goc (1-2 request/thang, nhe hon) de khong giai bang thong
//     lam cham Tab 1. Khi xem 1 nam -> nap ngam nam so sanh ke tiep (selY-2) de
//     bam "lui" hien ra tuc thi (nam hien tai da co san, nam so sanh cung da san).
// ============================================================================

(function () {
  'use strict';

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
    // ROUND 3n (bổ sung, Hùng yêu cầu): TOÀN BỘ hộp pill ngày (chữ +
    // caret + vùng đệm) bấm là mở trình chọn ngày — trước đây chỉ lớp
    // input phủ mới nhận bấm, một số client (Telegram Desktop) không tự
    // mở picker khi bấm vào input mờ. Nay gọi thẳng showPicker() (có
    // gesture thật từ cú bấm), lỗi/thiếu API thì fallback focus() để
    // client tự mở theo cách của nó. Nút ‹ › nằm NGOÀI wrap nên vẫn
    // bước ngày, không mở picker.
    function openHeroPicker() {
      try { if (typeof tInput.showPicker === 'function') { tInput.showPicker(); return; } } catch (e) {}
      try { tInput.focus(); } catch (e) {}
    }
    wrap.addEventListener('click', function () { openHeroPicker(); });
    tInput.addEventListener('click', function (e) { e.stopPropagation(); openHeroPicker(); });
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

  /* PERSONAL ROUND 2 (20/10): port nguyên bản setupSearchTab() của production —
     Tìm kiếm + Cài đặt đều thành nút trên thanh nav (sau nav-spacer),
     giống hệt bản tham chiếu. Từ khóa rời nav (vào menu FAB -> fabKeywords). */
  function setupSearchTab() {
    var fabMenu = document.getElementById('fabMenu');
    if (fabMenu) {
      fabMenu.querySelectorAll('.fab-item').forEach(function (it) {
        var lbl = it.querySelector('.fab-item-label');
        if (lbl && lbl.textContent.trim() === 'Tìm kiếm') it.remove();
      });
    }
    var group = document.querySelector('.nav-tabs-group');
    var spacer = group ? group.querySelector('.nav-spacer') : null;
    if (group && !document.getElementById('navSearchBtn')) {
      var btn = document.createElement('button');
      btn.id = 'navSearchBtn';
      btn.className = 'nav-btn';
      btn.type = 'button';
      btn.innerHTML = '<div class="nav-icon-wrap"><i class="fas fa-search"></i></div><span class="nav-label">Tìm kiếm</span>';
      btn.onclick = function () {
        triggerHaptic('light');
        document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
        btn.classList.add('active');
        if (typeof window.openSearchModal === 'function') window.openSearchModal();
      };
      if (spacer && spacer.nextSibling) group.insertBefore(btn, spacer.nextSibling);
      else group.appendChild(btn);
    }
    /* Cài đặt ra thanh nav, đứng sau Tìm kiếm (Từ khóa rời nav) */
    if (group && !document.getElementById('navSettingsBtn')) {
      var sbtn = document.createElement('button');
      sbtn.id = 'navSettingsBtn';
      sbtn.className = 'nav-btn';
      sbtn.type = 'button';
      sbtn.innerHTML = '<div class="nav-icon-wrap"><i class="fas fa-cog"></i></div><span class="nav-label">Cài đặt</span>';
      sbtn.onclick = function () {
        triggerHaptic('light');
        document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
        sbtn.classList.add('active');
        if (typeof window.openFullscreen === 'function') window.openFullscreen('settingsPage');
      };
      group.appendChild(sbtn);
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
  // WRAP openTab — cập nhật vị trí indicator + nap ngam du lieu bao cao
  // ------------------------------------------------------------------
  var _origOpenTab = window.openTab;
  if (typeof _origOpenTab === 'function') {
    window.openTab = function (tabId) {
      var r = _origOpenTab.apply(this, arguments);
      try { positionNavIndicator(); } catch (e) {}
      // Vao tab Bao cao -> nap ngam nam nay + nam truoc o nen de khi chon
      // "Theo nam" hien ra ngay, khong phai cho tai.
      try { if (tabId === 'tab2') prefetchYearsForReports(); } catch (e) {}
      return r;
    };
  }

  // ------------------------------------------------------------------
  // WRAP fetchTransactions — lam moi moc du lieu dieu huong khi tai lai
  // ------------------------------------------------------------------
  var _origFetchTransactions = window.fetchTransactions;
  if (typeof _origFetchTransactions === 'function') {
    window.fetchTransactions = function (force) {
      if (force === true) { window.__navBoundsPromise = null; window.monthDataCache = {}; window.__yearHasDataCache = {}; window.apiTxCache = {}; window.__yearFetchInFlight = {}; }
      return _origFetchTransactions.apply(this, arguments);
    };
  }

  // ------------------------------------------------------------------
  // TANG TOC TAI DU LIEU: tai CA NAM trong 1 request thay vi 12 request/thang.
  // Firebase RTDB cho phep lay /transactions/{nam}.json (ca 12 thang) 1 lan.
  // Sau do do vao window.monthDataCache theo tung thang (ke ca thang rong = [])
  // de fetchMonthData khong goi mang lai. Bao cao Nam giam tu 24 -> 2 request,
  // va moi thao tac chuyen tuan/thang trong cung nam sau do gan nhu tuc thi.
  // Chong trung: neu 1 nam dang duoc tai, cac loi goi khac dung chung 1 promise.
  // (Da chuyen sang window.secureFetch -> doc qua cong bao mat, khong lo FIREBASE_URL.)
  // ------------------------------------------------------------------
  function fetchYearData(year, force) {
    if (!window.monthDataCache) window.monthDataCache = {};
    if (!window.__yearFetchInFlight) window.__yearFetchInFlight = {};
    var y = parseInt(year, 10) || new Date().getFullYear();
    if (!force) {
      var allCached = true;
      for (var m = 1; m <= 12; m++) { if (!((y + '_' + m) in window.monthDataCache)) { allCached = false; break; } }
      if (allCached) return Promise.resolve(true);
      if (window.__yearFetchInFlight[y]) return window.__yearFetchInFlight[y];
    }
    var p = (async function () {
      try {
        var data = await window.secureFetch('/transactions/' + y + '.json');
        for (var mm = 1; mm <= 12; mm++) {
          var node = data ? data['month_' + mm] : null;
          var result = [];
          if (node) {
            result = Object.values(node).filter(function (item) { return item !== null; }).map(function (item) {
              if (item && item.date) { var pp = String(item.date).split('/'); if (pp.length === 3) item.date = String(parseInt(pp[0], 10)).padStart(2, '0') + '/' + String(parseInt(pp[1], 10)).padStart(2, '0') + '/' + pp[2]; }
              return item;
            });
          }
          window.monthDataCache[y + '_' + mm] = result;
        }
        return true;
      } catch (e) { return false; }
      finally { try { delete window.__yearFetchInFlight[y]; } catch (e) {} }
    })();
    window.__yearFetchInFlight[y] = p;
    return p;
  }
  window.fetchYearData = fetchYearData;

  // Nap ngam (background, luc may ranh) du lieu ca 1 nam. Dung khi muon chuan bi
  // truoc du lieu nam se can den ma khong lam giat UI hien tai.
  function prefetchYearIdle(year) {
    var y = parseInt(year, 10);
    if (!y || y < 2000) return;
    var runIdle = window.requestIdleCallback || function (fn) { return setTimeout(fn, 200); };
    runIdle(function () { try { fetchYearData(y); } catch (e) {} });
  }
  window.__prefetchYearIdle = prefetchYearIdle;

  // Nap ngam du lieu ca nam de che do Nam mo ra tuc thi. Chi tai nam nay +
  // nam truoc (nam so sanh mac dinh); fetchYearData tu bo qua neu da co san.
  function prefetchYearsForReports() {
    var cy = new Date().getFullYear();
    prefetchYearIdle(cy);
    prefetchYearIdle(cy - 1);
  }
  window.__prefetchYearsForReports = prefetchYearsForReports;

  // WRAP getTransactionsInRange — CHI gom-tai ca nam (1 request/nam) khi khoang
  // du lieu ROng (>=4 thang: bao cao Nam / Tuy chon nhieu thang). Voi Tuan/Thang
  // (<=3 thang) giu ban goc: chi tai 1-2 thang can thiet, KHONG tai thua ca nam.
  // Ly do: tai ca nam cho 1 tuan la lang phi va gianh bang thong lam cham Tab 1.
  var _origGetTransactionsInRange = window.getTransactionsInRange;
  if (typeof _origGetTransactionsInRange === 'function') {
    window.getTransactionsInRange = async function (startDate, endDate) {
      try {
        if (startDate && endDate) {
          var sY = startDate.getFullYear(), eY = endDate.getFullYear();
          var monthsSpan = (eY - sY) * 12 + (endDate.getMonth() - startDate.getMonth()) + 1;
          if (monthsSpan >= 4) {
            var jobs = [];
            for (var y = sY; y <= eY; y++) jobs.push(fetchYearData(y));
            await Promise.all(jobs);
          }
        }
      } catch (e) {}
      return _origGetTransactionsInRange.apply(this, arguments);
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
  // WRAP so sánh kỳ trước — HIỂN THỊ RÕ kỳ được so sánh:
  //   Tuần 27 -> "so với tuần 26"; Tháng 7 -> "so với tháng 6";
  //   Năm 2026 -> "so với năm 2025". (Bản gốc chỉ ghi chung "kỳ trước".)
  // Cách làm: mỗi hàm tải báo cáo tự tính nhãn kỳ trước và lưu vào
  // window.__cmpText; processReportData (bản bọc) vẽ lại 3 ô so sánh với nhãn đó.
  // Baseline so sánh KHÔNG đổi (vẫn là tuần -1 / tháng -1 / năm -1), chỉ đổi CHỪ.
  // ------------------------------------------------------------------
  var _origProcessReportData = window.processReportData;
  if (typeof _origProcessReportData === 'function') {
    window.processReportData = function (currentTx, prevTx, labels, incs, exps) {
      var r = _origProcessReportData.apply(this, arguments);
      try {
        var txt = window.__cmpText;
        if (txt && typeof getCompareHTML === 'function') {
          var tInc = 0, tExp = 0; (currentTx || []).forEach(function (i) { if (i.type === 'Thu nhập') tInc += i.amount; else tExp += i.amount; });
          var pInc = 0, pExp = 0; (prevTx || []).forEach(function (i) { if (i.type === 'Thu nhập') pInc += i.amount; else pExp += i.amount; });
          var tBal = tInc - tExp, pBal = pInc - pExp;
          var ei = document.getElementById('tab2IncomeCompare'); if (ei) ei.innerHTML = getCompareHTML(tInc, pInc, 'income', txt);
          var ee = document.getElementById('tab2ExpenseCompare'); if (ee) ee.innerHTML = getCompareHTML(tExp, pExp, 'expense', txt);
          var eb = document.getElementById('tab2BalanceCompare'); if (eb) eb.innerHTML = getCompareHTML(tBal, pBal, 'balance', txt);
          // (personal-port) G6: định dạng ô so sánh thành 2 tầng sau khi ghi đè
          try { if (typeof formatG6CompareCell === 'function') { ['tab2IncomeCompare', 'tab2ExpenseCompare', 'tab2BalanceCompare'].forEach(function (id) { formatG6CompareCell(document.getElementById(id)); }); } } catch (e) {}
        }
      } catch (e) {}
      return r;
    };
  }

  var _origLoadWeeklyReport = window.loadWeeklyReport;
  if (typeof _origLoadWeeklyReport === 'function') {
    window.loadWeeklyReport = function (weekStr) {
      try {
        var sd = (typeof getDateFromWeekString === 'function') ? getDateFromWeekString(weekStr) : null;
        if (sd && typeof getWeekNumber === 'function') {
          var psd = new Date(sd); psd.setDate(psd.getDate() - 7);
          window.__cmpText = 'so với tuần ' + getWeekNumber(psd);
        } else window.__cmpText = null;
      } catch (e) { window.__cmpText = null; }
      return _origLoadWeeklyReport.apply(this, arguments);
    };
  }

  var _origLoadMonthlyReport = window.loadMonthlyReport;
  if (typeof _origLoadMonthlyReport === 'function') {
    window.loadMonthlyReport = function (monthStr) {
      try {
        var parts = String(monthStr).split('-').map(Number);
        var year = parts[0], month = parts[1];
        var prevM = month - 1, prevY = year;
        if (prevM === 0) { prevM = 12; prevY = year - 1; }
        window.__cmpText = 'so với tháng ' + prevM + (prevY !== year ? '/' + prevY : '');
      } catch (e) { window.__cmpText = null; }
      return _origLoadMonthlyReport.apply(this, arguments);
    };
  }

  var _origLoadCustomReport = window.loadCustomReport;
  if (typeof _origLoadCustomReport === 'function') {
    window.loadCustomReport = function (startMonth, endMonth, year) {
      // (personal-port) cả năm -> "so với năm trước"; khoảng tùy chọn ->
      // "so với kỳ trước" (kỳ liền trước cùng độ dài, xem loadCustomReport).
      try { window.__cmpText = (startMonth === 1 && endMonth === 12) ? 'so với năm ' + (year - 1) : 'so với kỳ trước'; } catch (e) { window.__cmpText = null; }
      return _origLoadCustomReport.apply(this, arguments);
    };
  }

  // ------------------------------------------------------------------
  // WRAP updateTimeNavUI — đồng bộ thanh điều khiển lịch (Tab 2)
  // CHE DO NAM: tu xu ly de dieu huong theo activePeriodDate (nam dang chon),
  // dat nhan "Nam xxxx" va tai bao cao 12 thang cua nam do. KHONG goi ban goc
  // vi ban goc luon tai nam hien tai (hardcode) va khong dat nhan nam.
  // ------------------------------------------------------------------
  var _origUpdateTimeNavUI = window.updateTimeNavUI;
  window.updateTimeNavUI = function () {
    if (typeof currentFilterMode !== 'undefined' && currentFilterMode === 'yearly') {
      var timeNav = document.getElementById('timeNavContainer');
      var customNav = document.getElementById('customFilterContainer');
      if (timeNav) timeNav.style.display = 'none';
      if (customNav) customNav.style.display = 'none';
      var lbl = document.getElementById('currentPeriodLabel');
      if (lbl) lbl.textContent = 'Năm ' + activePeriodDate.getFullYear();
      var selY = activePeriodDate.getFullYear();
      if (typeof loadCustomReport === 'function') loadCustomReport(1, 12, selY);
      // Nap ngam nam so sanh cho lan LUI ke tiep: xem nam Y can Y (hien tai, da co)
      // + Y-1 (so sanh, loadCustomReport da tai). Khi lui ve Y-1 se can Y-2 lam
      // nam so sanh -> nap ngam truoc de bam "lui" hien ra tuc thi.
      try { prefetchYearIdle(selY - 2); } catch (e) {}
      try { syncCalendarControlBar(); } catch (e) {}
      try { refreshNavArrows(); } catch (e) {}
      return;
    }
    var r = (typeof _origUpdateTimeNavUI === 'function') ? _origUpdateTimeNavUI.apply(this, arguments) : undefined;
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

  // Quet CA NAM (1 request nho fetchYearData) de biet moc du lieu (min/max), co cache.
  function getNavDataBounds(force) {
    if (force) window.__navBoundsPromise = null;
    if (window.__navBoundsPromise) return window.__navBoundsPromise;
    window.__navBoundsPromise = (async function () {
      var minKey = null, maxKey = null;
      try {
        var yr = new Date().getFullYear();
        await fetchYearData(yr);
        for (var m = 1; m <= 12; m++) {
          var arr = (window.monthDataCache && window.monthDataCache[yr + '_' + m]) || [];
          arr.forEach(function (t) {
            if (!t || !t.date) return;
            var p = String(t.date).split('/');
            if (p.length !== 3) return;
            var k = parseInt(p[2], 10) * 10000 + parseInt(p[1], 10) * 100 + parseInt(p[0], 10);
            if (minKey === null || k < minKey) minKey = k;
            if (maxKey === null || k > maxKey) maxKey = k;
          });
        }
      } catch (e) {}
      return { minKey: minKey, maxKey: maxKey };
    })();
    return window.__navBoundsPromise;
  }
  window.__invalidateNavBounds = function () { window.__navBoundsPromise = null; };

  // CHE DO NAM: kiem tra 1 nam co du lieu hay khong (co cache) de lam mo mui ten
  // lui khi nam lien truoc khong co giao dich. Dung lai getTransactionsInRange
  // (da co cache theo khoang ngay) -> thuong trung cache voi prevYear ma
  // loadCustomReport da tai san khi xem 1 nam.
  async function yearHasData(year) {
    if (!window.__yearHasDataCache) window.__yearHasDataCache = {};
    if (year in window.__yearHasDataCache) return window.__yearHasDataCache[year];
    var has = false;
    try {
      if (typeof getTransactionsInRange === 'function') {
        var txs = await getTransactionsInRange(new Date(year, 0, 1), new Date(year, 11, 31));
        has = !!(txs && txs.length);
      }
    } catch (e) { has = false; }
    window.__yearHasDataCache[year] = has;
    return has;
  }
  window.__yearHasData = yearHasData;

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
    // CHE DO NAM: chan tien toi nam tuong lai; nut lui chi bat khi nam LIEN TRUOC
    // (selY - 1) co du lieu -> nam trong thi lam mo, khong cho quay ve.
    if (currentFilterMode === 'yearly') {
      var selY = activePeriodDate.getFullYear();
      setArrowDisabled(nextIds, selY >= new Date().getFullYear());
      var cache = window.__yearHasDataCache || {};
      if ((selY - 1) in cache) {
        setArrowDisabled(prevIds, !cache[selY - 1]);
      } else {
        // Chua biet chac -> tam lam mo de tranh loi vao nam trong, roi cap nhat lai.
        setArrowDisabled(prevIds, true);
        yearHasData(selY - 1).then(function (has) {
          if (activePeriodDate.getFullYear() === selY) setArrowDisabled(prevIds, !has);
        });
      }
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
    // CHE DO NAM: tien/lui theo tung nam; chan sang nam tuong lai va nam trong.
    if (currentFilterMode === 'yearly') {
      if (dir > 0 && activePeriodDate.getFullYear() >= new Date().getFullYear()) { triggerHaptic('light'); return; }
      if (dir < 0) {
        var cache = window.__yearHasDataCache || {};
        var py = activePeriodDate.getFullYear() - 1;
        if ((py in cache) && !cache[py]) { triggerHaptic('light'); return; }
      }
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
  // (personal-port) ROUND 3m: BẢNG CHỌN KỲ cho Tab 2 — chạm vào NHÃN kỳ
  // (Tuần/Tháng/Năm) mở sheet chọn nhanh, thay vì chỉ tiến/lùi từng kỳ
  // bằng mũi tên. Chọn xong đi ĐÚNG đường của 2 input ẩn week/month:
  // gán activePeriodDate rồi updateTimeNavUI() -> mọi khối báo cáo tải
  // lại (panel G6, biểu đồ, lịch, danh mục).
  // GIỚI HẠN chọn = đúng tầm với của mũi tên (refreshNavArrows):
  //  - Tuần/Tháng: getNavDataBounds() (min/max ngày có dữ liệu — quét
  //    năm hiện tại như cơ chế giới hạn điều hướng hiện hữu) + không
  //    kỳ nào bắt đầu sau hôm nay.
  //  - Năm: không quá năm hiện tại; lùi chỉ qua các năm LIỀN KỀ có dữ
  //    liệu (chuỗi yearHasData từ năm nay xuống — đúng cách nút ‹ ở
  //    chế độ năm bị chặn bởi năm trống đầu tiên).
  // Kỳ đang xem luôn tô tím, kể cả khi nó nằm ngoài tầm dữ liệu (vd
  // tuần hiện tại chưa phát sinh giao dịch): giống hệt vị thế mũi tên —
  // đang đứng ở đó nhưng không bấm qua lại được.
  // Markup sheet + dấu ▾ được TIÊM bằng JS (index.html không đổi):
  // sheet dùng khuôn .modal-sheet + #modalOverlay có sẵn; CSS ở
  // personal-compat.css §26.
  // ------------------------------------------------------------------
  var ppYear = null; // năm đang hiển thị trong sheet tuần/tháng

  function ppDM(d) { return String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0'); }
  function ppMode() { return (typeof currentFilterMode !== 'undefined') ? currentFilterMode : ''; }

  function ppEnsureDom() {
    if (!document.getElementById('periodPickerSheet')) {
      var sh = document.createElement('div');
      sh.id = 'periodPickerSheet';
      sh.className = 'modal-sheet period-picker-sheet';
      sh.style.display = 'flex'; sh.style.flexDirection = 'column';
      sh.innerHTML =
        '<div class="modal-handle" onclick="closePeriodPicker()"></div>' +
        '<div class="modal-title" style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">' +
          '<span id="periodPickerTitle">CHỌN KỲ</span>' +
          '<button type="button" class="pp-x" onclick="closePeriodPicker()" aria-label="Đóng"><i class="fas fa-times"></i></button>' +
        '</div>' +
        '<div id="periodPickerBody" class="pp-body"></div>';
      document.body.appendChild(sh);
    }
    // Dấu ▾ cạnh 2 nhãn kỳ (là anh em của span nhãn — không bị
    // textContent của nhãn ghi đè khi updateTimeNavUI/sync chạy).
    // Dùng ký tự ▾ dạng chữ (không phải glyph Font Awesome) để dấu
    // luôn hiển thị kể cả nơi FA không tải được. LƯU Ý BỐ CỤC: hàng
    // #timeNavContainer gốc bị upgrade.css ẩn vĩnh viễn
    // (display:none !important) — nhãn kỳ người dùng thực sự nhìn và
    // bấm là #calCtrlLabel trên thanh điều khiển lịch (cùng các nút
    // calPrev/calNext -> calShift). Cả 2 nhãn đều được nối sự kiện.
    [['currentPeriodLabel', 'ppCaretNav'], ['calCtrlLabel', 'ppCaretCal']].forEach(function (pair) {
      var lbl = document.getElementById(pair[0]);
      if (lbl && !document.getElementById(pair[1])) {
        var c = document.createElement('span');
        c.className = 'pp-caret';
        c.id = pair[1]; c.setAttribute('aria-hidden', 'true');
        c.textContent = '▾';
        lbl.parentNode.insertBefore(c, lbl.nextSibling);
      }
    });
  }

  function closePeriodPicker() {
    var sh = document.getElementById('periodPickerSheet');
    if (sh) sh.classList.remove('show');
    // Bỏ overlay vô điều kiện sau 300ms như mọi hàm đóng modal khác
    // (closeSearchModal/closeEditForm): KHÔNG được kiểm tra
    // '.modal-sheet.show' vì confirm-dialog của app mang class đó
    // VĨNH VIỄN (ẩn/hiện bằng cơ chế riêng) -> overlay sẽ kẹt mãi.
    setTimeout(function () {
      var ov = document.getElementById('modalOverlay');
      if (ov) ov.classList.remove('show');
    }, 300);
  }
  window.closePeriodPicker = closePeriodPicker;

  async function openPeriodPicker() {
    var mode = ppMode();
    if (mode !== 'weekly' && mode !== 'monthly' && mode !== 'yearly') return;
    ppEnsureDom();
    triggerHaptic('light');
    ppYear = activePeriodDate.getFullYear();
    var title = document.getElementById('periodPickerTitle');
    if (title) title.textContent = mode === 'weekly' ? 'CHỌN TUẦN' : (mode === 'monthly' ? 'CHỌN THÁNG' : 'CHỌN NĂM');
    var ov = document.getElementById('modalOverlay');
    if (ov) ov.classList.add('show');
    var sh = document.getElementById('periodPickerSheet');
    if (sh) setTimeout(function () { sh.classList.add('show'); }, 10);
    await ppRender();
  }
  window.openPeriodPicker = openPeriodPicker;

  async function ppRender() {
    var body = document.getElementById('periodPickerBody');
    if (!body) return;
    body.innerHTML = '<div class="pp-loading"><i class="fas fa-spinner fa-spin"></i></div>';
    var mode = ppMode();
    if (mode === 'monthly') return ppRenderMonths(body);
    if (mode === 'weekly') return ppRenderWeeks(body);
    if (mode === 'yearly') return ppRenderYears(body);
  }

  function ppYearBar(minY, maxY) {
    return '<div class="pp-yearbar">' +
      '<button type="button" class="pp-year-btn" data-pp="yPrev"' + (ppYear <= minY ? ' disabled' : '') + '><i class="fas fa-chevron-left"></i></button>' +
      '<span class="pp-year-label">' + ppYear + '</span>' +
      '<button type="button" class="pp-year-btn" data-pp="yNext"' + (ppYear >= maxY ? ' disabled' : '') + '><i class="fas fa-chevron-right"></i></button></div>';
  }
  function ppBindYearBar(body, minY, maxY) {
    var p = body.querySelector('[data-pp="yPrev"]'), n = body.querySelector('[data-pp="yNext"]');
    if (p) p.onclick = function () { if (ppYear > minY) { triggerHaptic('light'); ppYear--; ppRender(); } };
    if (n) n.onclick = function () { if (ppYear < maxY) { triggerHaptic('light'); ppYear++; ppRender(); } };
  }

  async function ppRenderMonths(body) {
    var b = await getNavDataBounds(false);
    var todayK = keyOf(new Date());
    var curY = new Date().getFullYear();
    var minY = (b.minKey !== null) ? Math.floor(b.minKey / 10000) : curY;
    var selY = activePeriodDate.getFullYear(), selM = activePeriodDate.getMonth() + 1;
    var html = ppYearBar(minY, curY) + '<div class="pp-grid">';
    for (var m = 1; m <= 12; m++) {
      var sK = ppYear * 10000 + m * 100 + 1;
      var eK = keyOf(new Date(ppYear, m, 0));
      var en = b.minKey !== null && eK >= b.minKey && sK <= b.maxKey && sK <= todayK;
      html += '<button type="button" class="pp-cell' + ((ppYear === selY && m === selM) ? ' sel' : '') + '" data-m="' + m + '"' + (en ? '' : ' disabled') + '>Tháng ' + m + '</button>';
    }
    body.innerHTML = html + '</div>';
    ppBindYearBar(body, minY, curY);
    body.querySelectorAll('.pp-cell').forEach(function (c) {
      c.onclick = function () {
        if (c.disabled) return;
        triggerHaptic('light');
        activePeriodDate = new Date(ppYear, parseInt(c.getAttribute('data-m'), 10) - 1, 1);
        closePeriodPicker();
        updateTimeNavUI();
      };
    });
  }

  function ppWeekStarts(year) {
    var out = [];
    var s = (typeof getDateFromWeekString === 'function') ? getDateFromWeekString(year + '-W01') : null;
    if (!s) return out;
    s = new Date(s.getFullYear(), s.getMonth(), s.getDate());
    out.push(s);
    var nx = new Date(s); nx.setDate(nx.getDate() + 7);
    while (nx.getFullYear() <= year && out.length < 54) { out.push(new Date(nx)); nx.setDate(nx.getDate() + 7); }
    return out;
  }

  async function ppRenderWeeks(body) {
    var b = await getNavDataBounds(false);
    var todayK = keyOf(new Date());
    var curY = new Date().getFullYear();
    var minY = (b.minKey !== null) ? Math.floor(b.minKey / 10000) : curY;
    var selStartK = keyOf(weekStartOf(activePeriodDate));
    var html = ppYearBar(minY, curY) + '<div class="pp-week-list">';
    ppWeekStarts(ppYear).forEach(function (s) {
      var e = new Date(s); e.setDate(e.getDate() + 6);
      var sK = keyOf(s), eK = keyOf(e);
      var en = b.minKey !== null && eK >= b.minKey && sK <= b.maxKey && sK <= todayK;
      var n = (typeof getWeekNumber === 'function') ? getWeekNumber(s) : 0;
      html += '<button type="button" class="pp-week-row' + (sK === selStartK ? ' sel' : '') + '" data-sk="' + sK + '"' + (en ? '' : ' disabled') + '>' +
        '<span class="pp-week-name">Tuần ' + n + '</span>' +
        '<span class="pp-week-range">' + ppDM(s) + ' – ' + ppDM(e) + '</span></button>';
    });
    body.innerHTML = html + '</div>';
    ppBindYearBar(body, minY, curY);
    body.querySelectorAll('.pp-week-row').forEach(function (r) {
      r.onclick = function () {
        if (r.disabled) return;
        triggerHaptic('light');
        var k = parseInt(r.getAttribute('data-sk'), 10);
        activePeriodDate = new Date(Math.floor(k / 10000), Math.floor(k / 100) % 100 - 1, k % 100);
        closePeriodPicker();
        updateTimeNavUI();
      };
    });
    var selEl = body.querySelector('.pp-week-row.sel');
    if (selEl) requestAnimationFrame(function () { try { selEl.scrollIntoView({ block: 'center' }); } catch (e) {} });
  }

  async function ppRenderYears(body) {
    var curY = new Date().getFullYear();
    var selY = activePeriodDate.getFullYear();
    var enabled = {}; enabled[curY] = true;
    var chainOk = true;
    var html = '<div class="pp-grid pp-grid-year">';
    for (var y = curY; y >= curY - 11; y--) {
      if (y < curY) {
        if (chainOk) { var has = await yearHasData(y); if (!has) chainOk = false; }
        enabled[y] = chainOk;
      }
      html += '<button type="button" class="pp-cell' + (y === selY ? ' sel' : '') + '" data-y="' + y + '"' + (enabled[y] ? '' : ' disabled') + '>' + y + '</button>';
    }
    body.innerHTML = html + '</div>';
    body.querySelectorAll('.pp-cell').forEach(function (c) {
      c.onclick = function () {
        if (c.disabled) return;
        triggerHaptic('light');
        var d = new Date(activePeriodDate); d.setFullYear(parseInt(c.getAttribute('data-y'), 10));
        activePeriodDate = d;
        closePeriodPicker();
        updateTimeNavUI();
      };
    });
  }

  // Overlay dùng chung: đóng cả sheet chọn kỳ khi chạm nền (như mọi modal).
  var _origCloseAllModals = window.closeAllModals;
  if (typeof _origCloseAllModals === 'function') {
    window.closeAllModals = function () {
      var r = _origCloseAllModals.apply(this, arguments);
      try { closePeriodPicker(); } catch (e) {}
      return r;
    };
  }

  document.addEventListener('DOMContentLoaded', function () {
    ppEnsureDom();
    var center = document.querySelector('#timeNavContainer .time-nav-center');
    if (center) center.addEventListener('click', function () { openPeriodPicker(); });
    var calLabel = document.getElementById('calCtrlLabel');
    if (calLabel) calLabel.addEventListener('click', function () { openPeriodPicker(); });
    var calCaret = document.getElementById('ppCaretCal');
    if (calCaret) calCaret.addEventListener('click', function () { openPeriodPicker(); });
  });

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
  /* PERSONAL ROUND 2: mở Quản lý từ khóa (view #tab3) theo đúng hành vi
     production — nav highlight rơi vào nút Cài đặt; kèm render + lên đầu
     trang như handler nav tab3 cũ của bản cá nhân. */
  window.fabKeywords = function () {
    closeFabMenu();
    if (typeof window.closeFullscreen === 'function') window.closeFullscreen('settingsPage');
    if (typeof window.loadKeywords === 'function') window.loadKeywords(false);
    if (typeof window.openTab === 'function') window.openTab('tab3');
    if (typeof window.__renderKeywordsView === 'function') window.__renderKeywordsView();
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var s = document.getElementById('navSettingsBtn');
    if (s) s.classList.add('active');
  };
  function syncNavToActiveTab() {
    document.querySelectorAll('.nav-btn').forEach(function (b) { b.classList.remove('active'); });
    var act = document.querySelector('.tab-content.active');
    if (act) {
      var b = document.querySelector('.nav-btn[data-tab="' + act.id + '"]');
      if (!b && act.id === 'tab3') b = document.getElementById('navSettingsBtn'); /* tu khoa -> cai dat */
      if (b) b.classList.add('active');
    }
  }
  window.__syncNavToActiveTab = syncNavToActiveTab;
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
    if (id === 'settingsPage') { try { syncNavToActiveTab(); } catch (e) {} }
  };

  // ------------------------------------------------------------------
  // KHỞĐ TẠO SAU KHI DOM SẴN SÀNG
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
        s.textContent = 'Quay lại';
        b.appendChild(s);
      }
    });
    enableSwipeBack('settingsPage');
    enableSwipeBack('aboutPage');

    try { syncCalendarControlBar(); } catch (e) {}
    try { refreshNavArrows(); } catch (e) {}
  });
})();
