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

// ---------------- TIỆN ÍCH TỪ KHÓA: GHI THẲNG FIREBASE (NHANH) + ĐỒNG BỘ SHEET Ở NỀN ----------------
// Chuẩn hóa danh sách từ khóa GIỐNG HỆT GAS (trim -> lowercase -> bỏ rỗng ->
// bỏ trùng -> sắp xếp theo tiếng Việt -> nối bằng ", ") để khi GAS đồng bộ
// ngược từ Google Sheet về Firebase thì giá trị trùng khớp, không bị "nhảy".
window.normalizeKeywordList = function(arr) {
  return (arr || [])
    .map(k => String(k).trim().toLowerCase())
    .filter(k => k)
    .filter((k, i, a) => a.indexOf(k) === i)
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .join(', ');
};

// Đọc danh sách từ khóa hiện tại của 1 danh mục trực tiếp từ Firebase -> mảng
async function fetchCategoryKeywords(cat) {
  const res = await fetch(`${FIREBASE_URL}/categories/${encodeURIComponent(cat)}/keywords.json`);
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);
  const raw = await res.json();
  return String(raw || '').split(',').map(k => k.trim()).filter(k => k);
}

// Ghi thẳng chuỗi từ khóa (đã chuẩn hóa) vào Firebase cho 1 danh mục
async function putCategoryKeywords(cat, listStr) {
  const res = await fetch(`${FIREBASE_URL}/categories/${encodeURIComponent(cat)}/keywords.json`, { method: 'PUT', body: JSON.stringify(listStr) });
  if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);
}

