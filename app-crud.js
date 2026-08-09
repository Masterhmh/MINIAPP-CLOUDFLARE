// ============================================================================
// app-crud.js — TỪ KHÓA, DANH MỤC, CRUD GIAO DỊCH & ICON PICKER
// ----------------------------------------------------------------------------
// Vai trò: Tab 3 (quản lý từ khóa: tải, hiển thị, sửa/hủy), nạp danh mục,
//   thêm/sửa/xóa giao dịch (modal Add/Edit), sinh mã giao dịch, ghi/đọc
//   Firebase + đồng bộ Google Sheet (GAS), và cửa sổ ICON PICKER (cấu hình
//   danh mục + icon + từ khóa).
// Phụ thuộc: app-core.js (tiện ích, fetchMonthData, secureFetch...) và
//   currency.js (formatNumberWithCommas dùng ở app-core). Tương tác với
//   displayTransactions/updateTimeNavUI/displaySearchResults (app-reports.js).
// Thứ tự nạp: sau app-reports.js.
// ----------------------------------------------------------------------------
// CẬP NHẬT:
//   [A] window.refreshAllData(): sau MỌI thêm/sửa/xóa giao dịch hoặc đổi
//       danh mục/từ khóa -> xoá sạch cache và ĐỌC LẠI từ Firebase. Không còn
//       tình trạng sửa ngày xong danh sách cũ vẫn hiển thị (phải tắt/mở app).
//   [B] Icon Picker: chọn danh mục CÓ SẴN sẽ hiện luôn danh sách từ khóa của
//       danh mục đó để sửa/xóa trực tiếp; danh sách trên màn hình là danh sách
//       cuối cùng (xoá thẻ = xoá từ khóa), đồng bộ Sheet theo đúng phần thêm/bớt.
//   [C] Nút XÓA DANH MỤC chỉ hiện khi đang sửa MỘT danh mục CÓ SẴN (tránh bấm
//       nhầm). Điều khiển bằng class .editing-existing trên #iconPickerModal
//       (xem upgrade.css) — KHÔNG dùng style.display vì CSS có !important.
// ============================================================================

// ---------------- [A] LÀM MỚI TOÀN BỘ DỮ LIỆU SAU MỌI THAY ĐỔI ----------------
// Xoá sạch mọi tầng cache rồi tải lại tab đang mở từ Firebase.
window.refreshAllData = async function () {
    window.dayTxCache = {};            // cache Tab 1 theo ngày (app-reports.js)
    window.apiTxCache = {};            // cache theo khoảng ngày (Tab 2)
    window.monthDataCache = {};        // cache năm_tháng (app-core.js)
    window.__yearHasDataCache = {};    // cache của app-upgrade.js
    window.__yearFetchInFlight = {};
    window.__navBoundsPromise = null;
    cachedTransactions = null;
    cachedChartData = null;
    tab2NeedsReload = true;

    const active = id => !!document.getElementById(id) && document.getElementById(id).classList.contains('active');
    try {
        if (active('tab1')) {
            await window.fetchTransactions(true);            // ép tải lại ngày đang xem
        } else if (active('tab2')) {
            updateTimeNavUI();
        } else if (active('tab3') && cachedSearchResults && cachedSearchResults.length
                   && typeof window.rerunSearch === 'function') {
            await window.rerunSearch();                      // chạy lại tìm kiếm cho khớp dữ liệu mới
        }
    } catch (e) { console.log('refreshAllData:', e); }
};

