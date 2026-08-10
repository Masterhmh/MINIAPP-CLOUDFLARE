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
// ============================================================================

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

// ---------------- TAB 1: CHIẾN LƯỢC CẬP NHẬT DỮ LIỆU "LUÔN MỚI NHẤT" ----------------
async function invalidateCachesAndRefreshUI(options = {}) {
    window.dayTxCache = {};
    window.apiTxCache = {};
    window.monthDataCache = {};
    tab2NeedsReload = true;

    if (document.getElementById('tab1') && document.getElementById('tab1').classList.contains('active')) {
        try { await window.fetchTransactions(true); } catch (e) {}
        return;
    }

    if (document.getElementById('tab2') && document.getElementById('tab2').classList.contains('active')) {
        updateTimeNavUI();
        return;
    }

    if (document.getElementById('tab3') && document.getElementById('tab3').classList.contains('active')) {
        if (typeof displaySearchResults === 'function') displaySearchResults();
        return;
    }
}

async function getNextTransactionId(month, year) {
    let maxInMonth = 0;
    const consider = (id, dateStr) => {
        if (!String(id).startsWith('GD') || String(id).includes('_')) return;
        if (year != null && dateStr) {
            const p = String(dateStr).split('/');
            if (p.length === 3 && parseInt(p[2], 10) !== parseInt(year, 10)) return;
        }
        const n = parseInt(String(id).replace('GD', ''), 10);
        if (!isNaN(n) && n > maxInMonth) maxInMonth = n;
    };

    try {
        const data = await secureFetch(`/transactions/${year}/month_${month}.json`);
        if (data && typeof data === 'object') Object.keys(data).forEach(id => { const t = data[id]; consider(id, t && t.date); });
    } catch (e) {}

    [...(cachedTransactions?.data || []), ...(cachedChartData?.txs || []), ...(cachedSearchResults || [])].forEach(item => {
        if (!item || !item.id || !item.date) return;
        const m = parseInt(String(item.date).split('/')[1], 10);
        if (m !== month) return;
        consider(item.id, item.date);
    });

    const nextNum = maxInMonth + 1;
    return "GD" + String(nextNum).padStart(3, '0');
}

async function postToSheetWithRetry(payload, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const res = await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify(payload) });
            if (res.ok) {
                try {
                    const data = await res.clone().json();
                    if (!data || data.success !== false) return true;
                } catch (e) { return true; }
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

    await secureFetch(`/transactions/${year}/month_${month}/${tx.id}.json`, 'PUT', fbTx);

    if (tx.action === 'addTransaction') {
        if (cachedTransactions?.data) cachedTransactions.data.unshift(fbTx);
    } else {
        [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => {
            if (!arr) return;
            const idx = arr.findIndex(i => String(i.id) === String(tx.id));
            if (idx !== -1) arr[idx] = { ...arr[idx], ...fbTx };
        });
    }

    triggerHapticNotification('success');
    showToast("Đã lưu giao dịch!", "success");

    await invalidateCachesAndRefreshUI({ reason: 'submitTx' });

    if (tx.action === 'addTransaction') { notifyTelegram('add', fbTx); } else { notifyTelegram('update', fbTx); }

    postToSheetWithRetry(tx).then(ok => {
        if (!ok) {
            triggerHapticNotification('warning');
            showToast('Giao dịch đã lưu vào hệ thống, nhưng đồng bộ Google Sheet đang lỗi. Dữ liệu KHÔNG mất — vui lòng kiểm tra lại sau ít phút.', 'warning');
        }
    });

    return true;
  } catch(e) {
    triggerHapticNotification('error');
    showToast(
      navigator.onLine
        ? ('Lưu thất bại: ' + e.message + '. Dữ liệu CHƯA được ghi, vui lòng thử lại!')
        : 'Mất kết nối mạng. Giao dịch CHƯA được lưu, thử lại nhé!',
      "error"
    );
    return false;
  }
}