// ---------------- INIT LẮNG NGHE SỰ KIỆN CHÍNH ----------------
document.addEventListener('DOMContentLoaded', async () => {
  // --- ÁP DỤNG TRẠNG THÁI RIÊNG TƯ (Ẩn số) ĐÃ LƯU KHI VỪA MỞ APP ---
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

  // --- BỌC CÁC HÀM TẢI BÁO CÁO ĐỂ HIỂN THỊ "—" Mờ Ở CÁC THẺ TAB 2 KHI ĐANG TẢI ---
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

  // ---------------- VUỐT TRÁI/PHẢI ĐỂ CHUYỂN NHANH GIỮA CÁC TAB ----------------
  // Tái dùng chính logic click nút nav (để vẫn tự tải dữ liệu Tab 1 / báo cáo Tab 2).
  // Bỏ qua khi: đang mở modal, hoặc cử chỉ thiên về dọc (để không đụng kéo-làm-mới).
  if (!window.__tabSwipeWrapped) {
    window.__tabSwipeWrapped = true;
    const TAB_ORDER = ['tab1', 'tab2', 'tab3'];
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
          const target = currentEditKeyword; // giữ lại vì cancelEditKeyword() sẽ reset biến
          
          showCustomConfirm(
              'Xóa từ khóa',
              `Bạn có chắc chắn muốn xóa từ khóa <strong>${escapeHTML(target)}</strong> khỏi danh mục <strong>${escapeHTML(cat)}</strong> không?`,
              'Xóa',
              async () => {
                  showLoading(true, 'tab3'); 
                  try { 
                      // Ghi thẳng Firebase: đọc danh sách -> bỏ từ khóa -> chuẩn hóa -> PUT
                      const current = await fetchCategoryKeywords(cat);
                      const t = String(target).trim().toLowerCase();
                      const normalized = window.normalizeKeywordList(current.filter(k => k.toLowerCase() !== t));
                      await putCategoryKeywords(cat, normalized);

                      // Cập nhật giao diện ngay, không chờ Google Sheet
                      triggerHapticNotification('success'); 
                      showToast('Đã xóa từ khóa thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false); 

                      // Đồng bộ Google Sheet ở NỀN (giữ nguyên GAS cũ) — không chặn UI
                      fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: target, sheetId: sheetId }) })
                          .catch(err => console.log('Lỗi đồng bộ Sheet (nền):', err));
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
  
  // ---------------- TÌM KIẾM: 1 Ô NHẬP DUY NHẤT ----------------
  // Người dùng gõ MỘT trong hai:
  //   - Số tiền: đầy đủ (2000000) hoặc rút gọn (50k, 1tr5, 2m, 3ty...) -> tìm giao
  //     dịch có số tiền đúng bằng giá trị đó (trị tuyệt đối).
  //   - Nội dung/ghi chú: nhiều từ cách nhau bằng dấu cách (TẤT CẢ từ phải xuất hiện).
  // Phân biệt: nếu chuỗi KHÔNG chứa khoảng trắng VÀ parse ra số > 0 => coi là số tiền.
  document.getElementById('searchTransactionsBtn').onclick = async () => {
    triggerHaptic('light');
    const raw = document.getElementById('searchQuery').value.trim();
    if(!raw) return showToast("Nhập nội dung hoặc số tiền để tìm", "warning");

    let amount = null;
    if (!/\s/.test(raw)) { const n = window.parseNumber(raw); if (n && n > 0) amount = n; }

    showLoading(true, 'tab3');
    try {
      let txs = []; let fetchPromises = [];
      for (let m = 1; m <= 12; m++) { fetchPromises.push((async () => { return await fetchMonthData(m); })()); }
      const monthsResults = await Promise.all(fetchPromises);
      if (amount !== null) {
        // Tìm theo SỐ TIỀN: khớp đúng giá trị tuyệt đối
        monthsResults.forEach(monthData => { monthData.forEach(t => {
          if (Math.abs(Number(t.amount) || 0) === amount) txs.push(t);
        }); });
      } else {
        // Tìm theo NỘI DUNG / GHI CHÚ: tách theo khoảng trắng, TẤT CẢ từ phải xuất hiện
        const terms = raw.toLowerCase().split(/\s+/).filter(Boolean);
        monthsResults.forEach(monthData => { monthData.forEach(t => {
          const content = (t.content || '').toLowerCase();
          const note = (t.note || '').toLowerCase();
          if (terms.every(term => content.indexOf(term) !== -1 || note.indexOf(term) !== -1)) txs.push(t);
        }); });
      }
      txs.sort((a,b) => b.id.localeCompare(a.id)); cachedSearchResults = txs; currentPageSearch = 1; displaySearchResults();
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
  };
  
  document.getElementById('fetchKeywordsBtn').onclick = () => { triggerHaptic('light'); window.loadKeywords(false); };
  document.getElementById('addKeywordBtn').onclick = async () => {
        triggerHaptic('light');
        const cat = document.getElementById('keywordCategory').value, kw = document.getElementById('keywordInput').value;
        if(!cat || !kw) return showToast('Vui lòng nhập đủ thông tin', 'warning');
        const editingFrom = currentEditKeyword; // giữ lại từ khóa đang sửa (nếu có)
        showLoading(true, 'tab3');
        try {
            // 1) Đọc danh sách từ khóa hiện tại của danh mục trực tiếp từ Firebase
            let list = await fetchCategoryKeywords(cat);
            // 2) Nếu đang SỬA: bỏ từ khóa cũ trước khi thêm bản mới
            if (editingFrom) { const t = String(editingFrom).trim().toLowerCase(); list = list.filter(k => k.toLowerCase() !== t); }
            // 3) Thêm (các) từ khóa mới — hỗ trợ nhập nhiều, ngăn cách bằng dấu phẩy
            String(kw).split(',').forEach(k => list.push(k));
            // 4) Chuẩn hóa GIỐNG GAS rồi GHI THẲNG Firebase
            const normalized = window.normalizeKeywordList(list);
            await putCategoryKeywords(cat, normalized);

            // 5) Cập nhật giao diện NGAY (không chờ Google Sheet)
            triggerHapticNotification('success');
            showToast(editingFrom ? 'Cập nhật từ khóa thành công!' : 'Thêm từ khóa mới thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);

            // 6) Đồng bộ Google Sheet ở NỀN (giữ nguyên GAS cũ) — không chặn UI
            if (editingFrom) {
                fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: editingFrom, sheetId: sheetId }) })
                    .then(() => fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'addKeyword', category: cat, keywords: kw, sheetId: sheetId }) }))
                    .catch(err => console.log('Lỗi đồng bộ Sheet (nền):', err));
            } else {
                fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'addKeyword', category: cat, keywords: kw, sheetId: sheetId }) })
                    .catch(err => console.log('Lỗi đồng bộ Sheet (nền):', err));
            }
        } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
  };

['addAmount','editAmount'].forEach(id => { 
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
      const kCat = document.getElementById('keywordCategory'), addCat = document.getElementById('addCategory'), editCat = document.getElementById('editCategory');
      const kVal = kCat?.value, addVal = addCat?.value, editVal = editCat?.value;

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
          showLoading(true, 'tab3');
          try {
              await Promise.all([
    fetch(`${FIREBASE_URL}/transactions.json`, { method: 'DELETE' }),
    fetch(`${FIREBASE_URL}/categories.json`, { method: 'DELETE' }),
    fetch(`${FIREBASE_URL}/meta.json`, { method: 'DELETE' }) // xóa cả bộ đếm mã GD
]);
localStorage.clear(); showToast('Đã xoá sạch dữ liệu!', 'success'); setTimeout(() => window.location.reload(), 1500);
          } catch(e) { showToast('Lỗi: ' + e.message, 'error'); } finally { showLoading(false, 'tab3'); }
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
