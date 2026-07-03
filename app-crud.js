// ============================================================================
// app-crud.js — TỪ KHÓA, DANH MỤC, CRUD GIAO DỊCH & ICON PICKER
// ----------------------------------------------------------------------------
// Vai trò: Tab 3 (quản lý từ khóa: tải, hiển thị, sửa/hủy), nạp danh mục,
//   thêm/sửa/xóa giao dịch (modal Add/Edit), sinh mã giao dịch, ghi/đọc
//   Firebase + đồng bộ Google Sheet (GAS), và cửa sổ ICON PICKER (cấu hình
//   danh mục + icon + từ khóa).
// Phụ thuộc: app-core.js (tiện ích, fetchMonthData, FIREBASE_URL...) và
//   currency.js (formatNumberWithCommas dùng ở app-core). Tương tác với
//   displayTransactions/updateTimeNavUI/displaySearchResults (app-reports.js).
// Thứ tự nạp: sau app-reports.js.
// ============================================================================

// ---------------- TAB TỪ KHÓA ----------------
window.loadKeywords = async function(isInit = false) {
    if(!isInit) showLoading(true, 'tab3');
    if(!isInit) document.getElementById('keywordsContainer').innerHTML = '';
    try {
        // Đọc 1 node /categories duy nhất (object keyed theo tên danh mục)
        const res = await fetch(`${FIREBASE_URL}/categories.json`); let raw = await res.json();
        if(!raw) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getKeywords&sheetId=${sheetId}`)); raw = await gasRes.json(); }

        // Chuẩn hóa -> mảng [{category, icon, keywords}] (hỗ trợ cả cấu trúc cũ là mảng)
        let data = [];
        if (Array.isArray(raw)) {
            data = raw.filter(item => item !== null);
        } else if (raw && typeof raw === 'object') {
            data = Object.entries(raw).map(([category, v]) => ({
                category,
                icon: (v && v.icon) || '❗',
                keywords: (v && v.keywords) || ''
            }));
        }

        cachedKeywords = data || [];
        // Dựng đồng thời 2 map icon từ cùng 1 nguồn -> không còn lệch icon
        window.categoryIconMap = {};
        window.customCategoryIcons = {};
        cachedKeywords.forEach(kw => {
            if (kw && kw.category && kw.icon) {
                window.categoryIconMap[kw.category.trim()] = kw.icon.trim();
                window.customCategoryIcons[kw.category.trim()] = kw.icon.trim();
            }
        });
        if(!isInit) displayKeywords();
    } catch(e) { if(!isInit) showToast(e.message, 'error'); } finally { if(!isInit) showLoading(false, 'tab3'); }
};

window.startEditKeyword = function(kw, category) { 
    triggerHaptic('light'); document.getElementById('keywordInput').value = kw; document.getElementById('keywordCategory').value = category; currentEditKeyword = kw; 
    const btnAdd = document.getElementById('addKeywordBtn'); btnAdd.innerHTML = '<i class="fas fa-save"></i> Lưu sửa'; btnAdd.classList.add('btn-edit-kw'); 
    document.getElementById('cancelKeywordBtn').style.display = 'flex'; document.getElementById('deleteEditKeywordBtn').style.display = 'flex'; document.getElementById('fetchKeywordsBtn').style.display = 'none';
};

window.cancelEditKeyword = function() { 
    triggerHaptic('light'); document.getElementById('keywordInput').value = ''; currentEditKeyword = null; 
    const btnAdd = document.getElementById('addKeywordBtn'); btnAdd.innerHTML = '<i class="fas fa-plus"></i> Thêm'; btnAdd.classList.remove('btn-edit-kw'); 
    document.getElementById('cancelKeywordBtn').style.display = 'none'; document.getElementById('deleteEditKeywordBtn').style.display = 'none'; document.getElementById('fetchKeywordsBtn').style.display = 'flex';
};

function displayKeywords() {
   const container = document.getElementById('keywordsContainer'); container.innerHTML = '';
   if(!cachedKeywords || cachedKeywords.length === 0) { document.getElementById('placeholderTab3').style.display = 'block'; return; }
   document.getElementById('placeholderTab3').style.display = 'none';
   const groupedKeywords = {}; cachedKeywords.forEach(item => { const category = item.category || 'Khác'; if (!groupedKeywords[category]) groupedKeywords[category] = { keywords: [] }; if (item.keywords && typeof item.keywords === 'string') { const kwsArray = item.keywords.split(',').map(k => k.trim()).filter(k => k !== ''); kwsArray.forEach(kw => { if (!groupedKeywords[category].keywords.includes(kw)) groupedKeywords[category].keywords.push(kw); }); } });
   
   Object.keys(groupedKeywords).sort((a,b) => { if (a.toLowerCase() === 'khác') return 1; if (b.toLowerCase() === 'khác') return -1; return a.localeCompare(b, 'vi'); }).forEach(category => { 
       const group = groupedKeywords[category]; let tagsHTML = ''; 
       // Chống XSS: KHÔNG nhúng tên từ khóa vào onclick nữa; lưu vào data-* rồi gắn sự kiện sau.
       group.keywords.sort((a,b) => a.localeCompare(b, 'vi')).forEach(kw => { tagsHTML += `<span class="keyword-tag" data-kw="${escapeHTML(kw)}" data-cat="${escapeHTML(category)}">${escapeHTML(kw)}</span>`; }); 
       const div = document.createElement('div'); div.className = 'tx-card keyword-group-card'; 
       div.innerHTML = `<div class="accordion-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'flex':'none'; this.querySelector('.chevron').style.transform = this.nextElementSibling.style.display==='none'?'rotate(0deg)':'rotate(180deg)';"><div class="flex-row-gap-10" style="align-items:center;"><div class="tx-icon-wrap expense">${getCategoryIcon(category)}</div><div class="tx-body"><div class="tx-title">${escapeHTML(category)}</div><div class="tx-id-row">${group.keywords.length} từ khóa</div></div></div><i class="fas fa-chevron-down chevron" style="color: var(--text-3); transition: 0.3s;"></i></div><div class="accordion-body" style="display:none;">${tagsHTML || '<span class="tx-note">Chưa có từ khóa</span>'}</div>`; 
       container.appendChild(div); 
       // Gắn sự kiện click cho từng thẻ từ khóa (đọc lại giá trị gốc từ dataset)
       div.querySelectorAll('.keyword-tag').forEach(tag => { tag.addEventListener('click', () => startEditKeyword(tag.dataset.kw, tag.dataset.cat)); });
   });
}

// ---------------- MODALS & CRUD ----------------
async function fetchCategories() { 
    try { 
        const res = await fetch(`${FIREBASE_URL}/categories.json`); let raw = await res.json(); 
        if(!raw) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getCategories&sheetId=${sheetId}`)); raw = await gasRes.json(); } 
        let cats = [];
        if (Array.isArray(raw)) {
            cats = raw.filter(c => c);            // tương thích ngược: mảng tên
        } else if (raw && typeof raw === 'object') {
            cats = Object.keys(raw);              // cấu trúc mới: lấy tên danh mục
        }
        cats.sort((a, b) => { if (a.toLowerCase() === 'khác') return 1; if (b.toLowerCase() === 'khác') return -1; return a.localeCompare(b, 'vi'); });
        return cats; 
    } catch(e) { return []; } 
}