window.deleteTransaction = function(id, opts = {}) {
  if (!opts.fromSearch) closeEditForm();
  triggerHaptic('medium'); 
  
  showCustomConfirm(
    'Xóa giao dịch',
    `Bạn có chắc chắn muốn xóa giao dịch #${escapeHTML(id)} này không?`,
    'Xóa',
    async () => {
      let tx = null;
      if (cachedTransactions?.data) tx = cachedTransactions.data.find(i => String(i.id) === String(id));
      if (!tx && cachedSearchResults) tx = cachedSearchResults.find(i => String(i.id) === String(id));
      if (!tx && cachedChartData?.txs) tx = cachedChartData.txs.find(i => String(i.id) === String(id));

      if (!tx || !tx.date || String(tx.date).split('/').length !== 3) {
        triggerHapticNotification('error');
        showToast('Không xác định được tháng của giao dịch này. Vui lòng tải lại trang rồi thử lại để tránh xóa nhầm dữ liệu.', "error");
        return;
      }
      const monthToUpdate = parseInt(tx.date.split('/')[1], 10);
      const yearToUpdate = parseInt(tx.date.split('/')[2], 10);

      showToast("Đang xóa giao dịch...", "info");
      try {
        await secureFetch(`/transactions/${yearToUpdate}/month_${monthToUpdate}/${id}.json`, 'DELETE');

        [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => {
            if (!arr) return;
            const idx = arr.findIndex(i => String(i.id) === String(id));
            if (idx !== -1) arr.splice(idx, 1);
        });

        const searchModalEl = document.getElementById('searchModal');
        const searchOpen = opts.fromSearch || (searchModalEl && searchModalEl.classList.contains('show'));
        if (searchOpen) {
          const totalPages = Math.max(1, Math.ceil((cachedSearchResults?.length || 0) / itemsPerPage));
          if (currentPageSearch > totalPages) currentPageSearch = totalPages;
          displaySearchResults();
        }

        triggerHapticNotification('success');
        showToast("Đã xóa giao dịch!", "success");

        await invalidateCachesAndRefreshUI({ reason: 'deleteTx' });

        if (tx) notifyTelegram('delete', tx);

        postToSheetWithRetry({action: 'deleteTransaction', id, month: monthToUpdate, sheetId}).then(ok => {
            if (!ok) {
                triggerHapticNotification('warning');
                showToast('Đã xóa khỏi hệ thống, nhưng đồng bộ xóa trên Google Sheet đang lỗi. Vui lòng mở lại app kiểm tra sheet sau.', 'warning');
            }
        });

      } catch(e) {
        triggerHapticNotification('error');
        showToast(
          navigator.onLine
            ? ('Xóa thất bại: ' + e.message + '. Giao dịch vẫn còn, thử lại nhé!')
            : 'Mất kết nối mạng. Giao dịch CHƯA bị xóa, thử lại nhé!',
          "error"
        );
      }
    }
  );
};

// ==========================================
// TÍNH NĂNG CỪA SỔ "ICON PICKER"
// ==========================================
let pendingTags = [];

/* =========================
   LOCK SCROLL NỀN KHI MỞ ICON PICKER
   ========================= */
let __iconPickerScrollY = 0;
function lockBackgroundScrollForIconPicker() {
    try {
        __iconPickerScrollY = window.scrollY || 0;
        document.body.classList.add('iconpicker-open');
        document.body.style.top = `-${__iconPickerScrollY}px`;
    } catch(e) {}
}
function unlockBackgroundScrollForIconPicker() {
    try {
        document.body.classList.remove('iconpicker-open');
        const top = document.body.style.top || '';
        document.body.style.top = '';
        const y = top ? parseInt(top.replace('-', '').replace('px',''), 10) : __iconPickerScrollY;
        window.scrollTo(0, isNaN(y) ? 0 : y);
    } catch(e) {}
}

async function loadExistingKeywordsIntoTags(categoryName) {
    if (!categoryName) {
        pendingTags = [];
        if (window.renderTags) window.renderTags();
        return;
    }
    try {
        const raw = await secureFetch(`/categories/${encodeURIComponent(categoryName)}/keywords.json`);
        const list = String(raw || '')
            .split(',')
            .map(k => k.trim())
            .filter(k => k);

        const seen = new Set();
        pendingTags = [];
        list.forEach(k => {
            const key = k.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            pendingTags.push(k);
        });

        if (window.renderTags) window.renderTags();
    } catch (e) {
        pendingTags = [];
        if (window.renderTags) window.renderTags();
    }
}

// (giữ lại, hiện không auto gọi)
function scrollToTagInputAndFocus() {
    const body = document.getElementById('iconPickerBody');
    const area = document.getElementById('tagInputArea');
    const input = document.getElementById('tagInputField');
    if (!body || !area || !input) return;

    setTimeout(() => {
        try {
            area.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } catch (e) {
            try { body.scrollTop = area.offsetTop - 80; } catch (_) {}
        }

        setTimeout(() => {
            try { input.focus({ preventScroll: true }); }
            catch (_) { try { input.focus(); } catch (__) {} }
        }, 120);
    }, 50);
}