// ---------------- TAB TỪ KHÓA ----------------
window.loadKeywords = async function(isInit = false) {
    if(!isInit) showLoading(true, 'tab3');
    if(!isInit) document.getElementById('keywordsContainer').innerHTML = '';
    try {
        // Đọc 1 node /categories duy nhất (object keyed theo tên danh mục) qua cổng bảo mật
        let raw = await secureFetch('/categories.json');
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
        let raw = await secureFetch('/categories.json'); 
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
    // Đọc đúng nhánh năm/tháng đó trên Firebase (qua cổng bảo mật)
    try {
        const data = await secureFetch(`/transactions/${year}/month_${month}.json`);
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

// Gửi POST sang Google Sheet (GAS) CÓ KIỂM TRA + THỬ LẠI; trả về true nếu thành công.
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

    // GHI LÊN FIREBASE TRƯỚC (qua cổng bảo mật) — secureFetch tự ném lỗi nếu thất bại
    await secureFetch(`/transactions/${year}/month_${month}/${tx.id}.json`, 'PUT', fbTx);

    // [A] Ghi thành công -> KHÔNG vá cache tay nữa: xoá cache + ĐỌC LẠI từ Firebase
    triggerHapticNotification('success');
    showToast("Đã lưu giao dịch!", "success");

    // Nếu người dùng đổi ngày -> nói rõ giao dịch đã chuyển sang ngày khác
    const viewing = document.getElementById('transactionDate')?.value; // yyyy-mm-dd
    if (viewing) {
        const [vy, vm, vd] = viewing.split('-');
        if (`${vd}/${vm}/${vy}` !== formatDate(tx.date)) {
            showToast(`Giao dịch đã chuyển sang ngày ${formatDate(tx.date)}`, 'info');
        }
    }

    await window.refreshAllData();

    // Bắn tín hiệu về Bot
    if (tx.action === 'addTransaction') { notifyTelegram('add', fbTx); } else { notifyTelegram('update', fbTx); }

    // Đồng bộ Google Sheet (nền): kiểm tra + thử lại, báo cảnh báo nếu thất bại
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
          // Tìm giao dịch để lấy tháng + dữ liệu gửi Bot
          let tx = null;
          if (cachedTransactions?.data) tx = cachedTransactions.data.find(i => String(i.id) === String(id));
          if (!tx && cachedSearchResults) tx = cachedSearchResults.find(i => String(i.id) === String(id));
          if (!tx && cachedChartData?.txs) tx = cachedChartData.txs.find(i => String(i.id) === String(id));

          // An toàn dữ liệu: không xác định chắc chắn được tháng thì DỪNG
          if (!tx || !tx.date || String(tx.date).split('/').length !== 3) {
              triggerHapticNotification('error');
              showToast('Không xác định được tháng của giao dịch này. Vui lòng tải lại trang rồi thử lại để tránh xóa nhầm dữ liệu.', "error");
              return;
          }
          const monthToUpdate = parseInt(tx.date.split('/')[1], 10);
          const yearToUpdate = parseInt(tx.date.split('/')[2], 10);

          showToast("Đang xóa giao dịch...", "info");
          try {
              // XÓA TRÊN FIREBASE TRƯỚC (qua cổng bảo mật)
              await secureFetch(`/transactions/${yearToUpdate}/month_${monthToUpdate}/${id}.json`, 'DELETE');

              // [A] Xóa thành công -> xoá cache + ĐỌC LẠI từ Firebase
              triggerHapticNotification('success');
              showToast("Đã xóa giao dịch!", "success");
              await window.refreshAllData();

              // Bắn tín hiệu về Bot
              if (tx) notifyTelegram('delete', tx);

              // Đồng bộ xóa trên Google Sheet (nền)
              postToSheetWithRetry({action: 'deleteTransaction', id, month: monthToUpdate, sheetId}).then(ok => { if (!ok) { triggerHapticNotification('warning'); showToast('Đã xóa khỏi hệ thống, nhưng đồng bộ xóa trên Google Sheet đang lỗi. Vui lòng mở lại app kiểm tra sheet sau.', 'warning'); } });
          } catch(e) {
              triggerHapticNotification('error');
              showToast(navigator.onLine ? ('Xóa thất bại: ' + e.message + '. Giao dịch vẫn còn, thử lại nhé!') : 'Mất kết nối mạng. Giao dịch CHƯA bị xóa, thử lại nhé!', "error");
          }
      }
  );
};

// ==========================================
// TÍNH NĂNG CỬA SỔ "ICON PICKER"
// ============================================================================
// CỬA SỔ "QUẢN LÝ DANH MỤC" (ICON PICKER) — bản tối ưu 09/08
// - Chọn danh mục có sẵn -> hiện luôn danh sách từ khóa để sửa/xóa.
// - Modal LUÔN mở ở đầu trang; lưới icon không còn bị cắt mép trái.
// - Nút XÓA chỉ hiện khi đang sửa danh mục CÓ SẴN (tránh bấm nhầm).
// ============================================================================
let pendingTags = [];

// Trạng thái đang sửa danh mục CÓ SẴN + bản gốc danh sách từ khóa (để tính phần bị xoá)
window.__editingExistingCat = null;
window.__originalTags = [];