window.selectType = function(formId, type, el) { triggerHaptic('light'); document.getElementById(formId + 'Type').value = type; const pills = el.parentElement.querySelectorAll('.type-pill'); pills.forEach(p => p.classList.remove('income-active', 'expense-active')); if(type === 'Chi tiêu') el.classList.add('expense-active'); else el.classList.add('income-active'); };
window.openAddForm = async function() { triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('addModal').classList.add('show'), 10); document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập'; else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu'; }); document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date()); document.getElementById('addContent').value = ''; document.getElementById('addAmount').value = ''; document.getElementById('addNote').value = ''; document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Chi tiêu')) p.click(); }); const catSel = document.getElementById('addCategory'); catSel.innerHTML = ''; const cats = await fetchCategories(); cats.forEach(c => catSel.appendChild(new Option(c, c))); };
window.closeAddForm = function() { document.getElementById('addModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.openEditForm = async function(tx) { if(!tx) return; triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('editModal').classList.add('show'), 10); const pills = document.querySelectorAll('#editModal .type-pill'); pills.forEach(p => { if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập'; else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu'; }); document.getElementById('editTransactionId').value = tx.id; document.getElementById('editContent').value = tx.content; document.getElementById('editAmount').value = formatNumberWithCommas(tx.amount.toString()); document.getElementById('editNote').value = tx.note || ''; const [d,m,y] = tx.date.split('/'); document.getElementById('editDate').value = `${y}-${m}-${d}`; pills.forEach(p => { if(tx.type === 'Thu nhập' && p.textContent.includes('Thu nhập')) p.click(); if(tx.type === 'Chi tiêu' && p.textContent.includes('Chi tiêu')) p.click(); }); const catSel = document.getElementById('editCategory'); catSel.innerHTML = ''; const cats = await fetchCategories(); cats.forEach(c => { const opt = new Option(c, c); if(c === tx.category) opt.selected = true; catSel.appendChild(opt); }); };
window.closeEditForm = function() { document.getElementById('editModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.closeAllModals = function() { closeAddForm(); closeEditForm(); closeSearchModal(); closeDetailModal(); if (document.getElementById('iconPickerModal')) document.getElementById('iconPickerModal').classList.remove('show'); if (document.getElementById('pdfPreviewModal')) document.getElementById('pdfPreviewModal').classList.remove('show'); };

// Sinh mã GD THAM CHIẾU THEO ĐÚNG THÁNG + NĂM của giao dịch: đọc đúng nhánh
// /transactions/{năm}/month_{tháng} trên Firebase, lấy mã GD lớn nhất ĐANG CÓ rồi +1.
// Nhờ nhánh tách theo năm nên sang năm mới mã tự khởi động lại từ GD001.
// Đọc trực tiếp dữ liệu nhánh năm/tháng (gồm cả mã do Bot tạo) nên không cấp trùng -> không ghi đè.
async function getNextTransactionId(month, year) {
    let maxInMonth = 0;
    const consider = (id, dateStr) => {
        if (!String(id).startsWith('GD') || String(id).includes('_')) return;
        if (year != null && dateStr) {
            const p = String(dateStr).split('/');
            if (p.length === 3 && parseInt(p[2], 10) !== parseInt(year, 10)) return; // chỉ tính giao dịch cùng năm
        }
        const n = parseInt(String(id).replace('GD', ''), 10);
        if (!isNaN(n) && n > maxInMonth) maxInMonth = n;
    };
    // Đọc đúng nhánh năm/tháng đó trên Firebase
    try {
        const res = await fetch(`${FIREBASE_URL}/transactions/${year}/month_${month}.json`);
        const data = await res.json();
        if (data && typeof data === 'object') Object.keys(data).forEach(id => { const t = data[id]; consider(id, t && t.date); });
    } catch (e) { /* lỗi mạng -> dùng cache bên dưới làm dự phòng */ }

    // Dự phòng: quét dữ liệu đang load trên máy nhưng CHỈ tính các giao dịch cùng tháng (và cùng năm)
    [...(cachedTransactions?.data || []), ...(cachedChartData?.txs || []), ...(cachedSearchResults || [])].forEach(item => {
        if (!item || !item.id || !item.date) return;
        const m = parseInt(String(item.date).split('/')[1], 10);
        if (m !== month) return;
        consider(item.id, item.date);
    });

    const nextNum = maxInMonth + 1;
    return "GD" + String(nextNum).padStart(3, '0');
}

// Gửi POST sang Google Sheet (GAS) CÓ KIỂM TRA + THỬ LẠI; trả về true nếu thành công, false nếu thất bại.
// Tránh "nuốt" lỗi đồng bộ sheet một cách im lặng (chống lệch dữ liệu Firebase <-> Google Sheet).
async function postToSheetWithRetry(payload, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify(payload) });
            if (res.ok) {
                try {
                    const data = await res.clone().json();
                    if (!data || data.success !== false) return true; // GAS trả {success:false} mới coi là lỗi
                } catch (e) { return true; } // 200 nhưng không phải JSON -> vẫn coi là OK
            }
        } catch (e) { console.log("Lỗi đồng bộ Sheet (lần " + (attempt + 1) + "):", e); }
        if (attempt < retries) await new Promise(r => setTimeout(r, 500));
    }
    return false;
}

