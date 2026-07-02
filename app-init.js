// ============================================================================
// app-init.js — KHỞI ĐỘNG & GẮN SỰ KIỆN
// ----------------------------------------------------------------------------
// Vai trò: Điểm khởi động chính của app (chạy khi DOMContentLoaded). Gắn tất
//   cả trình xử lý sự kiện cho nút điều hướng tab, lọc thời gian, tìm kiếm,
//   form Thêm/Sửa, cài đặt, backup, reset, đổi biểu đồ...; nạp danh mục và
//   mở tab mặc định.
// Phụ thuộc: TẤT CẢ các module khác phải được nạp TRƯỚC file này
//   (app-core.js, currency.js, app-reports.js, app-crud.js, app-export.js).
//   parseNumber lấy từ currency.js (bản strict, trả null khi nhập sai).
// Thứ tự nạp: CUỐI CÙNG.
//   Ghi chú: bọc fetchTransactions để hiện "—" mờ ở hero Tab 1 khi đang tải
//   (thay cho 0 ₫, tránh hiểu nhầm là không có giao dịch). Tương tự, bọc
//   loadWeeklyReport/loadMonthlyReport/loadCustomReport để hiện "—" mờ ở
//   các thẻ Tab 2 khi đang tải báo cáo.
// ============================================================================

