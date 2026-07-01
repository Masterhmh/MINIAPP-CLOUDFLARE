// ============================================================================
// app-init.js — KHỞI ĐỘNG & GẮN SỰ KIỆN
// ============================================================================

document.addEventListener('DOMContentLoaded', async () => {
  applyPrivacyMode();

  document.querySelectorAll('.modal-title').forEach(title => { title.style.textTransform = 'uppercase'; });

  // ------- FAB menu helpers -------
  window.openFabMenu = function() {
    triggerHaptic('light');
    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('fabMenuModal').classList.add('show'), 10);
  };
  window.closeFabMenu = function() {
    const m = document.getElementById('fabMenuModal');
    if (m) m.classList.remove('show');
    setTimeout(() => {
      // chỉ tắt overlay khi không có modal nào khác đang mở
      const any = document.querySelectorAll('.modal-sheet.show').length > 0;
      if (!any) document.getElementById('modalOverlay').classList.remove('show');
    }, 300);
  };

  window.openSettingsModal = function() {
    triggerHaptic('light');
    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('settingsModal').classList.add('show'), 10);
  };
  window.closeSettingsModal = function() {
    document.getElementById('settingsModal').classList.remove('show');
    setTimeout(() => {
      const any = document.querySelectorAll('.modal-sheet.show').length > 0;
      if (!any) document.getElementById('modalOverlay').classList.remove('show');
    }, 300);
  };

  window.openAboutModal = function() {
    triggerHaptic('light');
    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('aboutModal').classList.add('show'), 10);
  };
  window.closeAboutModal = function() {
    document.getElementById('aboutModal').classList.remove('show');
    setTimeout(() => {
      const any = document.querySelectorAll('.modal-sheet.show').length > 0;
      if (!any) document.getElementById('modalOverlay').classList.remove('show');
    }, 300);
  };

  // FAB button
  const fabBtn = document.getElementById('fabBtn');
  if (fabBtn) fabBtn.onclick = () => openFabMenu();

  // FAB menu actions
  const incomeBtn = document.getElementById('fabIncomeBtn');
  if (incomeBtn) incomeBtn.onclick = () => { closeFabMenu(); setTimeout(() => openAddForm('Thu nhập'), 260); };
  const expenseBtn = document.getElementById('fabExpenseBtn');
  if (expenseBtn) expenseBtn.onclick = () => { closeFabMenu(); setTimeout(() => openAddForm('Chi tiêu'), 260); };
  const searchBtn = document.getElementById('fabSearchBtn');
  if (searchBtn) searchBtn.onclick = () => { closeFabMenu(); setTimeout(() => openSearchModal(), 260); };
  const settingsBtn = document.getElementById('fabSettingsBtn');
  if (settingsBtn) settingsBtn.onclick = () => { closeFabMenu(); setTimeout(() => openSettingsModal(), 260); };
  const aboutBtn = document.getElementById('fabAboutBtn');
  if (aboutBtn) aboutBtn.onclick = () => { closeFabMenu(); setTimeout(() => openAboutModal(), 260); };

  // -------- Tab nav (remove tab4/tab5) --------
  document.querySelectorAll('.nav-btn').forEach(b => {
    b.onclick = () => {
      const targetTab = b.dataset.tab;
      window.openTab(targetTab);
      if (targetTab === 'tab1') window.fetchTransactions(false);
      if (targetTab === 'tab2') updateTimeNavUI();
    };
  });

  // Swipe tabs order
  if (!window.__tabSwipeWrapped) {
    window.__tabSwipeWrapped = true;
    const TAB_ORDER = ['tab1', 'tab2', 'tab3'];
    let swipeStartX = 0, swipeStartY = 0, swipeTracking = false;
    const isAnyModalOpen = () => {
      const ov = document.getElementById('modalOverlay');
      return ov && getComputedStyle(ov).display !== 'none';
    };
    document.body.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1 || isAnyModalOpen()) { swipeTracking = false; return; }
      swipeTracking = true;
      swipeStartX = e.touches[0].clientX;
      swipeStartY = e.touches[0].clientY;
    }, { passive: true });
    document.body.addEventListener('touchend', (e) => {
      if (!swipeTracking) return;
      swipeTracking = false;
      if (isAnyModalOpen()) return;
      const dx = e.changedTouches[0].clientX - swipeStartX;
      const dy = e.changedTouches[0].clientY - swipeStartY;
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const activeTab = document.querySelector('.tab-content.active');
      if (!activeTab) return;
      const idx = TAB_ORDER.indexOf(activeTab.id);
      if (idx === -1) return;
      const targetIdx = dx < 0 ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= TAB_ORDER.length) return;
      const targetBtn = document.querySelector(`.nav-btn[data-tab="${TAB_ORDER[targetIdx]}"]`);
      if (targetBtn) { triggerHaptic('light'); targetBtn.click(); }
    }, { passive: true });
  }

  // -------- Tab1 date logic: select date from hero-date (open calendar) --------
  const dateInput = document.getElementById('transactionDate');
  if (dateInput) {
    dateInput.value = formatDateToYYYYMMDD(new Date());
    dateInput.onchange = () => { triggerHaptic('light'); window.fetchTransactions(false); };
  }
  const displayDate = document.getElementById('displayCurrentDate');
  if (displayDate) {
    displayDate.style.cursor = 'pointer';
    displayDate.onclick = (e) => {
      e.stopPropagation();
      try { document.getElementById('transactionDate').showPicker(); } catch(err) {}
    };
  }

  // prev/next day
  const prevDayBtn = document.getElementById('prevDayBtn');
  if(prevDayBtn) prevDayBtn.onclick = (e) => { e.stopPropagation(); triggerHaptic('light'); if (!dateInput.value) return; const [y, m, d] = dateInput.value.split('-'); const currDate = new Date(y, m - 1, d); currDate.setDate(currDate.getDate() - 1); dateInput.value = formatDateToYYYYMMDD(currDate); window.fetchTransactions(false); };
  const nextDayBtn = document.getElementById('nextDayBtn');
  if(nextDayBtn) nextDayBtn.onclick = (e) => { e.stopPropagation(); triggerHaptic('light'); if (!dateInput.value) return; const [y, m, d] = dateInput.value.split('-'); const currDate = new Date(y, m - 1, d); currDate.setDate(currDate.getDate() + 1); dateInput.value = formatDateToYYYYMMDD(currDate); window.fetchTransactions(false); };

  // -------- Tab2 calendar show/hide --------
  const calBtn = document.getElementById('toggleCalendarBtn');
  if (calBtn) {
    calBtn.onclick = () => {
      triggerHaptic('light');
      const box = document.getElementById('calendarStatbox');
      const isShown = box && box.style.display !== 'none';
      if (box) box.style.display = isShown ? 'none' : 'block';
      calBtn.classList.toggle('rotated', !isShown);
    };
  }

  // period controls (keep original behavior)
  document.getElementById('filterWeeklyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('weekly'); };
  document.getElementById('filterMonthlyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('monthly'); };
  document.getElementById('filterYearlyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('yearly'); };
  document.getElementById('filterCustomBtn').onclick = () => { triggerHaptic('light'); setFilterMode('custom'); };
  document.getElementById('prevPeriodBtn').onclick = () => { triggerHaptic('light'); shiftPeriod(-1); };
  document.getElementById('nextPeriodBtn').onclick = () => { triggerHaptic('light'); shiftPeriod(1); };
  document.getElementById('weekPicker').onchange = (e) => { triggerHaptic('light'); const d = getDateFromWeekString(e.target.value); if(d) { activePeriodDate = d; updateTimeNavUI(); } };
  document.getElementById('monthPicker').onchange = (e) => { triggerHaptic('light'); const val = e.target.value; if(val) { const [y, m] = val.split('-'); activePeriodDate = new Date(y, m-1, 1); updateTimeNavUI(); } };
  document.getElementById('fetchCustomDataBtn').onclick = () => { triggerHaptic('light'); const s = parseInt(document.getElementById('startMonth').value); const e = parseInt(document.getElementById('endMonth').value); if(s > e) return showToast("Tháng bắt đầu phải nhỏ hơn kết thúc", "warning"); loadCustomReport(s, e, new Date().getFullYear()); };

  function setFilterMode(mode) {
    currentFilterMode = mode;
    document.querySelectorAll('#tab2 .period-pill').forEach(p => p.classList.remove('active'));
    document.getElementById('filter' + mode.charAt(0).toUpperCase() + mode.slice(1) + 'Btn').classList.add('active');
    activePeriodDate = new Date();
    updateTimeNavUI();
  }
  function shiftPeriod(dir) {
    if (currentFilterMode === 'weekly') activePeriodDate.setDate(activePeriodDate.getDate() + (dir * 7));
    else if (currentFilterMode === 'monthly') activePeriodDate.setMonth(activePeriodDate.getMonth() + dir);
    updateTimeNavUI();
  }

  // --- Settings init ---
  if(typeof initSettings === 'function') initSettings();
  window.initCategories();

  const defTab = localStorage.getItem('settingDefaultTab') || 'tab1';
  window.openTab(defTab);
  if(defTab === 'tab1') { showLoading(true, 'tab1'); window.fetchTransactions(false); }
  else { updateTimeNavUI(); }
  window.loadKeywords(true);
});