async function submitTx(tx) {
  try {
    showToast("Đang lưu giao dịch...", "info");
    const month = parseInt(tx.date.split('/')[1], 10);
    const year = parseInt(tx.date.split('/')[2], 10);
    if (tx.action === 'addTransaction') { tx.id = await getNextTransactionId(month, year); }
    const fbTx = { id: tx.id, date: tx.date, type: tx.type, content: tx.content, amount: tx.amount, category: tx.category, note: tx.note };

    // GHI LÊN FIREBASE TRƯỚC — xác nhận OK rồi mới cập nhật giao diện
    const res = await fetch(`${FIREBASE_URL}/transactions/${year}/month_${month}/${tx.id}.json`, { method: 'PUT', body: JSON.stringify(fbTx) });
    if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);

    // Ghi thành công -> mới đụng vào cache + render
    if (tx.action === 'addTransaction') { if (cachedTransactions?.data) cachedTransactions.data.unshift(fbTx); }
    else { [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => { if (!arr) return; const idx = arr.findIndex(i => String(i.id) === String(tx.id)); if (idx !== -1) arr[idx] = { ...arr[idx], ...fbTx }; }); }
    if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults();

    triggerHapticNotification('success'); showToast("Đã lưu giao dịch!", "success"); tab2NeedsReload = true;
    window.dayTxCache = {}; // Xoá cache nhiều ngày Tab 1 để lần sau tải lại dữ liệu mới
    window.apiTxCache = {}; // Xoá cache theo khoảng ngày của báo cáo Tab 2 (nếu không sẽ hiển thị số cũ)
    window.monthDataCache = {}; // Xoá cache dữ liệu theo năm_tháng để báo cáo & tìm kiếm dựng lại từ số liệu mới

    // Bắn tín hiệu về Bot
    if (tx.action === 'addTransaction') { notifyTelegram('add', fbTx); } else { notifyTelegram('update', fbTx); }

    // Đồng bộ Google Sheet (nền): kiểm tra + thử lại, báo cảnh báo nếu thất bại thay vì nuốt lỗi im lặng
    postToSheetWithRetry(tx).then(ok => { if (!ok) { triggerHapticNotification('warning'); showToast('Giao dịch đã lưu vào hệ thống, nhưng đồng bộ Google Sheet đang lỗi. Dữ liệu KHÔNG mất — vui lòng kiểm tra lại sau ít phút.', 'warning'); } });
    return true;
  } catch(e) {
    triggerHapticNotification('error');
    showToast(navigator.onLine ? ('Lưu thất bại: ' + e.message + '. Dữ liệu CHƯA được ghi, vui lòng thử lại!') : 'Mất kết nối mạng. Giao dịch CHƯA được lưu, thử lại nhé!', "error");
    return false;
  }
}