// ---------------- INIT LẮNG NGHE SỰ KIỆN CHÍNH ----------------
document.addEventListener('DOMContentLoaded', async () => {
  // --- ÁP DỤNG TRẠNG THÁI RIÊNG TƯ (Ẩn số) ĐÃ LƯU KHI VỪ MỞ APP ---
  applyPrivacyMode(); 

  // --- BỌC fetchTransactions ĐỂ HIỂN THỊ "—" Mờ Ở HERO CARD TAB 1 KHI ĐANG TẢI ---
  if (typeof window.fetchTransactions === 'function' && !window.__tab1LoadingWrapped) {
    window.__tab1LoadingWrapped = true;
    const _origFetchTransactions = window.fetchTransactions;
    window.fetchTransactions = function() {
      const dim = '<span style="opacity:0.35;">—</span>';
      ['heroExpenseMain', 'heroIncome', 'heroBalanceSub'].forEach(function(id) { const el = document.getElementById(id); if (el) el.innerHTML = dim; });
      const comp = document.getElementById('heroExpenseCompare'); if (comp) comp.innerHTML = '';
      return _origFetchTransactions.apply(this, arguments);
    };
  }

  // --- BỌC CÁC HÀM TẢI BÁO CÁO ĐỂ HIỂN THỊ "—" Mờ Ở CÁC THẰ TAB 2 KHI ĐANG TẢI ---
  if (!window.__tab2LoadingWrapped) {
    const setTab2Dim = function() {
      const dim = '<span style="opacity:0.35;">—</span>';
      ['tab2Income', 'tab2Expense', 'tab2Balance', 'tab2IncomeCompare', 'tab2ExpenseCompare', 'tab2BalanceCompare'].forEach(function(id) { const el = document.getElementById(id); if (el) el.innerHTML = dim; });
    };
    let wrappedAny = false;
    ['loadWeeklyReport', 'loadMonthlyReport', 'loadCustomReport'].forEach(function(fn) {
      if (typeof window[fn] === 'function') {
        const orig = window[fn];
        window[fn] = function() { setTab2Dim(); return orig.apply(this, arguments); };
        wrappedAny = true;
      }
    });
    if (wrappedAny) window.__tab2LoadingWrapped = true;
  }
    
  document.querySelectorAll('.modal-title').forEach(title => { title.style.textTransform = 'uppercase'; });

  const heroCardTab1 = document.querySelector('#tab1 .hero-card');
  if(heroCardTab1) { heroCardTab1.style.cursor = 'pointer'; heroCardTab1.onclick = (e) => { if (e.target.closest('.date-nav-btn') || e.target.closest('.quick-actions') || e.target.closest('.tx-btn') || e.target.closest('.privacy-toggle-btn')) return; const dateInput = document.getElementById('transactionDate'); if (dateInput) { dateInput.value = formatDateToYYYYMMDD(new Date()); window.fetchTransactions(false); triggerHaptic('light'); showToast("Đã quay về dữ liệu ngày hôm nay", "info"); } }; }

  let startY = 0; const tab1Content = document.getElementById('tab1');
  if (tab1Content) { tab1Content.addEventListener('touchstart', e => { if (window.scrollY === 0) startY = e.touches[0].clientY; }, { passive: true }); tab1Content.addEventListener('touchend', e => { if (startY === 0) return; let endY = e.changedTouches[0].clientY; if (endY - startY > 80 && window.scrollY === 0) { triggerHaptic('medium'); showToast("Đang làm mới giao dịch...", "info"); window.fetchTransactions(true); } startY = 0; }, { passive: true }); }

  // ---------------- VUỐT TRÁI/PHẢI ĐỂ CHUYỂN NHANH GIỪA CÁC TAB ----------------
  // Tái dùng chính logic click nút nav (để vẫn tự tải dữ liệu Tab 1 / báo cáo Tab 2).
  // Bỏ qua khi: đang mở modal, hoặc cử chỉ thiên về dọc (để không đụng kéo-làm-mới).
  if (!window.__tabSwipeWrapped) {
    window.__tabSwipeWrapped = true;
    const TAB_ORDER = ['tab1', 'tab2', 'tab3', 'tab4', 'tab5'];
    let swipeStartX = 0, swipeStartY = 0, swipeTracking = false;

    const isAnyModalOpen = () => {
      const ov = document.getElementById('modalOverlay');
      if (ov && getComputedStyle(ov).display !== 'none') return true;
      const cc = document.getElementById('customConfirmOverlay');
      if (cc && cc.style.display && cc.style.display !== 'none') return true;
      const cd = document.getElementById('confirmDeleteModal');
      if (cd && cd.style.display && cd.style.display !== 'none') return true;
      return false;
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
      // Phải là cú vuốt ngang rõ rệt: đủ dài (>=70px) và ngang trội hơn dọc
      if (Math.abs(dx) < 70 || Math.abs(dx) < Math.abs(dy) * 1.8) return;
      const activeTab = document.querySelector('.tab-content.active');
      if (!activeTab) return;
      const idx = TAB_ORDER.indexOf(activeTab.id);
      if (idx === -1) return;
      // Vuốt sang trái (dx<0) -> tab kế tiếp; vuốt sang phải (dx>0) -> tab trước
      const targetIdx = dx < 0 ? idx + 1 : idx - 1;
      if (targetIdx < 0 || targetIdx >= TAB_ORDER.length) return; // không lặp vòng
      const targetBtn = document.querySelector(`.nav-btn[data-tab="${TAB_ORDER[targetIdx]}"]`);
      if (targetBtn) { triggerHaptic('light'); targetBtn.click(); }
    }, { passive: true });
  }

  document.querySelectorAll('.nav-btn').forEach(b => { b.onclick = () => { const targetTab = b.dataset.tab; window.openTab(targetTab); if (targetTab === 'tab1') window.fetchTransactions(false); if (targetTab === 'tab2') { if (tab2NeedsReload) { tab2NeedsReload = false; cachedChartData = null; } updateTimeNavUI(); } }; });
  
  const kwActionContainer = document.getElementById('keywordActionContainer');
  if(kwActionContainer) {
      const deleteBtn = document.createElement('button'); deleteBtn.id = 'deleteEditKeywordBtn'; deleteBtn.className = 'btn-danger-outline flex-1 m-0'; deleteBtn.style.display = 'none'; deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Xóa';
      deleteBtn.onclick = () => { 
          if(!currentEditKeyword) return showToast('Vui lòng chọn từ khóa cần xóa', 'warning'); 
          triggerHaptic('medium');
          const cat = document.getElementById('keywordCategory').value;
          
          showCustomConfirm(
              'Xóa từ khóa',
              `Bạn có chắc chắn muốn xóa từ khóa <strong>${escapeHTML(currentEditKeyword)}</strong> khỏi danh mục <strong>${escapeHTML(cat)}</strong> không?`,
              'Xóa',
              async () => {
                  showLoading(true, 'tab3'); 
                  try { 
                      await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: currentEditKeyword, sheetId: sheetId }) }); 
                      triggerHapticNotification('success'); 
                      showToast('Đã xóa từ khóa thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false); 
                  } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
              }
          );
      }; 
      kwActionContainer.appendChild(deleteBtn);

      const cancelBtn = document.createElement('button'); cancelBtn.id = 'cancelKeywordBtn'; cancelBtn.className = 'btn-cancel flex-1 m-0'; cancelBtn.style.display = 'none'; cancelBtn.innerHTML = '<i class="fas fa-times"></i> Hủy';
      cancelBtn.onclick = window.cancelEditKeyword; kwActionContainer.appendChild(cancelBtn);
  }

  const tDate = document.getElementById('transactionDate'); if(tDate) { tDate.value = formatDateToYYYYMMDD(new Date()); tDate.onchange = () => { triggerHaptic('light'); window.fetchTransactions(false); }; }
  const prevDayBtn = document.getElementById('prevDayBtn'); if(prevDayBtn) { prevDayBtn.onclick = (e) => { e.stopPropagation(); triggerHaptic('light'); const dateInput = document.getElementById('transactionDate'); if (!dateInput.value) return; const [y, m, d] = dateInput.value.split('-'); const currDate = new Date(y, m - 1, d); currDate.setDate(currDate.getDate() - 1); dateInput.value = formatDateToYYYYMMDD(currDate); window.fetchTransactions(false); }; }
  const nextDayBtn = document.getElementById('nextDayBtn'); if(nextDayBtn) { nextDayBtn.onclick = (e) => { e.stopPropagation(); triggerHaptic('light'); const dateInput = document.getElementById('transactionDate'); if (!dateInput.value) return; const [y, m, d] = dateInput.value.split('-'); const currDate = new Date(y, m - 1, d); currDate.setDate(currDate.getDate() + 1); dateInput.value = formatDateToYYYYMMDD(currDate); window.fetchTransactions(false); }; }

  document.getElementById('filterWeeklyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('weekly'); };
  document.getElementById('filterMonthlyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('monthly'); };
  document.getElementById('filterYearlyBtn').onclick = () => { triggerHaptic('light'); setFilterMode('yearly'); };
  document.getElementById('filterCustomBtn').onclick = () => { triggerHaptic('light'); setFilterMode('custom'); };
  document.getElementById('prevPeriodBtn').onclick = () => { triggerHaptic('light'); shiftPeriod(-1); };
  document.getElementById('nextPeriodBtn').onclick = () => { triggerHaptic('light'); shiftPeriod(1); };
  document.getElementById('weekPicker').onchange = (e) => { triggerHaptic('light'); const d = getDateFromWeekString(e.target.value); if(d) { activePeriodDate = d; updateTimeNavUI(); } };
  document.getElementById('monthPicker').onchange = (e) => { triggerHaptic('light'); const val = e.target.value; if(val) { const [y, m] = val.split('-'); activePeriodDate = new Date(y, m-1, 1); updateTimeNavUI(); } };
  document.getElementById('fetchCustomDataBtn').onclick = () => { triggerHaptic('light'); const s = parseInt(document.getElementById('startMonth').value); const e = parseInt(document.getElementById('endMonth').value); if(s > e) return showToast("Tháng bắt đầu phải nhỏ hơn kết thúc", "warning"); loadCustomReport(s, e, new Date().getFullYear()); };
  
  function setFilterMode(mode) { currentFilterMode = mode; document.querySelectorAll('#tab2 .period-pill').forEach(p => p.classList.remove('active')); document.getElementById('filter' + mode.charAt(0).toUpperCase() + mode.slice(1) + 'Btn').classList.add('active'); activePeriodDate = new Date(); updateTimeNavUI(); }
  function shiftPeriod(dir) { if (currentFilterMode === 'weekly') activePeriodDate.setDate(activePeriodDate.getDate() + (dir * 7)); else if (currentFilterMode === 'monthly') activePeriodDate.setMonth(activePeriodDate.getMonth() + dir); updateTimeNavUI(); }
  
  document.getElementById('searchTransactionsBtn').onclick = async () => {
    triggerHaptic('light');
    // Tìm kiếm TOÀN BỘ (mọi tháng): nội dung + ghi chú (nhiều từ, AND), danh mục, loại, khoảng tiền.
    const c = document.getElementById('searchContent').value.toLowerCase().trim();
    const cat = document.getElementById('searchCategory').value;
    const typeEl = document.getElementById('searchType');
    const type = typeEl ? typeEl.value : '';
    const minEl = document.getElementById('searchAmountMin');
    const maxEl = document.getElementById('searchAmountMax');
    const minRaw = minEl ? minEl.value.trim() : '';
    const maxRaw = maxEl ? maxEl.value.trim() : '';
    // Hỗ trợ nhập rút gọn: 50k, 1tr5, 2m, 3ty, 1b... (dùng parseNumber của currency.js)
    const minAmount = minRaw ? window.parseNumber(minRaw) : null;
    const maxAmount = maxRaw ? window.parseNumber(maxRaw) : null;
    if(!c && !cat && !type && minAmount === null && maxAmount === null) return showToast("Nhập ít nhất 1 điều kiện tìm kiếm", "warning");

    showLoading(true, 'tab3');
    try {
      let txs = []; let fetchPromises = [];
      for (let m = 1; m <= 12; m++) { fetchPromises.push((async () => { return await fetchMonthData(m); })()); }
      const monthsResults = await Promise.all(fetchPromises);
      // Tách từ khóa theo khoảng trắng: TẤT CẢ từ phải xuất hiện (trong nội dung HOẶC ghi chú)
      const terms = c ? c.split(/\s+/).filter(Boolean) : [];
      monthsResults.forEach(monthData => { monthData.forEach(t => {
        let matches = true;
        const content = (t.content || '').toLowerCase();
        const note = (t.note || '').toLowerCase();
        if (terms.length && !terms.every(term => content.indexOf(term) !== -1 || note.indexOf(term) !== -1)) matches = false;
        if (cat && t.category !== cat) matches = false;
        if (type && t.type !== type) matches = false;
        const amt = Math.abs(Number(t.amount) || 0);
        if (minAmount !== null && amt < minAmount) matches = false;
        if (maxAmount !== null && amt > maxAmount) matches = false;
        if (matches) txs.push(t);
      }); });
      txs.sort((a,b) => b.id.localeCompare(a.id)); cachedSearchResults = txs; currentPageSearch = 1; displaySearchResults();
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
  };
  
  document.getElementById('fetchKeywordsBtn').onclick = () => { triggerHaptic('light'); window.loadKeywords(false); };
  document.getElementById('addKeywordBtn').onclick = async () => {
        triggerHaptic('light');
        const cat = document.getElementById('keywordCategory').value, kw = document.getElementById('keywordInput').value;
        if(!cat || !kw) return showToast('Vui lòng nhập đủ thông tin', 'warning');
        showLoading(true, 'tab3');
        try {
            if (currentEditKeyword) await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: currentEditKeyword, sheetId: sheetId }) });
            await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'addKeyword', category: cat, keywords: kw, sheetId: sheetId }) });
            triggerHapticNotification('success');
            showToast(currentEditKeyword ? 'Cập nhật từ khóa thành công!' : 'Thêm từ khóa mới thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);
        } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
  };