// ---- Danh sách emoji dùng cho lưới icon (khai báo 1 lần, tránh tạo lại mỗi lần mở) ----
const ICON_PICKER_EMOJIS = [
    '🍽️', '🛡️', '💄', '📱', '💼', '👕', '🛠️', '🚗', '👨‍👩‍👧‍👦', '🎉', '📚', '🧾', '🛍️', '🎁', '🌱', '💰', '💊', '❗',
    '☕', '🍔', '🍕', '🍜', '🥩', '🛒', '🛵', '🚌', '🚆', '✈️', '⛽',
    '🏠', '🏢', '👗', '👟', '👓', '💻', '📺', '🎮', '🎧',
    '💡', '💧', '🔥', '📶', '🩺', '🦷', '💪', '🎓', '🧸',
    '📈', '💳', '🪙', '👛', '🎂', '🥂', '🐶', '🐱',
    '👶', '👥', '🔧', '🔨', '✂️', '🎬', '🎫', '🎵',
    '📦', '🏷️', '✨', '❤️'
];

// Chuẩn hóa 1 giá trị icon (emoji HOẶC tên Font Awesome cũ) về emoji
function iconValueToEmoji(raw) {
    if (!raw) return null;
    const val = String(raw).trim();
    if (!val.includes('fa-')) return val;                       // đã là emoji
    let faClass = val.replace('fas ', '').trim();
    if (!faClass.startsWith('fa-')) faClass = 'fa-' + faClass;
    return FA_TO_EMOJI_MAP[faClass] || null;
}

// [C] Nút xóa danh mục: CHỈ hiện khi đang sửa MỘT danh mục CÓ SẴN.
// Dùng class trên modal (upgrade.css có `#deleteCategoryBtn { display:none !important }`
// nên gán style.display trực tiếp sẽ KHÔNG có tác dụng).
function setDeleteBtnVisibility(isExisting) {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.toggle('editing-existing', !!isExisting);
}
window.setDeleteBtnVisibility = setDeleteBtnVisibility;

// Đưa modal + trang + lưới icon về vị trí ĐẦU (cả trục dọc VÀ trục ngang)
function scrollIconPickerToTop() {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); }
    [
        document.documentElement,
        document.body,
        document.getElementById('tab3'),
        document.querySelector('.app-container') || document.querySelector('.container'),
        document.getElementById('iconPickerModal'),
        document.getElementById('iconGridContainer')
    ].forEach(el => { if (el) { el.scrollTop = 0; el.scrollLeft = 0; } });
}

// Nạp danh sách từ khóa hiện có của 1 danh mục vào khu thẻ để sửa/xóa trực tiếp
window.loadTagsForCategory = async function (cat) {
    pendingTags = [];
    if (window.renderTags) window.renderTags();
    if (!cat) { window.__editingExistingCat = null; window.__originalTags = []; return; }
    window.__editingExistingCat = cat;
    try {
        const raw = await secureFetch(`/categories/${encodeURIComponent(cat)}/keywords.json`);
        pendingTags = String(raw || '').split(',').map(k => k.trim()).filter(k => k);
    } catch (e) { /* chưa có từ khóa -> để trống */ }
    window.__originalTags = pendingTags.slice();
    if (window.renderTags) window.renderTags();
};