window.deleteTransaction = function(id) {
  closeEditForm(); triggerHaptic('medium'); 
  
  showCustomConfirm(
      'Xóa giao dịch',
      `Bạn có chắc chắn muốn xóa giao dịch <strong>#${escapeHTML(id)}</strong> này không?`,
      'Xóa',
      async () => {
          // Tìm giao dịch để lấy tháng + dữ liệu gửi Bot (CHƯA gỡ khỏi cache vội)
          let tx = null;
          if (cachedTransactions?.data) tx = cachedTransactions.data.find(i => String(i.id) === String(id));
          if (!tx && cachedSearchResults) tx = cachedSearchResults.find(i => String(i.id) === String(id));
          if (!tx && cachedChartData?.txs) tx = cachedChartData.txs.find(i => String(i.id) === String(id));

          // An toàn dữ liệu: nếu không xác định chắc chắn được tháng thì DỪNG, tuyệt đối không mặc định tháng 1 (tránh xóa nhầm bản ghi tháng khác)
          if (!tx || !tx.date || String(tx.date).split('/').length !== 3) {
              triggerHapticNotification('error');
              showToast('Không xác định được tháng của giao dịch này. Vui lòng tải lại trang rồi thử lại để tránh xóa nhầm dữ liệu.', "error");
              return;
          }
          const monthToUpdate = parseInt(tx.date.split('/')[1], 10);
          const yearToUpdate = parseInt(tx.date.split('/')[2], 10);

          showToast("Đang xóa giao dịch...", "info");
          try {
              // XÓA TRÊN FIREBASE TRƯỚC — xác nhận OK rồi mới đụng vào giao diện
              const res = await fetch(`${FIREBASE_URL}/transactions/${yearToUpdate}/month_${monthToUpdate}/${id}.json`, { method: 'DELETE' });
              if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status}`);

              // Xóa thành công -> giờ mới gỡ khỏi cache + render lại
              [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => { if (!arr) return; const idx = arr.findIndex(i => String(i.id) === String(id)); if (idx !== -1) arr.splice(idx, 1); });
              if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults();

              triggerHapticNotification('success'); showToast("Đã xóa giao dịch!", "success"); tab2NeedsReload = true;
              window.dayTxCache = {}; // Xoá cache nhiều ngày Tab 1 để lần sau tải lại dữ liệu mới
              window.apiTxCache = {}; // Xoá cache theo khoảng ngày của báo cáo Tab 2 (nếu không sẽ hiển thị số cũ)
              window.monthDataCache = {}; // Xoá cache dữ liệu theo năm_tháng để báo cáo & tìm kiếm dựng lại từ số liệu mới

              // Bắn tín hiệu về Bot
              if (tx) notifyTelegram('delete', tx);

              // Đồng bộ xóa trên Google Sheet (nền): kiểm tra + thử lại, báo cảnh báo nếu thất bại
              postToSheetWithRetry({action: 'deleteTransaction', id, month: monthToUpdate, sheetId}).then(ok => { if (!ok) { triggerHapticNotification('warning'); showToast('Đã xóa khỏi hệ thống, nhưng đồng bộ xóa trên Google Sheet đang lỗi. Vui lòng mở lại app kiểm tra sheet sau.', 'warning'); } });
          } catch(e) {
              triggerHapticNotification('error');
              showToast(navigator.onLine ? ('Xóa thất bại: ' + e.message + '. Giao dịch vẫn còn, thử lại nhé!') : 'Mất kết nối mạng. Giao dịch CHƯA bị xóa, thử lại nhé!', "error");
          }
      }
  );
};

// ==========================================
// TÍNH NĂNG CỪA SỔ "ICON PICKER"
// ==========================================
let pendingTags = [];
window.openIconPickerModal = function() {
    triggerHaptic('light');
    const modal = document.getElementById('iconPickerModal');
    const container = document.getElementById('iconGridContainer');
    
    const catSelect = document.getElementById('iconPickerSelect');
    const catInputGroup = document.getElementById('newCategoryInputGroup');
    const catInput = document.getElementById('iconPickerCategory');
    const tagArea = document.getElementById('tagInputArea');
    const tagInputField = document.getElementById('tagInputField');
    const tagsWrapper = document.getElementById('tagsWrapper');
    const hiddenKeywords = document.getElementById('iconPickerNewKeywords');
    const delBtn = document.getElementById('deleteCategoryBtn');
    
    if (container.innerHTML === '') {
        const flatEmojis = [
            '🍽️', '🛡️', '💄', '📱', '💼', '👕', '🛠️', '🚗', '👨‍👩‍👧‍👦', '🎉', '📚', '🧾', '🛍️', '🎁', '🌱', '💰', '💊', '❗',
            '☕', '🍔', '🍕', '🍜', '🥩', '🛒', '🛵', '🚌', '🚆', '✈️', '⛽',
            '🏠', '🏢', '👗', '👟', '👓', '💻', '📺', '🎮', '🎧',
            '💡', '💧', '🔥', '📶', '🩺', '🦷', '💪', '🎓', '🧸',
            '📈', '💳', '🪙', '👛', '🎂', '🥂', '🐶', '🐱',
            '👶', '👥', '🔧', '🔨', '✂️', '🎬', '🎫', '🎵',
            '📦', '🏷️', '✨', '❤️'
        ];
        container.innerHTML = flatEmojis.map(emoji => `<div class="icon-item" data-icon="${emoji}">${emoji}</div>`).join('');
        
        const bindIconClick = (item) => {
            item.onclick = function() {
                triggerHaptic('light');
                modal.querySelectorAll('.icon-item').forEach(i => i.classList.remove('selected'));
                this.classList.add('selected');
                modal.setAttribute('data-selected-icon', this.getAttribute('data-icon'));
            };
        };
        modal.querySelectorAll('.icon-item').forEach(bindIconClick);

        window.renderTags = function() {
            tagsWrapper.innerHTML = '';
            pendingTags.forEach((tag, idx) => {
                const span = document.createElement('span');
                span.className = 'tag-badge';
                span.innerHTML = `${escapeHTML(tag)} <i class="fas fa-times" onclick="removeTag(${idx})"></i>`;
                tagsWrapper.appendChild(span);
            });
            hiddenKeywords.value = pendingTags.join(', ');
        }
        window.removeTag = function(idx) { triggerHaptic('light'); pendingTags.splice(idx, 1); window.renderTags(); }
        
        if (tagInputField) {
            tagInputField.addEventListener('keydown', (e) => {
                if (e.key === ',' || e.key === 'Enter') {
                    e.preventDefault();
                    const val = tagInputField.value.trim().replace(/,/g, '');
                    if (val && !pendingTags.includes(val)) { pendingTags.push(val); tagInputField.value = ''; window.renderTags(); }
                } else if (e.key === 'Backspace' && tagInputField.value === '' && pendingTags.length > 0) {
                    pendingTags.pop(); window.renderTags();
                }
            });
        }
        
        document.getElementById('saveIconPickerBtn').onclick = async () => {
            const cat = catInput.value.trim();
            const selectedIcon = modal.getAttribute('data-selected-icon');
            const newKws = hiddenKeywords ? hiddenKeywords.value : "";
            
            if (!cat) return showToast('Vui lòng nhập tên danh mục!', 'warning');
            if (!selectedIcon) return showToast('Vui lòng chọn 1 icon!', 'warning');
            
            triggerHaptic('medium'); showLoading(true, 'tab3');
            try {
                // Ghi icon thẳng vào node gộp /categories/<tên>/icon
                await fetch(`${FIREBASE_URL}/categories/${encodeURIComponent(cat)}/icon.json`, { method: 'PUT', body: JSON.stringify(selectedIcon) });
                window.customCategoryIcons[cat] = selectedIcon; 
                window.categoryIconMap[cat] = selectedIcon;
                // GAS vẫn cập nhật sheet + từ khóa (giữ nguyên), sau đó sheet tự đồng bộ lại /categories
                await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'updateCategoryIcon', category: cat, icon: selectedIcon, newKeywords: newKws, sheetId: sheetId }) });

                showToast('Đã lưu cấu hình danh mục!', 'success'); closeIconPickerModal();
                await window.initCategories(true); window.loadKeywords(false); 
                if(document.getElementById('tab1').classList.contains('active')) displayTransactions();
                if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI();
            } catch(e) { showToast('Lỗi cập nhật icon: ' + e.message, 'error'); } finally { showLoading(false, 'tab3'); }
        };

        document.getElementById('deleteCategoryBtn').onclick = () => {
            const cat = catInput.value.trim();
            if (!cat) return;
            triggerHaptic('medium');
            
            showCustomConfirm(
                'Xóa danh mục',
                `Bạn có chắc chắn muốn xóa hoàn toàn danh mục <strong>${escapeHTML(cat)}</strong> và tất cả từ khóa của nó không?`,
                'Xóa',
                async () => {
                    showLoading(true, 'tab3');
                    try {
                        await fetch(`${FIREBASE_URL}/categories/${encodeURIComponent(cat)}.json`, { method: 'DELETE' });
                        delete window.customCategoryIcons[cat];
                        delete window.categoryIconMap[cat];
                        await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteCategory', category: cat, sheetId: sheetId }) });
                        
                        showToast('Đã xóa danh mục thành công!', 'success'); closeIconPickerModal();
                        await window.initCategories(false); window.loadKeywords(false);
                    } catch(e) { showToast('Lỗi xóa danh mục: ' + e.message, 'error'); } finally { showLoading(false, 'tab3'); }
                }
            );
        };
    }
    
    catSelect.innerHTML = '<option value="">-- Chọn danh mục hiện có --</option>';
    const cats = Array.from(document.getElementById('keywordCategory').options).map(opt => opt.value).filter(v => v);
    const uniqueCats = [...new Set(cats)]; 
    uniqueCats.forEach(c => { catSelect.appendChild(new Option(c, c)); });
    
    const newOpt = document.createElement('option');
    newOpt.value = "__NEW__";
    newOpt.innerHTML = "➕ Tạo danh mục mới...";
    newOpt.style.fontWeight = "bold";
    catSelect.appendChild(newOpt);

    const updateIconState = (val) => {
        let usedEmojis = [];
        uniqueCats.forEach(c => {
            if (c !== val) {
                let iconStr = window.customCategoryIcons[c] || window.categoryIconMap[c];
                if (iconStr) {
                    iconStr = iconStr.trim();
                    let emoji = iconStr;
                    if (iconStr.includes('fa-')) {
                        let faClass = iconStr.replace('fas ', '').trim();
                        if (!faClass.startsWith('fa-')) faClass = 'fa-' + faClass;
                        emoji = FA_TO_EMOJI_MAP[faClass];
                    }
                    if (emoji) usedEmojis.push(emoji);
                }
            }
        });

        modal.querySelectorAll('.icon-item').forEach(item => {
            item.classList.remove('selected');
            const itemEmoji = item.getAttribute('data-icon');
            if (usedEmojis.includes(itemEmoji)) {
                item.classList.add('disabled-icon');
            } else {
                item.classList.remove('disabled-icon');
            }
        });

        modal.removeAttribute('data-selected-icon');
        
        if (!val) return;

        let currentIconVal = null;
        if (window.customCategoryIcons && window.customCategoryIcons[val]) {
            currentIconVal = window.customCategoryIcons[val].trim();
        } else if (window.categoryIconMap && window.categoryIconMap[val]) {
            currentIconVal = window.categoryIconMap[val].trim();
        }

        if (currentIconVal) {
            let targetEmoji = currentIconVal.includes('fa-') ? FA_TO_EMOJI_MAP[currentIconVal.replace('fas ', '').trim().startsWith('fa-') ? currentIconVal.replace('fas ', '').trim() : 'fa-' + currentIconVal.replace('fas ', '').trim()] : currentIconVal;
            if (targetEmoji) {
                let item = Array.from(modal.querySelectorAll('.icon-item')).find(el => el.getAttribute('data-icon') === targetEmoji);
                if (!item) {
                    const newDiv = document.createElement('div');
                    newDiv.className = 'icon-item';
                    newDiv.setAttribute('data-icon', targetEmoji);
                    newDiv.innerHTML = targetEmoji;
                    newDiv.onclick = function() {
                        triggerHaptic('light');
                        modal.querySelectorAll('.icon-item').forEach(i => i.classList.remove('selected'));
                        this.classList.add('selected');
                        modal.setAttribute('data-selected-icon', this.getAttribute('data-icon'));
                    };
                    item = newDiv;
                }
                if (item) {
                    item.classList.add('selected');
                    item.classList.remove('disabled-icon');
                    modal.setAttribute('data-selected-icon', item.getAttribute('data-icon'));
                    if (container.firstChild !== item) container.insertBefore(item, container.firstChild);
                    container.scrollTop = 0;
                }
            }
        }
    };

    catSelect.onchange = (e) => {
        triggerHaptic('light');
        if (e.target.value === '__NEW__') {
            catInputGroup.style.display = 'block';
            tagArea.style.display = 'block';
            delBtn.style.display = 'none';
            catInput.value = '';
            catInput.focus();
            updateIconState(''); 
        } else {
            catInputGroup.style.display = 'none';
            tagArea.style.display = 'none';
            delBtn.style.display = e.target.value ? 'flex' : 'none';
            catInput.value = e.target.value;
            updateIconState(e.target.value);
        }
    };

    catInput.addEventListener('input', (e) => updateIconState(e.target.value.trim()));

    const currentSelected = document.getElementById('keywordCategory').value;
    if(currentSelected) {
        catSelect.value = currentSelected;
        catInput.value = currentSelected;
        catInputGroup.style.display = 'none';
        tagArea.style.display = 'none';
        delBtn.style.display = 'flex';
        updateIconState(currentSelected);
    } else {
        catSelect.value = '';
        catInput.value = '';
        catInputGroup.style.display = 'none';
        tagArea.style.display = 'none';
        delBtn.style.display = 'none';
        updateIconState('');
    }
    
    pendingTags = []; window.renderTags();

    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeIconPickerModal = function() {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.remove('show');
    setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};