function setupIconGridCollapse() {
    const grid = document.getElementById('iconGridContainer');
    if (!grid) return;

    if (document.getElementById('toggleIconGridBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'toggleIconGridBtn';
    btn.type = 'button';
    btn.className = 'btn-soft';
    btn.style.margin = '8px 0 10px';
    btn.style.padding = '10px 12px';
    btn.style.width = '100%';
    btn.style.display = 'flex';
    btn.style.alignItems = 'center';
    btn.style.justifyContent = 'center';
    btn.style.gap = '8px';
    btn.innerHTML = '<i class="fas fa-chevron-down"></i> Xem thêm icon';

    grid.dataset.collapsed = '1';

    const apply = () => {
        const collapsed = grid.dataset.collapsed === '1';

        const firstItem = grid.querySelector('.icon-item');
        let twoRowsHeight = 128;
        if (firstItem) {
            const rect = firstItem.getBoundingClientRect();
            const itemH = rect.height || 56;
            twoRowsHeight = Math.round(itemH * 2 + 16);
        }

        if (collapsed) {
            grid.style.maxHeight = twoRowsHeight + 'px';
            grid.style.overflow = 'hidden';
            btn.innerHTML = '<i class="fas fa-chevron-down"></i> Xem thêm icon';
        } else {
            grid.style.maxHeight = 'none';
            grid.style.overflow = 'visible';
            btn.innerHTML = '<i class="fas fa-chevron-up"></i> Thu gọn icon';
        }
    };

    btn.onclick = (e) => {
        e.preventDefault();
        if (typeof triggerHaptic === 'function') triggerHaptic('light');
        grid.dataset.collapsed = (grid.dataset.collapsed === '1') ? '0' : '1';
        apply();
    };

    grid.parentElement.insertBefore(btn, grid);
    apply();
}

async function renameCategoryInFirebaseTransactions(oldCat, newCat) {
    if (!oldCat || !newCat || oldCat === newCat) return;

    let allData = null;
    try {
        allData = await secureFetch('/transactions.json');
    } catch (e) {
        console.log('Không đọc được toàn bộ transactions để đổi danh mục:', e);
        throw new Error('Không đọc được dữ liệu giao dịch Firebase để đổi tên danh mục');
    }

    if (!allData || typeof allData !== 'object') return;

    for (const year of Object.keys(allData)) {
        const yearData = allData[year];
        if (!yearData || typeof yearData !== 'object') continue;

        for (const monthKey of Object.keys(yearData)) {
            const monthData = yearData[monthKey];
            if (!monthData || typeof monthData !== 'object') continue;

            let changed = false;
            Object.keys(monthData).forEach(id => {
                const tx = monthData[id];
                if (tx && tx.category === oldCat) {
                    tx.category = newCat;
                    changed = true;
                }
            });

            if (changed) {
                await secureFetch(`/transactions/${year}/${monthKey}.json`, 'PUT', monthData);
            }
        }
    }
}

async function saveCategoryToFirebaseFirst(oldCat, newCat, selectedIcon, newKws) {
    let existingKeywords = [];
    let oldData = null;

    if (oldCat) {
        try {
            oldData = await secureFetch(`/categories/${encodeURIComponent(oldCat)}.json`);
        } catch (e) {
            oldData = null;
        }
    }

    if (oldData && oldData.keywords) {
        existingKeywords = String(oldData.keywords).split(',').map(k => k.trim()).filter(k => k);
    }

    if (newKws && newKws.trim()) {
        newKws.split(',').forEach(k => {
            const clean = k.trim();
            if (clean) existingKeywords.push(clean);
        });
    }

    const finalKeywords = window.normalizeKeywordList
        ? window.normalizeKeywordList(existingKeywords)
        : [...new Set(existingKeywords.map(k => k.toLowerCase()))].sort((a, b) => a.localeCompare(b, 'vi')).join(', ');

    await secureFetch(`/categories/${encodeURIComponent(newCat)}.json`, 'PUT', {
        icon: selectedIcon,
        keywords: finalKeywords || ''
    });

    if (oldCat && oldCat !== newCat) {
        await renameCategoryInFirebaseTransactions(oldCat, newCat);
        await secureFetch(`/categories/${encodeURIComponent(oldCat)}.json`, 'DELETE');
    }

    return finalKeywords;
}
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

        window.commitTagInput = function() {
            if (!tagInputField) return;
            const rawVal = tagInputField.value.trim();
            if (!rawVal) return;
            rawVal.split(',').map(k => k.trim()).filter(k => k).forEach(val => { if (!pendingTags.includes(val)) pendingTags.push(val); });
            tagInputField.value = '';
            window.renderTags();
        };

        if (tagInputField) {
            tagInputField.addEventListener('keydown', (e) => {
                if (e.key === ',' || e.key === 'Enter') {
                    e.preventDefault();
                    window.commitTagInput();
                } else if (e.key === 'Backspace' && tagInputField.value === '' && pendingTags.length > 0) {
                    pendingTags.pop(); window.renderTags();
                }
            });
            tagInputField.addEventListener('blur', () => window.commitTagInput());

            // Focus chắc vào ô nhập khi chạm vùng tag (FIX MOBILE)
            const tagBoxEl = tagInputField.parentElement; // .tag-input-container
            if (tagBoxEl) {
                tagBoxEl.style.cursor = 'text';

                const focusTagInput = (e) => {
                    if (e) {
                        if (typeof e.preventDefault === 'function') e.preventDefault();
                        if (typeof e.stopPropagation === 'function') e.stopPropagation();
                    }

                    // iOS/Telegram WebView: phải đảm bảo input nằm trong khung nhìn của vùng scroll thì mới bật bàn phím
                    try {
                        const body = document.getElementById('iconPickerBody');
                        const area = document.getElementById('tagInputArea');

                        if (body && area) {
                            body.scrollTo({
                                top: Math.max(0, area.offsetTop - 80),
                                behavior: 'smooth'
                            });
                        } else if (area && area.scrollIntoView) {
                            area.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    } catch (_) {}

                    // Focus sau khi đã “căn” scroll
                    setTimeout(() => {
                        try { tagInputField.focus({ preventScroll: true }); }
                        catch (_) { try { tagInputField.focus(); } catch (__) {} }
                    }, 60);
                };

                tagBoxEl.addEventListener('touchstart', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.tag-badge')) return;
                    focusTagInput(e);
                }, { passive: false });

                // NEW: touchend để bắt chắc tap đầu tiên trên iOS/WebView
                tagBoxEl.addEventListener('touchend', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.tag-badge')) return;
                    focusTagInput(e);
                }, { passive: false });

                tagBoxEl.addEventListener('mousedown', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.tag-badge')) return;
                    focusTagInput(e);
                });

                tagBoxEl.addEventListener('click', (e) => {
                    if (e.target && e.target.closest && e.target.closest('.tag-badge')) return;
                    focusTagInput(e);
                });
            }

            const tagLabel = document.querySelector('#tagInputArea .field-label');
            if (tagLabel) tagLabel.textContent = 'Thêm từ khóa (chạm vào ô rồi gõ, xong bấm Enter hoặc dấu phẩy)';
            tagInputField.placeholder = 'VD: Bảo hành, giao dịch';
        }
        
        document.getElementById('saveIconPickerBtn').onclick = async () => {
            if (window.commitTagInput) window.commitTagInput();

            const oldCat = (modal.getAttribute('data-original-category') || '').trim();
            const newCat = catInput.value.trim();
            const selectedIcon = modal.getAttribute('data-selected-icon');
            const newKws = hiddenKeywords ? hiddenKeywords.value : "";

            if (!newCat) return showToast('Vui lòng nhập tên danh mục!', 'warning');
            if (!selectedIcon) return showToast('Vui lòng chọn 1 icon!', 'warning');

            const existingCats = Array.from(document.getElementById('keywordCategory').options)
                .map(opt => opt.value)
                .filter(v => v);

            const isDuplicate = existingCats.some(c =>
                c.toLowerCase() === newCat.toLowerCase() &&
                c.toLowerCase() !== oldCat.toLowerCase()
            );

            if (isDuplicate) return showToast('Tên danh mục này đã tồn tại!', 'warning');

            const doSaveCategory = async () => {
                triggerHaptic('medium');
                showLoading(true, 'tab3');

                try {
                    const finalKeywords = await saveCategoryToFirebaseFirst(oldCat, newCat, selectedIcon, newKws);

                    if (oldCat && oldCat !== newCat) {
                        delete window.customCategoryIcons[oldCat];
                        delete window.categoryIconMap[oldCat];
                    }
                    window.customCategoryIcons[newCat] = selectedIcon;
                    window.categoryIconMap[newCat] = selectedIcon;

                    if (oldCat && oldCat !== newCat) {
                        [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => {
                            if (!arr) return;
                            arr.forEach(tx => { if (tx.category === oldCat) tx.category = newCat; });
                        });
                    }

                    await invalidateCachesAndRefreshUI({ reason: 'saveCategory' });

                    showToast('Đã lưu thay đổi danh mục!', 'success');
                    closeIconPickerModal();
                    await window.initCategories(true);
                    window.loadKeywords(false);

                    fetch(proxyUrl + encodeURIComponent(apiUrl), {
                        method: 'POST',
                        body: JSON.stringify({
                            action: 'saveCategory',
                            oldCategory: oldCat,
                            newCategory: newCat,
                            icon: selectedIcon,
                            keywords: newKws,
                            finalKeywords: finalKeywords,
                            sheetId: sheetId
                        })
                    }).catch(() => {});
                } catch(e) {
                    showToast('Lỗi lưu danh mục: ' + e.message, 'error');
                } finally {
                    showLoading(false, 'tab3');
                }
            };

            if (oldCat && oldCat !== newCat) {
                showCustomConfirm(
                    'Đổi tên danh mục',
                    `Bạn có chắc muốn đổi danh mục <b>${escapeHTML(oldCat)}</b> thành <b>${escapeHTML(newCat)}</b>?<br><br>Tất cả giao dịch trên Firebase thuộc danh mục cũ ở mọi năm cũng sẽ được cập nhật. Google Sheet hiện tại sẽ được backup sau.`,
                    'Đổi tên',
                    doSaveCategory
                );
            } else {
                await doSaveCategory();
            }
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
                        await secureFetch(`/categories/${encodeURIComponent(cat)}.json`, 'DELETE');
                        delete window.customCategoryIcons[cat];
                        delete window.categoryIconMap[cat];
                        await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteCategory', category: cat, sheetId: sheetId }) });
                        
                        showToast('Đã xóa danh mục thành công!', 'success'); closeIconPickerModal();
                        await window.initCategories(false); window.loadKeywords(false);

                        await invalidateCachesAndRefreshUI({ reason: 'deleteCategory' });
                    } catch(e) { showToast('Lỗi xóa danh mục: ' + e.message, 'error'); } finally { showLoading(false, 'tab3'); }
                }
            );
        };
    }

    setupIconGridCollapse();

    catSelect.innerHTML = '<option value="">-- Chọn danh mục --</option>';
    const cats = Array.from(document.getElementById('keywordCategory').options).map(opt => opt.value).filter(v => v);
    const uniqueCats = [...new Set(cats)]; 
    uniqueCats.forEach(c => { catSelect.appendChild(new Option(c, c)); });
    
    const newOpt = document.createElement('option');
    newOpt.value = "__NEW__";
    newOpt.innerHTML = "Tạo danh mục mới...";
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

    catSelect.onchange = async (e) => {
        triggerHaptic('light');
        if (e.target.value === '__NEW__') {
            catInputGroup.style.display = 'block';
            tagArea.style.display = 'block';
            delBtn.style.display = 'none';
            catInput.value = '';
            modal.removeAttribute('data-original-category');

            pendingTags = [];
            if (window.renderTags) window.renderTags();
            catInput.focus();
            updateIconState('');
        } else {
            const selectedCategory = e.target.value || '';
            catInputGroup.style.display = selectedCategory ? 'block' : 'none';
            tagArea.style.display = selectedCategory ? 'block' : 'none';
            delBtn.style.display = selectedCategory ? 'flex' : 'none';
            catInput.value = selectedCategory;
            if (selectedCategory) modal.setAttribute('data-original-category', selectedCategory);
            else modal.removeAttribute('data-original-category');

            await loadExistingKeywordsIntoTags(selectedCategory);
            updateIconState(selectedCategory);

            // Không auto cuộn, không auto focus; chỉ blur select để tap tiếp theo không bị “nuốt”
            setTimeout(() => {
                try { catSelect.blur(); } catch (_) {}
                try { if (document.activeElement) document.activeElement.blur(); } catch (_) {}
            }, 0);
        }
    };

    catInput.addEventListener('input', (e) => updateIconState(e.target.value.trim()));

    const currentSelected = document.getElementById('keywordCategory').value;
    if(currentSelected) {
        catSelect.value = currentSelected;
        catInput.value = currentSelected;
        catInputGroup.style.display = 'block';
        tagArea.style.display = 'block';
        delBtn.style.display = 'flex';
        modal.setAttribute('data-original-category', currentSelected);

        loadExistingKeywordsIntoTags(currentSelected);
        updateIconState(currentSelected);
    } else {
        catSelect.value = '';
        catInput.value = '';
        catInputGroup.style.display = 'none';
        tagArea.style.display = 'none';
        delBtn.style.display = 'none';
        modal.removeAttribute('data-original-category');
        updateIconState('');
        pendingTags = [];
        if (window.renderTags) window.renderTags();
    }

    if (window.renderTags) window.renderTags();

    lockBackgroundScrollForIconPicker();

    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeIconPickerModal = function() {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.remove('show');
    setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);

    unlockBackgroundScrollForIconPicker();
};