window.openIconPickerModal = function () {
    triggerHaptic('light');
    const modal          = document.getElementById('iconPickerModal');
    const container      = document.getElementById('iconGridContainer');
    const catSelect      = document.getElementById('iconPickerSelect');
    const catInputGroup  = document.getElementById('newCategoryInputGroup');
    const catInput       = document.getElementById('iconPickerCategory');
    const tagArea        = document.getElementById('tagInputArea');
    const tagInputField  = document.getElementById('tagInputField');
    const tagsWrapper    = document.getElementById('tagsWrapper');
    const hiddenKeywords = document.getElementById('iconPickerNewKeywords');
    const delBtn         = document.getElementById('deleteCategoryBtn');

    // ---------- KHỞI TẠO 1 LẦN DUY NHẤT ----------
    if (container.innerHTML === '') {
        // Dựng lưới icon bằng DocumentFragment (1 lần reflow thay vì 68 lần)
        const frag = document.createDocumentFragment();
        ICON_PICKER_EMOJIS.forEach(emoji => {
            const div = document.createElement('div');
            div.className = 'icon-item';
            div.dataset.icon = emoji;
            div.textContent = emoji;
            frag.appendChild(div);
        });
        container.appendChild(frag);

        // MỘT listener cho cả lưới (event delegation) -> icon tạo động cũng tự hoạt động
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.icon-item');
            if (!item || item.classList.contains('disabled-icon')) return;
            triggerHaptic('light');
            container.querySelectorAll('.icon-item.selected').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            modal.setAttribute('data-selected-icon', item.dataset.icon);
        });

        // ---------- THẺ TỪ KHÓA ----------
        window.renderTags = function () {
            tagsWrapper.innerHTML = '';
            const frag2 = document.createDocumentFragment();
            pendingTags.forEach((tag, idx) => {
                const span = document.createElement('span');
                span.className = 'tag-badge';
                span.innerHTML = `${escapeHTML(tag)} <i class="fas fa-times" data-idx="${idx}"></i>`;
                frag2.appendChild(span);
            });
            tagsWrapper.appendChild(frag2);
            hiddenKeywords.value = pendingTags.join(', ');
        };
        // Xóa thẻ: cũng dùng 1 listener chung
        tagsWrapper.addEventListener('click', (e) => {
            const x = e.target.closest('.tag-badge i');
            if (!x) return;
            e.stopPropagation();
            triggerHaptic('light');
            pendingTags.splice(parseInt(x.dataset.idx, 10), 1);
            window.renderTags();
        });
        window.removeTag = function (idx) { pendingTags.splice(idx, 1); window.renderTags(); }; // giữ để tương thích

        // Chốt chữ đang gõ dở thành từ khóa (tách theo dấu phẩy để dán nhiều từ một lúc)
        window.commitTagInput = function () {
            if (!tagInputField) return;
            const rawVal = tagInputField.value.trim();
            if (!rawVal) return;
            rawVal.split(',').map(k => k.trim()).filter(k => k)
                  .forEach(val => { if (!pendingTags.includes(val)) pendingTags.push(val); });
            tagInputField.value = '';
            window.renderTags();
        };

        if (tagInputField) {
            tagInputField.addEventListener('keydown', (e) => {
                if (e.key === ',' || e.key === 'Enter') { e.preventDefault(); window.commitTagInput(); }
                else if (e.key === 'Backspace' && !tagInputField.value && pendingTags.length) { pendingTags.pop(); window.renderTags(); }
            });
            tagInputField.addEventListener('blur', () => window.commitTagInput());

            // iOS/Telegram: chạm vào CẢ vùng ô là focus được ngay
            const tagBoxEl = tagInputField.parentElement; // .tag-input-container
            if (tagBoxEl) {
                tagBoxEl.style.cursor = 'text';
                tagBoxEl.addEventListener('click', (e) => {
                    if (e.target.closest('.tag-badge')) return;
                    tagInputField.focus();
                });
            }
            const tagLabel = document.querySelector('#tagInputArea .field-label');
            if (tagLabel) tagLabel.textContent = 'Từ khóa của danh mục (chạm vào ô để thêm; bấm ✕ trên thẻ để xoá)';
            tagInputField.placeholder = 'VD: Bảo hành, giao dịch';
        }

        // ---------- LƯU ----------
        document.getElementById('saveIconPickerBtn').onclick = async () => {
            if (window.commitTagInput) window.commitTagInput();
            const cat = catInput.value.trim();
            const selectedIcon = modal.getAttribute('data-selected-icon');
            if (!cat) return showToast('Vui lòng nhập tên danh mục!', 'warning');
            if (!selectedIcon) return showToast('Vui lòng chọn 1 icon!', 'warning');

            triggerHaptic('medium'); showLoading(true, 'tab3');
            try {
                // 1) ICON
                await secureFetch(`/categories/${encodeURIComponent(cat)}/icon.json`, 'PUT', selectedIcon);
                window.customCategoryIcons[cat] = selectedIcon;
                window.categoryIconMap[cat] = selectedIcon;

                // 2) TỪ KHÓA
                const newList = pendingTags.map(k => String(k).trim()).filter(k => k);
                const editingExisting = (window.__editingExistingCat === cat);
                let finalStr;
                if (editingExisting) {
                    // Danh mục CÓ SẴN: danh sách đang hiện LÀ danh sách cuối cùng (xoá thẻ = xoá từ khóa)
                    finalStr = window.normalizeKeywordList(newList);
                } else {
                    // Danh mục MỚI: gộp thêm với danh sách hiện có
                    let existing = [];
                    try {
                        const raw = await secureFetch(`/categories/${encodeURIComponent(cat)}/keywords.json`);
                        existing = String(raw || '').split(',').map(k => k.trim()).filter(k => k);
                    } catch (err) {}
                    finalStr = window.normalizeKeywordList(existing.concat(newList));
                }
                await secureFetch(`/categories/${encodeURIComponent(cat)}/keywords.json`, 'PUT', finalStr);

                // 3) Cập nhật giao diện NGAY (không chờ Google Sheet)
                showToast('Đã lưu cấu hình danh mục!', 'success');
                closeIconPickerModal();
                await window.initCategories(true);
                await window.loadKeywords(false);
                await window.refreshAllData();

                // 4) Đồng bộ Google Sheet ở NỀN theo ĐÚNG phần thêm/bớt (dùng GAS sẵn có)
                const oldArr   = (window.__originalTags || []).map(k => k.trim().toLowerCase()).filter(k => k);
                const finalArr = finalStr ? finalStr.split(',').map(k => k.trim()).filter(k => k) : [];
                const removed  = editingExisting ? oldArr.filter(k => !finalArr.includes(k)) : [];
                const added    = finalArr.filter(k => !oldArr.includes(k));
                const post = (payload) => fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify(payload) });
                (async () => {
                    try {
                        await post({ action: 'updateCategoryIcon', category: cat, icon: selectedIcon, newKeywords: '', sheetId: sheetId });
                        for (const k of removed) await post({ action: 'deleteKeyword', category: cat, keyword: k, sheetId: sheetId });
                        if (added.length) await post({ action: 'addKeyword', category: cat, keywords: added.join(', '), sheetId: sheetId });
                    } catch (err) { console.log('Lỗi đồng bộ Sheet (nền):', err); }
                })();
            } catch (e) { showToast('Lỗi cập nhật danh mục: ' + e.message, 'error'); }
            finally { showLoading(false, 'tab3'); }
        };

        // ---------- XÓA DANH MỤC ----------
        delBtn.onclick = () => {
            const cat = catInput.value.trim();
            // Chốt an toàn 2 lớp: chỉ cho xóa khi đang thực sự sửa danh mục CÓ SẴN
            if (!cat) return;
            if (window.__editingExistingCat !== cat) {
                return showToast('Chỉ xóa được danh mục đã có. Hãy chọn danh mục từ danh sách.', 'warning');
            }
            triggerHaptic('medium');
            showCustomConfirm(
                'Xóa danh mục',
                `Bạn có chắc chắn muốn xóa hoàn toàn danh mục <strong>${escapeHTML(cat)}</strong> và tất cả từ khóa của nó không?`,
                'Xóa',
                async () => {
                    showLoading(true, 'tab3');
                    try {
                        await secureFetch(`/categories/${encodeURIComponent(cat)}.json`, 'DELETE');
                        delete window.customCategoryIcons[cat];
                        delete window.categoryIconMap[cat];
                        await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteCategory', category: cat, sheetId: sheetId }) });

                        showToast('Đã xóa danh mục thành công!', 'success');
                        closeIconPickerModal();
                        await window.initCategories(false);
                        await window.loadKeywords(false);
                        await window.refreshAllData();
                    } catch (e) { showToast('Lỗi xóa danh mục: ' + e.message, 'error'); }
                    finally { showLoading(false, 'tab3'); }
                }
            );
        };

        // Gõ tên danh mục -> cập nhật trạng thái lưới icon (gắn 1 lần)
        catInput.addEventListener('input', (e) => updateIconState(e.target.value.trim()));
    }

    // ---------- DỰNG DANH SÁCH DANH MỤC TRONG DROPDOWN ----------
    const uniqueCats = [...new Set(
        Array.from(document.getElementById('keywordCategory').options).map(o => o.value).filter(v => v)
    )];
    catSelect.innerHTML = '<option value="">-- Chọn danh mục --</option>';
    uniqueCats.forEach(c => catSelect.appendChild(new Option(c, c)));
    const newOpt = new Option('Tạo danh mục mới...', '__NEW__');
    newOpt.style.fontWeight = 'bold';
    catSelect.appendChild(newOpt);

    // ---------- CẬP NHẬT TRẠNG THÁI LƯỚI ICON (viết lại gọn) ----------
    function updateIconState(val) {
        // Icon đã bị danh mục KHÁC chiếm -> làm mờ, không cho chọn
        const used = new Set();
        uniqueCats.forEach(c => {
            if (c === val) return;
            const emoji = iconValueToEmoji(window.customCategoryIcons[c] || window.categoryIconMap[c]);
            if (emoji) used.add(emoji);
        });

        modal.removeAttribute('data-selected-icon');
        container.querySelectorAll('.icon-item').forEach(item => {
            item.classList.remove('selected');
            item.classList.toggle('disabled-icon', used.has(item.dataset.icon));
        });
        if (!val) return;

        // Đánh dấu icon hiện tại của danh mục đang chọn
        const target = iconValueToEmoji(window.customCategoryIcons[val] || window.categoryIconMap[val]);
        if (!target) return;
        let item = container.querySelector(`.icon-item[data-icon="${CSS.escape(target)}"]`);
        if (!item) {                                   // icon cũ (Font Awesome) không có trong lưới -> tạo thêm
            item = document.createElement('div');
            item.className = 'icon-item';
            item.dataset.icon = target;
            item.textContent = target;
        }
        item.classList.add('selected');
        item.classList.remove('disabled-icon');
        modal.setAttribute('data-selected-icon', target);
        if (container.firstChild !== item) container.insertBefore(item, container.firstChild);
        container.scrollTop = 0;
        container.scrollLeft = 0;                      // chặn trình duyệt tự cuộn ngang -> hết cắt mép trái
    }

    // ---------- CHỌN DANH MỤC ----------
    catSelect.onchange = async (e) => {
        triggerHaptic('light');
        const val = e.target.value;
        if (val === '__NEW__') {
            catInputGroup.style.display = 'block';
            tagArea.style.display = 'block';
            setDeleteBtnVisibility(false);              // tạo mới -> KHÔNG có nút xóa
            catInput.value = '';
            catInput.focus();
            updateIconState('');
            window.__editingExistingCat = null; window.__originalTags = [];
            pendingTags = []; window.renderTags();
        } else {
            catInputGroup.style.display = 'none';
            setDeleteBtnVisibility(!!val);              // chỉ danh mục CÓ SẴN mới hiện nút xóa
            catInput.value = val;
            updateIconState(val);
            if (val) {
                tagArea.style.display = 'block';
                await window.loadTagsForCategory(val);   // hiện luôn từ khóa của danh mục
            } else {
                tagArea.style.display = 'none';
                window.__editingExistingCat = null; window.__originalTags = [];
                pendingTags = []; window.renderTags();
            }
        }
        scrollIconPickerToTop();
    };

    // ---------- TRẠNG THÁI BAN ĐẦU KHI MỞ ----------
    const currentSelected = document.getElementById('keywordCategory').value;
    if (currentSelected) {
        catSelect.value = currentSelected;
        catInput.value = currentSelected;
        catInputGroup.style.display = 'none';
        tagArea.style.display = 'block';
        setDeleteBtnVisibility(true);                    // mở sẵn 1 danh mục có sẵn -> hiện nút xóa
        updateIconState(currentSelected);
        window.loadTagsForCategory(currentSelected);
    } else {
        catSelect.value = '';
        catInput.value = '';
        catInputGroup.style.display = 'none';
        tagArea.style.display = 'none';
        setDeleteBtnVisibility(false);                   // chưa chọn gì -> ẩn nút xóa
        updateIconState('');
        window.__editingExistingCat = null; window.__originalTags = [];
        pendingTags = []; if (window.renderTags) window.renderTags();
    }

    // ---------- HIỆN MODAL: LUÔN Ở ĐẦU TRANG ----------
    scrollIconPickerToTop();
    try { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.expand) Telegram.WebApp.expand(); } catch (e) {}
    document.getElementById('modalOverlay').classList.add('show');

    requestAnimationFrame(() => {
        modal.classList.add('show');
        scrollIconPickerToTop();
        // Chốt lại sau khi animation kết thúc (iOS đôi khi tự cuộn lại)
        setTimeout(scrollIconPickerToTop, 340);
    });
};

window.closeIconPickerModal = function () {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.remove('show');
    // Dọn trạng thái: lần mở sau không "kế thừa" việc đang hiện nút xóa
    if (modal) modal.classList.remove('editing-existing');
    setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};