['addAmount','editAmount','searchAmountMin','searchAmountMax'].forEach(id => { 
    const el = document.getElementById(id); 
    if(el) el.oninput = function() { 
        if (/[a-zA-Z]/.test(this.value)) return; // có chữ (k/m/tr) -> để người dùng gõ tiếp
        this.value = formatNumberWithCommas(this.value); 
    }; 
});  
  document.getElementById('addForm').onsubmit = async function(e) {
  e.preventDefault();
  const [y,m,d] = document.getElementById('addDate').value.split('-');
  const tx = { content: document.getElementById('addContent').value, amount: parseNumber(document.getElementById('addAmount').value), type: document.getElementById('addType').value, category: document.getElementById('addCategory').value, note: document.getElementById('addNote').value, date: `${d}/${m}/${y}`, action: 'addTransaction', sheetId };
  const ok = await submitTx(tx);
  if (ok) closeAddForm();   // chỉ đóng form khi đã lưu thành công
};
document.getElementById('editForm').onsubmit = async function(e) {
  e.preventDefault();
  const [y,m,d] = document.getElementById('editDate').value.split('-');
  const tx = { id: document.getElementById('editTransactionId').value, content: document.getElementById('editContent').value, amount: parseNumber(document.getElementById('editAmount').value), type: document.getElementById('editType').value, category: document.getElementById('editCategory').value, note: document.getElementById('editNote').value, date: `${d}/${m}/${y}`, month: m, action: 'updateTransaction', sheetId };
  const ok = await submitTx(tx);
  if (ok) closeEditForm();   // chỉ đóng form khi đã lưu thành công
};

  window.initCategories = async function(preserveValues = false) {
    try {
      const cats = await fetchCategories();
      const sCat = document.getElementById('searchCategory'), kCat = document.getElementById('keywordCategory'), addCat = document.getElementById('addCategory'), editCat = document.getElementById('editCategory');
      const sVal = sCat?.value, kVal = kCat?.value, addVal = addCat?.value, editVal = editCat?.value;

      if(sCat) { sCat.innerHTML = '<option value="">Tất cả danh mục</option>'; cats.forEach(c => sCat.appendChild(new Option(c, c))); if(preserveValues && sVal) sCat.value = sVal; }
      if(kCat) { kCat.innerHTML = '<option value="">Chọn phân loại</option>'; cats.forEach(c => kCat.appendChild(new Option(c, c))); if(preserveValues && kVal) { kCat.value = kVal; } else if (preserveValues && document.getElementById('iconPickerCategory').value) { const newVal = document.getElementById('iconPickerCategory').value.trim(); if (cats.includes(newVal)) kCat.value = newVal; } }
      if(addCat) { addCat.innerHTML = ''; cats.forEach(c => addCat.appendChild(new Option(c, c))); if(preserveValues && addVal) addCat.value = addVal; }
      if(editCat) { editCat.innerHTML = ''; cats.forEach(c => editCat.appendChild(new Option(c, c))); if(preserveValues && editVal) editCat.value = editVal; }
      
      if (kCat && !document.getElementById('openIconPickerBtn')) {
          const btn = document.createElement('button'); 
          btn.id = 'openIconPickerBtn'; 
          btn.type = 'button'; 
          btn.innerHTML = '<i class="fas fa-cog"></i>'; 
          btn.className = 'btn-icon-picker';
          btn.onclick = window.openIconPickerModal;
          
          const parent = kCat.parentElement; 
          const wrapper = document.createElement('div'); 
          wrapper.className = 'input-with-btn-wrapper';
          
          parent.insertBefore(wrapper, kCat); 
          wrapper.appendChild(kCat); 
          wrapper.appendChild(btn); 
          kCat.classList.add('flex-1');
      }
    } catch(e) {}
  }
  
  // Khởi động Settings
  document.getElementById('settingPrivacyMode').onchange = (e) => { 
      triggerHaptic('light'); 
      localStorage.setItem('settingPrivacyMode', e.target.checked); 
      isPrivacyActive = e.target.checked; 
      updatePrivacyUI(true); 
  };

  document.getElementById('settingTheme').onchange = (e) => { triggerHaptic('light'); const v = e.target.value; localStorage.setItem('settingTheme', v); setBodyTheme(v); };
  document.getElementById('settingDefaultTab').onchange = (e) => { triggerHaptic('light'); localStorage.setItem('settingDefaultTab', e.target.value); };
  document.getElementById('settingStartOfWeek').onchange = (e) => { triggerHaptic('light'); localStorage.setItem('settingStartOfWeek', e.target.value); if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); };
  
  // Thay đổi cài đặt Rút gọn tiền thì Render lại ngay biểu đồ để tránh lỗi
  document.getElementById('settingCurrencyFormat').onchange = (e) => { 
      triggerHaptic('light'); 
      localStorage.setItem('settingCurrencyFormat', e.target.value); 
      window.fetchTransactions(true); 
      if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); 
  };
  
  document.getElementById('settingHaptic').onchange = (e) => { localStorage.setItem('settingHaptic', e.target.checked); if(e.target.checked) triggerHaptic('light'); };
  document.getElementById('settingChatId').onchange = (e) => localStorage.setItem('settingChatId', e.target.value.trim());

  // Button Backup & Hard Reset
  document.getElementById('backupTelegramBtn').onclick = async () => {
      const chatId = document.getElementById('settingChatId').value.trim();
      if(!chatId) return showToast('Vui lòng nhập Chat ID!', 'warning');
      triggerHaptic('light'); showToast('Đang gửi yêu cầu backup...', 'info');
      try { await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'backupTelegram', chatId: chatId, sheetId: sheetId }) }); showToast('Đã gửi yêu cầu backup qua Telegram!', 'success'); } catch(e) { showToast('Lỗi gửi backup: ' + e.message, 'error'); }
  };
  document.getElementById('hardResetBtn').onclick = () => {
      triggerHaptic('medium');
      showCustomConfirm('Khôi Phục Cài Đặt Gốc', 'Toàn bộ dữ liệu giao dịch, từ khoá và cài đặt của bạn trên Firebase sẽ bị <strong>XÓA VĨNH VIỄN</strong>. Bạn có chắc chắn không?', 'XÓA TẤT CẢ', async () => {
          showLoading(true, 'tab4');
          try {
              await Promise.all([
    fetch(`${FIREBASE_URL}/transactions.json`, { method: 'DELETE' }),
    fetch(`${FIREBASE_URL}/categories.json`, { method: 'DELETE' }),
    fetch(`${FIREBASE_URL}/meta.json`, { method: 'DELETE' }) // xóa cả bộ đếm mã GD
]);
localStorage.clear(); showToast('Đã xoá sạch dữ liệu!', 'success'); setTimeout(() => window.location.reload(), 1500);
          } catch(e) { showToast('Lỗi: ' + e.message, 'error'); } finally { showLoading(false, 'tab4'); }
      });
  };

  // Nút đổi biểu đồ tab 2
  const toggleChartBtn = document.getElementById('toggleChartBtn');
  if(toggleChartBtn) {
      toggleChartBtn.onclick = () => {
          triggerHaptic('light');
          window.currentChartType = window.currentChartType === 'bar' ? 'line' : 'bar';
          document.getElementById('toggleChartBtn').innerHTML = window.currentChartType === 'bar' ? '<i class="fas fa-chart-line"></i>' : '<i class="fas fa-chart-bar"></i>';
          const isTab2 = document.getElementById('tab2').classList.contains('active');
          if (isTab2 && window.mChart) {
              window.mChart.config.type = window.currentChartType;
              if (window.currentChartType === 'line') {
                  window.mChart.data.datasets[0].tension = 0.4; window.mChart.data.datasets[0].fill = true; window.mChart.data.datasets[0].borderWidth = 2; window.mChart.data.datasets[0].pointRadius = 4;
                  window.mChart.data.datasets[1].tension = 0.4; window.mChart.data.datasets[1].fill = true; window.mChart.data.datasets[1].borderWidth = 2; window.mChart.data.datasets[1].pointRadius = 4;
              } else {
                  window.mChart.data.datasets[0].fill = false; window.mChart.data.datasets[0].borderWidth = 0; window.mChart.data.datasets[0].borderRadius = 4;
                  window.mChart.data.datasets[1].fill = false; window.mChart.data.datasets[1].borderWidth = 0; window.mChart.data.datasets[1].borderRadius = 4;
              }
              window.mChart.update();
          }
      };
  }

  // --- Nếu đã có hàm initSettings thì gọi, không có thì bỏ qua ---
  if(typeof initSettings === 'function') initSettings(); 
  
  window.initCategories();
  const defTab = localStorage.getItem('settingDefaultTab') || 'tab1';
  window.openTab(defTab); 
  if(defTab === 'tab1') { showLoading(true, 'tab1'); window.fetchTransactions(false); } else { updateTimeNavUI(); }
  window.loadKeywords(true);

  // ---------------- ĐĂNG KÝ SERVICE WORKER (PWA / OFFLINE) ----------------
  // Cho phép cài đặt như app và mở lại khi mất mạng (khung giao diện được cache).
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(err => console.log('Đăng ký Service Worker thất bại:', err));
    });
  }
});
