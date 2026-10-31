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

// PERSONAL ROUND 3 (F-04, ngang production vòng 28): CTA ở trạng thái rỗng
// của view Từ khóa — bấm "Thêm từ khóa" thì focus thẳng vào ô nhập từ khóa.
window.emptyFocusKeyword = function () {
  triggerHaptic('light');
  var inp = document.getElementById('keywordInput');
  if (inp) { try { inp.focus({ preventScroll: false }); } catch (e) { inp.focus(); } inp.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
};

window.startEditKeyword = function(kw, category) {
    triggerHaptic('light');
    document.getElementById('keywordInput').value = kw;
    document.getElementById('keywordCategory').value = category;
    currentEditKeyword = kw; 
    const btnAdd = document.getElementById('addKeywordBtn');
    btnAdd.innerHTML = '<i class="fas fa-save"></i> Lưu sửa';
    btnAdd.classList.add('btn-edit-kw'); 
    document.getElementById('cancelKeywordBtn').style.display = 'flex';
    document.getElementById('deleteEditKeywordBtn').style.display = 'flex';
    document.getElementById('fetchKeywordsBtn').style.display = 'none';
};

window.cancelEditKeyword = function() { 
    triggerHaptic('light');
    document.getElementById('keywordInput').value = '';
    currentEditKeyword = null; 
    const btnAdd = document.getElementById('addKeywordBtn');
    btnAdd.innerHTML = '<i class="fas fa-plus"></i> Thêm';
    btnAdd.classList.remove('btn-edit-kw'); 
    document.getElementById('cancelKeywordBtn').style.display = 'none';
    document.getElementById('deleteEditKeywordBtn').style.display = 'none';
    document.getElementById('fetchKeywordsBtn').style.display = 'flex';
};

function displayKeywords() {
   const container = document.getElementById('keywordsContainer');
   container.innerHTML = '';
   if(!cachedKeywords || cachedKeywords.length === 0) {
     document.getElementById('placeholderTab3').style.display = 'block';
     return;
   }
   document.getElementById('placeholderTab3').style.display = 'none';

   const groupedKeywords = {};
   cachedKeywords.forEach(item => {
        const category = item.category || 'Khác';
        if (!groupedKeywords[category]) groupedKeywords[category] = { keywords: [] };
        if (item.keywords && typeof item.keywords === 'string') {
            const kwsArray = item.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
            kwsArray.forEach(kw => {
                if (!groupedKeywords[category].keywords.includes(kw)) groupedKeywords[category].keywords.push(kw);
            });
        }
   });

   Object.keys(groupedKeywords)
    .sort((a,b) => { if (a.toLowerCase() === 'khác') return 1; if (b.toLowerCase() === 'khác') return -1; return a.localeCompare(b, 'vi'); })
    .forEach(category => { 
       const group = groupedKeywords[category];
       let tagsHTML = '';
       group.keywords.sort((a,b) => a.localeCompare(b, 'vi')).forEach(kw => {
            tagsHTML += `<span class="keyword-tag" data-kw="${escapeHTML(kw)}" data-cat="${escapeHTML(category)}">${escapeHTML(kw)}</span>`;
       }); 
       const div = document.createElement('div');
       div.className = 'tx-card keyword-group-card';
       div.innerHTML = `<div class="accordion-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'flex':'none'; this.querySelector('.chevron').style.transform = this.nextElementSibling.style.display==='none'?'rotate(0deg)':'rotate(180deg)';"><div class="flex-row-gap-10" style="align-items:center;"><div class="tx-icon-wrap expense">${getCategoryIcon(category)}</div><div class="tx-body"><div class="tx-title">${escapeHTML(category)}</div><div class="tx-id-row">${group.keywords.length} từ khóa</div></div></div><i class="fas fa-chevron-down chevron" style="color: var(--text-3); transition: 0.3s;"></i></div><div class="accordion-body" style="display:none;">${tagsHTML || '<span class="tx-note">Chưa có từ khóa</span>'}</div>`;
       container.appendChild(div);
       div.querySelectorAll('.keyword-tag').forEach(tag => {
          tag.addEventListener('click', () => startEditKeyword(tag.dataset.kw, tag.dataset.cat));
       });
   });
}

// ---------------- MODALS & CRUD ----------------
async function fetchCategories() { 
    try { 
        let raw = await secureFetch('/categories.json'); 
        if(!raw) {
          const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getCategories&sheetId=${sheetId}`));
          raw = await gasRes.json();
        }
        let cats = [];
        if (Array.isArray(raw)) cats = raw.filter(c => c);
        else if (raw && typeof raw === 'object') cats = Object.keys(raw);
        cats.sort((a, b) => { if (a.toLowerCase() === 'khác') return 1; if (b.toLowerCase() === 'khác') return -1; return a.localeCompare(b, 'vi'); });
        return cats; 
    } catch(e) { return []; } 
}

window.selectType = function(formId, type, el) {
  triggerHaptic('light');
  document.getElementById(formId + 'Type').value = type;
  const pills = el.parentElement.querySelectorAll('.type-pill');
  pills.forEach(p => p.classList.remove('income-active', 'expense-active'));
  if(type === 'Chi tiêu') el.classList.add('expense-active');
  else el.classList.add('income-active');
};

window.openAddForm = async function() {
  triggerHaptic('light');
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('addModal').classList.add('show'), 10);

  document.querySelectorAll('#addModal .type-pill').forEach(p => {
    if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập';
    else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu';
  });

  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
  document.getElementById('addContent').value = '';
  document.getElementById('addAmount').value = '';
  document.getElementById('addNote').value = '';
  document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Chi tiêu')) p.click(); });

  const catSel = document.getElementById('addCategory');
  catSel.innerHTML = '';
  const cats = await fetchCategories();
  cats.forEach(c => catSel.appendChild(new Option(c, c)));
};

window.closeAddForm = function() {
  document.getElementById('addModal').classList.remove('show');
  setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};

window.openEditForm = async function(tx) {
  if(!tx) return;
  triggerHaptic('light');
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('editModal').classList.add('show'), 10);

  const pills = document.querySelectorAll('#editModal .type-pill');
  pills.forEach(p => {
    if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập';
    else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu';
  });

  document.getElementById('editTransactionId').value = tx.id;
  document.getElementById('editContent').value = tx.content;
  document.getElementById('editAmount').value = formatNumberWithCommas(tx.amount.toString());
  document.getElementById('editNote').value = tx.note || '';
  const [d,m,y] = tx.date.split('/');
  document.getElementById('editDate').value = `${y}-${m}-${d}`;

  pills.forEach(p => {
    if(tx.type === 'Thu nhập' && p.textContent.includes('Thu nhập')) p.click();
    if(tx.type === 'Chi tiêu' && p.textContent.includes('Chi tiêu')) p.click();
  });

  const catSel = document.getElementById('editCategory');
  catSel.innerHTML = '';
  const cats = await fetchCategories();
  cats.forEach(c => {
    const opt = new Option(c, c);
    if(c === tx.category) opt.selected = true;
    catSel.appendChild(opt);
  });
};

window.closeEditForm = function() {
  document.getElementById('editModal').classList.remove('show');
  setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};

window.closeAllModals = function() {
  closeAddForm(); closeEditForm(); closeSearchModal(); closeDetailModal();
  if (document.getElementById('iconPickerModal')) document.getElementById('iconPickerModal').classList.remove('show');
  if (document.getElementById('pdfPreviewModal')) document.getElementById('pdfPreviewModal').classList.remove('show');
};
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

// PERSONAL ROUND 4a — opts.quiet (port từ bản chính R58): lưu hàng loạt
// (nhập nhanh) không toast/rung/làm mới từng dòng; cuối cùng quickEntrySave
// tự invalidate một lần + rung một lần + popup tổng kết. NGOẠI LỆ theo
// Hùng chốt 2026-10-31: notifyTelegram VẪN gửi từng khoản như thêm lẻ
// (không bị quiet tắt). Đồng bộ Sheet vẫn chạy ngầm từng khoản như thêm lẻ,
// nhưng cảnh báo lỗi của nó bị nén dưới quiet (tránh N toast khi lưu loạt).
async function submitTx(tx, opts) {
  try {
    var quiet = !!(opts && opts.quiet);
    if (!quiet) showToast("Đang lưu giao dịch...", "info");

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

    if (!quiet) {
      triggerHapticNotification('success');
      showToast("Đã lưu giao dịch!", "success");
    }

    if (!quiet) await invalidateCachesAndRefreshUI({ reason: 'submitTx' });

    // 4a: notify KHÔNG bị quiet tắt (Hùng chốt: vẫn gửi Telegram từng khoản).
    if (tx.action === 'addTransaction') { notifyTelegram('add', fbTx); }
    else { notifyTelegram('update', fbTx); }

    postToSheetWithRetry(tx).then(ok => {
        if (!ok && !quiet) {
            triggerHapticNotification('warning');
            showToast('Giao dịch đã lưu vào hệ thống, nhưng đồng bộ Google Sheet đang lỗi. Dữ liệu KHÔNG mất — vui lòng kiểm tra lại sau ít phút.', 'warning');
        }
    });

    return true;
  } catch(e) {
    if (!quiet) {
      triggerHapticNotification('error');
      showToast(
        navigator.onLine
          ? ('Lưu thất bại: ' + e.message + '. Dữ liệu CHƯA được ghi, vui lòng thử lại!')
          : 'Mất kết nối mạng. Giao dịch CHƯA được lưu, thử lại nhé!',
        "error"
      );
    }
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
// ICON PICKER
// ==========================================
let pendingTags = [];

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

function scrollToTagInputAndFocus() {
    const body = document.getElementById('iconPickerBody');
    const area = document.getElementById('tagInputArea');
    const input = document.getElementById('tagInputField');
    if (!body || !area || !input) return;

    try { body.scrollTop = Math.max(0, area.offsetTop - 80); } catch (_) {}

    try { input.focus({ preventScroll: true }); }
    catch (_) { try { input.focus(); } catch (__) {} }
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
        try { oldData = await secureFetch(`/categories/${encodeURIComponent(oldCat)}.json`); }
        catch (e) { oldData = null; }
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

    // Hook visualViewport resize 1 lần (để cuộn đúng lúc bàn phím iOS bật)
    if (window.visualViewport && !window.__vvHookedForIconPicker) {
        window.__vvHookedForIconPicker = true;
        const onVV = () => {
            try {
                const active = document.activeElement;
                if (active && active.id === 'tagInputField') {
                    requestAnimationFrame(() => {
                        try { window.__ensureTagInputVisible && window.__ensureTagInputVisible(); } catch (_) {}
                    });
                    setTimeout(() => {
                        try { window.__ensureTagInputVisible && window.__ensureTagInputVisible(); } catch (_) {}
                    }, 120);
                }
            } catch (_) {}
        };
        window.visualViewport.addEventListener('resize', onVV);
        window.visualViewport.addEventListener('scroll', onVV);
    }

    if (container.innerHTML === '') {
        const flatEmojis = [
            '🍽️','🛡️','💄','📱','💼','👕','🛠️','🚗','👨‍👩‍👧‍👦','🎉','📚','🧾','🛍️','🎁','🌱','💰','💊','❗',
            '☕','🍔','🍕','🍜','🥩','🛒','🛵','🚌','🚆','✈️','⛽',
            '🏠','🏢','👗','👟','👓','💻','📺','🎮','🎧',
            '💡','💧','🔥','📶','🩺','🦷','💪','🎓','🧸',
            '📈','💳','🪙','👛','🎂','🥂','🐶','🐱',
            '👶','👥','🔧','🔨','✂️','🎬','🎫','🎵',
            '📦','🏷️','✨','❤️'
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
        };
        window.removeTag = function(idx) { triggerHaptic('light'); pendingTags.splice(idx, 1); window.renderTags(); };

        window.commitTagInput = function() {
            if (!tagInputField) return;
            const rawVal = tagInputField.value.trim();
            if (!rawVal) return;
            rawVal.split(',').map(k => k.trim()).filter(k => k).forEach(val => { if (!pendingTags.includes(val)) pendingTags.push(val); });
            tagInputField.value = '';
            window.renderTags();
        };

        tagInputField.addEventListener('keydown', (e) => {
            if (e.key === ',' || e.key === 'Enter') {
                e.preventDefault();
                window.commitTagInput();
            } else if (e.key === 'Backspace' && tagInputField.value === '' && pendingTags.length > 0) {
                pendingTags.pop(); window.renderTags();
            }
        });
        tagInputField.addEventListener('blur', () => window.commitTagInput());

        // ===================== FIX A =====================
        // Tính vùng nhìn THỰC = giao của #iconPickerBody với visualViewport
        // (bàn phím bật -> visualViewport.height co lại). Ưu tiên xử lý TRÀN ĐÁY
        // trước, nên luôn cuộn XUỐNG khi ô nhập bị bàn phím che.
        window.__ensureTagInputVisible = function() {
            try {
                const body = document.getElementById('iconPickerBody');
                const input = document.getElementById('tagInputField');
                if (!body || !input) return;

                const bodyRect = body.getBoundingClientRect();
                const inputRect = input.getBoundingClientRect();

                const vv = window.visualViewport;
                const vvTop = vv ? vv.offsetTop : 0;
                const vvBottom = vv ? (vv.offsetTop + vv.height) : window.innerHeight;

                const viewTop = Math.max(bodyRect.top, vvTop);
                const viewBottom = Math.min(bodyRect.bottom, vvBottom);
                const viewH = viewBottom - viewTop;

                if (viewH < 60) return; // vùng nhìn quá nhỏ -> bỏ qua, tránh cuộn loạn

                const pad = Math.min(16, viewH / 8);

                if (inputRect.bottom > viewBottom - pad) {
                    body.scrollTop += (inputRect.bottom - (viewBottom - pad));
                } else if (inputRect.top < viewTop + pad) {
                    body.scrollTop -= ((viewTop + pad) - inputRect.top);
                }
            } catch (_) {}
        };

        // ===================== FIX B =====================
        // Tap vùng tag -> focus + retry nhiều mốc thời gian (bàn phím iOS/Telegram
        // có thể bật muộn tới ~800ms).
        const tagBoxEl = tagInputField.parentElement; // .tag-input-container
        if (tagBoxEl) {
            tagBoxEl.style.cursor = 'text';

            const focusTagInput = (e) => {
                if (e && e.type === 'touchend') {
                    try { e.preventDefault(); } catch (_) {}
                    try { e.stopPropagation(); } catch (_) {}
                }

                try { tagInputField.click(); } catch (_) {}
                try { tagInputField.focus({ preventScroll: true }); }
                catch (_) { try { tagInputField.focus(); } catch (__) {} }

                const run = () => {
                    try { window.__ensureTagInputVisible && window.__ensureTagInputVisible(); } catch (_) {}
                };

                requestAnimationFrame(run);
                [60, 150, 300, 500, 800].forEach(t => setTimeout(run, t));
            };

            tagBoxEl.addEventListener('pointerup', (e) => {
                if (e.target && e.target.closest && e.target.closest('.tag-badge')) return;
                focusTagInput(e);
            });

            // CHỈ giữ touchend (bỏ touchstart) để tránh double-trigger trên iOS
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

        // Save/Delete handlers
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

                        await fetch(proxyUrl + encodeURIComponent(apiUrl), {
                            method: 'POST',
                            body: JSON.stringify({ action: 'deleteCategory', category: cat, sheetId: sheetId })
                        });

                        showToast('Đã xóa danh mục thành công!', 'success');
                        closeIconPickerModal();

                        await window.initCategories(false);
                        window.loadKeywords(false);

                        await invalidateCachesAndRefreshUI({ reason: 'deleteCategory' });
                    } catch(e) {
                        showToast('Lỗi xóa danh mục: ' + e.message, 'error');
                    } finally {
                        showLoading(false, 'tab3');
                    }
                }
            );
        };
    }

    setupIconGridCollapse();

    // ===================== FIX C =====================
    // Đưa khu vực TỪ KHÓA lên ngay dưới ô "Tên danh mục", TRƯỚC lưới icon.
    // Nhờ vậy khi bàn phím bật, ô nhập từ khóa luôn nằm trong tầm nhìn.
    try {
        if (tagArea && catInputGroup && catInputGroup.parentElement &&
            tagArea.previousElementSibling !== catInputGroup) {
            catInputGroup.parentElement.insertBefore(tagArea, catInputGroup.nextSibling);
        }
    } catch (_) {}

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
        // FIX 3b F-08: dọn ô "icon hiện tại" tổng hợp của lần gọi trước (nếu có)
        container.querySelectorAll('.icon-item.current-icon').forEach(el => el.remove());
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
            if (usedEmojis.includes(itemEmoji)) item.classList.add('disabled-icon');
            else item.classList.remove('disabled-icon');
        });

        modal.removeAttribute('data-selected-icon');
        if (!val) return;

        let currentIconVal = null;
        if (window.customCategoryIcons && window.customCategoryIcons[val]) currentIconVal = window.customCategoryIcons[val].trim();
        else if (window.categoryIconMap && window.categoryIconMap[val]) currentIconVal = window.categoryIconMap[val].trim();
        // FIX 3b F-08: đang SỬA một danh mục (gồm cả khi gõ tên mới để đổi tên)
        // -> mượn icon của danh mục gốc để luôn có icon được mang theo/chọn sẵn.
        if (!currentIconVal) {
            const origCat = (modal.getAttribute('data-original-category') || '').trim();
            if (origCat && origCat !== val) {
                if (window.customCategoryIcons && window.customCategoryIcons[origCat]) currentIconVal = window.customCategoryIcons[origCat].trim();
                else if (window.categoryIconMap && window.categoryIconMap[origCat]) currentIconVal = window.categoryIconMap[origCat].trim();
            }
        }

        if (currentIconVal) {
            let targetEmoji = currentIconVal;
            if (currentIconVal.includes('fa-')) {
                let faClass = currentIconVal.replace('fas ', '').trim();
                if (!faClass.startsWith('fa-')) faClass = 'fa-' + faClass;
                targetEmoji = FA_TO_EMOJI_MAP[faClass];
            }

            let item = targetEmoji ? Array.from(modal.querySelectorAll('.icon-item')).find(el => el.getAttribute('data-icon') === targetEmoji) : null;
            if (item) {
                item.classList.add('selected');
                item.classList.remove('disabled-icon');
                modal.setAttribute('data-selected-icon', item.getAttribute('data-icon'));
                if (container.firstChild !== item) container.insertBefore(item, container.firstChild);
                container.scrollTop = 0;
            } else {
                // FIX 3b F-08: icon đã lưu KHÔNG nằm trong lưới emoji (vd '❓'
                // của danh mục 'Khác', hoặc class FA không có ánh xạ emoji) ->
                // trước đây data-selected-icon bị để null nên nút Lưu chặn bằng
                // toast "Vui lòng chọn 1 icon!" dù người dùng không đổi icon.
                // Nay: chèn ô "icon hiện tại" đã-chọn ở đầu lưới và đặt
                // data-selected-icon = ĐÚNG giá trị đã lưu -> bấm Lưu ngay
                // được, icon giữ nguyên; chạm ô khác trong lưới vẫn đổi icon
                // như thường (handler chọn icon ghi đè thuộc tính này).
                modal.setAttribute('data-selected-icon', currentIconVal);
                const cur = document.createElement('div');
                cur.className = 'icon-item selected current-icon';
                cur.setAttribute('data-icon', (targetEmoji && !String(targetEmoji).includes('fa-')) ? targetEmoji : '❓');
                cur.textContent = (targetEmoji && !String(targetEmoji).includes('fa-')) ? targetEmoji : '❓';
                cur.title = 'Icon hiện tại';
                cur.onclick = function() {
                    triggerHaptic('light');
                    modal.querySelectorAll('.icon-item').forEach(i => i.classList.remove('selected'));
                    cur.classList.add('selected');
                    modal.setAttribute('data-selected-icon', currentIconVal);
                };
                container.insertBefore(cur, container.firstChild);
                container.scrollTop = 0;
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

            setTimeout(() => {
                try { catSelect.blur(); } catch (_) {}
                try { if (document.activeElement) document.activeElement.blur(); } catch (_) {}
            }, 0);
            requestAnimationFrame(() => {
                try { catSelect.blur(); } catch (_) {}
                try { if (document.activeElement) document.activeElement.blur(); } catch (_) {}
            });
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
// ============================================================================
// PERSONAL ROUND 4a — NHẬP NHANH KIỂU TIN NHẮN (port từ bản chính R54–R69).
// Parser, thread, render, popup, guide: giữ nguyên luật bản chính (tách dòng,
// ngày reset theo dòng R66, ngày trong ngoặc R67/R68, ghi chú ngoặc cuối R64,
// khớp danh mục kiểu webhook R60, ô gõ textarea R65, popup giữa màn hình R60
// + kết quả tách theo ngày R61, bong bóng đồng bộ bóng nút + R69).
// ĐIỂM CHUYỂN ĐỔI CHO BẢN CÁ NHÂN (không bê nguyên):
//  - Lưu qua submitTx bản cá nhân: id theo tháng (không phải id toàn cục),
//    thêm opts.quiet (xem submitTx) để lưu hàng loạt không toast/rung/
//    làm mới từng dòng; cuối cùng invalidate một lần (thay bước lọc cache
//    Tab 1 riêng của bản chính — invalidate đã xóa sạch cache ngày).
//  - Số tiền dòng phân tích dùng formatNumberWithCommas của bản cá nhân
//    (vi-VN -> dấu chấm); cờ ẩn số cùng tên isPrivacyActive nên tự che ***.
//  - Nút Đóng của popup đi qua fallback activateTab -> openTab (bản cá nhân
//    dùng openTab). Không thêm whatsnew (bản cá nhân đã bỏ).
// ============================================================================

function __qeNorm(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\u0111/g, 'd');
}

// Trả về số đồng (số nguyên) hoặc null nếu token không phải số tiền hợp lệ.
function __qeParseNumberToken(numStr, suffix) {
  var mult = 1;
  if (suffix === 'k' || suffix === 'nghìn') mult = 1000;
  else if (suffix === 'tr' || suffix === 'triệu') mult = 1000000;
  else if (suffix === 'm') mult = 1000000;
  var s = numStr;
  if (/^[.,]/.test(s) || /[.,]$/.test(s)) return null;
  if (/[.,]/.test(s)) {
    if (/^\d{1,3}([.,]\d{3})+$/.test(s)) {
      var grouped = parseInt(s.replace(/[.,]/g, ''), 10);
      if (!grouped) return null;
      return grouped * mult;
    }
    var dm = /^(\d+)[.,](\d{1,2})$/.exec(s);
    if (dm && mult > 1) {
      var dec = Math.round(parseFloat(dm[1] + '.' + dm[2]) * mult);
      return dec > 0 ? dec : null;
    }
    return null;
  }
  var v = parseInt(s, 10);
  if (!v) return null;
  return v * mult;
}

// Tìm token số tiền trong text. Trả về { value, token, index } hoặc null.
// token là đúng đoạn cần cắt khỏi nội dung (khi hậu tố bị loại vì dính chữ
// sau, token chỉ còn phần số, để khỏi ăn mất chữ của từ sau).
function __qeFindAmount(text) {
  // R58: hậu tố m/M = triệu như bot (vd "15m" = 15.000.000; dạng XmY
  // "1m5" = 1,5 triệu; "1,5m"/"1.5m" qua đường thập phân sẵn có).
  var re = /-?(?:\d+m\d+|\d[\d.,]*\s*(nghìn|triệu|k|tr|m|đ|₫)?)/gi;
  var lastBare = null, m;
  while ((m = re.exec(text)) !== null) {
    var raw = m[0];
    var after = text.charAt(m.index + raw.length);
    var afterNext = text.charAt(m.index + raw.length + 1);
    // Dạng XmY của bot: token phải đứng riêng — sau nó không được là
    // chữ/số, cũng không được là dấu . , rồi tới số (để khỏi ăn mất
    // phần thập phân của số khác). Không đạt thì bỏ qua token này.
    var xm = /^(-?)(\d+)m(\d+)$/i.exec(raw);
    if (xm) {
      if (/[a-zà-ỹ0-9]/i.test(after) || ((after === '.' || after === ',') && /[0-9]/.test(afterNext))) continue;
      var xv = parseFloat(xm[2] + '.' + xm[3]) * 1000000;
      if (xv > 0) return { value: Math.round(xv), token: raw, index: m.index };
      continue;
    }
    var numMatch = /-?[\d.,]+/.exec(raw);
    var numPart = numMatch[0];
    var sufRaw = raw.slice(numPart.length).trim().toLowerCase();
    var suffix = sufRaw;
    var token = raw;
    // Hậu tố 1-2 chữ mà dính ngay vào chữ sau ("50 trà sữa" -> "50 tr",
    // "15mua" -> "15 m") thì không phải hậu tố: loại hậu tố, token chỉ
    // còn phần số.
    if ((suffix === 'k' || suffix === 'tr' || suffix === 'm' || suffix === 'đ') && /[a-zà-ỹ]/i.test(after)) {
      suffix = '';
      token = numPart;
    }
    var numDigits = numPart.charAt(0) === '-' ? numPart.slice(1) : numPart;
    var val = __qeParseNumberToken(numDigits, suffix);
    if (val === null) continue;
    var strong = (suffix === 'k' || suffix === 'nghìn' || suffix === 'tr' || suffix === 'triệu' || suffix === 'm')
      || /^\d{1,3}([.,]\d{3})+$/.test(numDigits);
    var cand = { value: val, token: token, index: m.index };
    if (strong) return cand;
    lastBare = cand;
  }
  return lastBare;
}

function __qeDetectType(text) {
  var t = text.trim();
  if (t.charAt(0) === '+') return { type: 'Thu nhập', rest: t.slice(1).trim() };
  var m = /^(thu nhập|thu|chi tiêu|chi)(?=\s|:|$)\s*:?\s*/i.exec(t);
  if (m) {
    var w = m[1].toLowerCase();
    return { type: (w === 'thu' || w === 'thu nhập') ? 'Thu nhập' : 'Chi tiêu', rest: t.slice(m[0].length) };
  }
  if (/^(luong|nhan)\b/.test(__qeNorm(t))) return { type: 'Thu nhập', rest: t };
  return { type: 'Chi tiêu', rest: t };
}

// R60: escape ký tự regex trong từ khóa, đúng như webhook làm
// (kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).
function __qeEscapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// R60: khớp danh mục đúng luật webhook — lowercase giữ dấu, ranh giới từ,
// điểm = số từ, cao thắng, hòa thì gặp trước thắng. Không khớp -> ''.
function __qeMatchCategory(content, entries) {
  var desc = (content || '').toLowerCase().trim();
  if (!desc) return '';
  var best = '', bestScore = 0;
  (entries || []).forEach(function (e) {
    if (!e || !e.category) return;
    var kws = (e.keywords || '').split(',').map(function (k) { return k.trim().toLowerCase(); }).filter(Boolean);
    kws.forEach(function (kw) {
      var re = new RegExp('(?:^|\\s)' + __qeEscapeRegExp(kw) + '(?:\\s|$)', 'i');
      if (re.test(desc)) {
        var score = kw.split(/\s+/).length;
        if (score > bestScore) { best = e.category.trim(); bestScore = score; }
      }
    });
  });
  return best;
}

// Hàm thuần cho MỘT đoạn. entries: mảng { category, keywords }.
// Trả về { ok: true, amount, type, category, content, note, date } hoặc
// { ok: false, error }. dateStr: 'dd/mm/yyyy' (mặc định hôm nay).
function __qeParseSegment(seg, entries, dateStr) {
  var raw = (seg || '').trim().replace(/\s+/g, ' ');
  if (!raw) return { ok: false, error: 'Chưa nhập nội dung' };
  var det = __qeDetectType(raw);
  var work = det.rest;
  var amt = __qeFindAmount(work);
  if (!amt) return { ok: false, error: 'Chưa thấy số tiền trong tin nhắn' };
  var content = (work.slice(0, amt.index) + work.slice(amt.index + amt.token.length)).replace(/\s+/g, ' ').trim();
  // R64: ghi chú trong ngoặc ở cuối đoạn — đúng luật webhook (regex
  // ...\((.+?)\)$): nhóm (...) CUỐI CÙNG thành note, phần trước là nội
  // dung; ngoặc giữa câu không ở cuối thì ở lại trong nội dung; "()"
  // rỗng thì không tách (không lỗi). Chỉ tách khi phần trước còn nội
  // dung — để "500k (mua đồ)" giữ "(mua đồ)" làm nội dung như webhook
  // (regex của bot cũng đòi description dài ≥ 1 ký tự).
  var note = '';
  var nm = /\(([^()]*)\)\s*$/.exec(content);
  if (nm && nm[1].trim() && content.slice(0, nm.index).trim()) {
    note = nm[1].trim();
    content = content.slice(0, nm.index).trim();
    if (note) note = note.charAt(0).toUpperCase() + note.slice(1);
  }
  content = content.replace(/\s+-\s*$/, '').replace(/^\s*-\s+/, '').trim();
  var category = __qeMatchCategory(content, entries);
  if (!content && category) content = category;
  // R57: viết hoa chữ cái đầu của nội dung như webhook làm với description
  // (description.charAt(0).toUpperCase() + description.slice(1)); chữ số /
  // ký tự đặc biệt ở đầu giữ nguyên; bong bóng tin vẫn giữ văn bản gốc.
  if (content) content = content.charAt(0).toUpperCase() + content.slice(1);
  return { ok: true, amount: amt.value, type: det.type, category: category, content: content, note: note, date: dateStr || formatDateToDDMMYYYY(new Date()) };
}

// Giữ tương thích R54: parse 1 đoạn duy nhất, ngày hôm nay.
function parseQuickMessage(text, entries) {
  return __qeParseSegment(text, entries, formatDateToDDMMYYYY(new Date()));
}

// R56: TÁCH TRƯỚC, rồi parse từng đoạn riêng — đúng luật bot trong file
// webhook (Cloudflare Worker v3.1): tách tin theo xuống dòng, rồi tách mỗi
// dòng theo /\.(?=\s|$)/ (chấm + khoảng trắng hoặc cuối chuỗi — nên
// "50.000" không bị tách, "50k ăn trưa.7k gửi xe" không bị tách vì chấm
// không kèm khoảng trắng). R66 SỬA LUẬT NGÀY (theo yêu cầu rõ của Hùng,
// thay luật R65): ngày-context RESET Ở MỖI RANH GIỚI DÒNG — dòng không
// có ngày mặc định về hôm nay, kể cả khi dòng trước mang ngày; đoạn mở
// đầu bằng dd/mm chỉ đặt ngày-context cho chính nó và các đoạn sau
// trong CÙNG DÒNG đó. (Miniapp nới thêm: đoạn chỉ có ngày thì chỉ đặt
// context, không sinh khoản.) Lưu ý trung thực: code webhook giữ một
// contextDate sống xuyên suốt cả tin — nhưng Hùng đã chốt luật reset
// theo dòng cho miniapp vì thừa hưởng xuyên dòng khó đoán với tin nhiều
// dòng, nên miniapp làm theo luật của Hùng, không theo code webhook ở
// điểm này.
function __qeSplitMessage(text) {
  var segs = [];
  (text || '').split('\n').forEach(function (line) {
    line.split(/\.(?=\s|$)/).forEach(function (p) {
      var s = p.trim();
      if (s) segs.push(s);
    });
  });
  return segs;
}
function __qeParseMessageMulti(text, entries, defaultDate) {
  var today = formatDateToDDMMYYYY(new Date());
  var base = defaultDate || today;
  var year = String(new Date().getFullYear());
  var items = [];
  // R66: duyệt từng DÒNG riêng — ctxDate reset về null (→ base = hôm nay)
  // ở đầu mỗi dòng, chỉ sống trong các đoạn của dòng đó.
  (text || '').split('\n').forEach(function (line) {
    var ctxDate = null;
    line.split(/\.(?=\s|$)/).forEach(function (p) {
      var seg = p.trim();
      if (!seg) return;
      var dm = /^(\d{1,2})\/(\d{1,2})(?:\s+(.*))?$/.exec(seg);
      if (dm) {
        var d = parseInt(dm[1], 10), mo = parseInt(dm[2], 10);
        if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) {
          ctxDate = String(d).padStart(2, '0') + '/' + String(mo).padStart(2, '0') + '/' + year;
          var rest = (dm[3] || '').trim();
          if (!rest) return; // đoạn chỉ có ngày: đặt context, không sinh khoản
          seg = rest;
        }
      }
      var r = __qeParseSegment(seg, entries, ctxDate || base);
      r.segment = seg;
      items.push(r);
    });
  });
  if (!items.length) items.push({ ok: false, error: 'Chưa thấy số tiền trong tin nhắn', segment: (text || '').trim() });
  return items;
}

// ---- Lớp giao diện R55/R57: khung chat nhập hàng loạt (thay sheet xem trước từng dòng của R54) ----
// R56: mỗi tin nhắn tách thành N khoản (theo luật bot) — thread giữ nhóm tin,
// lưu chạy theo khoản. Parser từng đoạn giữ nguyên quy tắc R54.
// R57: BỎ hẳn màn xem trước tổng — thread CHÍNH LÀ bản xem trước; nút đầu
// là "Lưu (M)" ghi tuần tự qua submitTx. Dòng chưa hợp lệ không bị mất —
// vẫn giữ trong thread để sửa.
// Nguyên tắc R55: gửi tin
// KHÔNG BAO GIỜ mở modal chặn luồng; mỗi tin hiện ngay trong thread kèm dòng
// phân tích gọn; dòng chưa hợp lệ không bị mất — vẫn giữ trong thread để sửa.

var __qeThread = [];
var __qeNextId = 1;
var __qeNextItemId = 1;
var __qeCatCache = null;
var __qeSaving = false;
// R59: KHÔNG còn ngày tham chiếu phiên chat — chip R57 đã bị gỡ vì sai.
// Webhook (Worker v3.1) khởi tạo contextDate = hôm nay trong TỪNG message
// handler, nên mỗi tin nhắn mới đều bắt đầu ở hôm nay. R66: ngày chỉ lan
// sang các đoạn SAU trong CÙNG DÒNG — qua ranh giới dòng là reset về
// hôm nay (luật Hùng chốt, thay luật R65 thừa hưởng xuyên dòng). Không
// có state ngày nào sống qua ranh giới tin nhắn.
var __qeNotices = [];

// --- Logic thuần (không chạm DOM) — test được trong VM ---
// R56: mỗi tin nhắn là một NHÓM chứa N khoản (items) sau khi tách.
// Item: { id, segment, ok, error, amount, type, category, content, date, saveError }.
function __qeNewMessage(text, entries) {
  var m = { id: __qeNextId++, text: text, editing: false, items: [] };
  // R59: mỗi tin nhắn mới bắt đầu ngày-context ở HÔM NAY — đúng webhook,
  // bất kể tin trước đó mang ngày nào. R66: ngày chỉ lan trong cùng
  // DÒNG, qua dòng là reset về hôm nay.
  var base = formatDateToDDMMYYYY(new Date());
  __qeParseMessageMulti(text, entries, base).forEach(function (r) {
    m.items.push({ id: __qeNextItemId++, segment: r.segment || text, ok: !!r.ok, error: r.error || '', amount: r.ok ? r.amount : 0, type: r.ok ? r.type : 'Chi tiêu', category: r.ok ? r.category : '', content: r.ok ? r.content : '', note: r.ok ? (r.note || '') : '', date: r.ok ? r.date : base, saveError: false });
  });
  return m;
}
function __qeAddMessage(text, entries) { var m = __qeNewMessage(text, entries); __qeThread.push(m); return m; }
function __qeValid(it) { return !!(it.ok && it.amount > 0 && it.content && it.category); }
function __qeFlatItems() { var out = []; __qeThread.forEach(function (m) { m.items.forEach(function (it) { out.push(it); }); }); return out; }
function __qeCounts() {
  var items = __qeFlatItems(), v = 0;
  items.forEach(function (it) { if (__qeValid(it)) v++; });
  return { total: items.length, valid: v, invalid: items.length - v };
}
function __qeFindItem(id) { var found = null; __qeThread.forEach(function (m) { m.items.forEach(function (it) { if (it.id === id) found = it; }); }); return found; }
function __qeRemoveMessage(id) { __qeThread = __qeThread.filter(function (m) { return m.id !== id; }); }
function __qeRemoveItem(id) {
  __qeThread.forEach(function (m) { m.items = m.items.filter(function (it) { return it.id !== id; }); });
  __qeThread = __qeThread.filter(function (m) { return m.items.length; });
}
function __qeBuildTx(it) { return { content: it.content, amount: it.amount, type: it.type, category: it.category, note: it.note || '', date: it.date, action: 'addTransaction' }; }
function __qeReparseMessage(m, entries) {
  var fresh = __qeNewMessage(m.text, entries);
  m.items = fresh.items;
  return m;
}

// --- Lớp DOM ---
function __qeAmtText(amount) {
  if (typeof isPrivacyActive !== 'undefined' && isPrivacyActive) return '***';
  return formatNumberWithCommas(String(amount)) + ' ₫';
}
function __qeCatOptions(selected) {
  var opts = '<option value="">— Chọn danh mục —</option>';
  (__qeCatCache || []).forEach(function (c) {
    opts += '<option value="' + escapeHTML(c) + '"' + (c === selected ? ' selected' : '') + '>' + escapeHTML(c) + '</option>';
  });
  return opts;
}
function __qeEnsureCats() {
  if (__qeCatCache) return;
  try {
    fetchCategories().then(function (cats) {
      __qeCatCache = cats || [];
      if (!__qeThread.some(function (m) { return m.editing; })) {
        __qeRenderThread();
      }
    });
  } catch (e) {}
}
function __qeParseLine(it) {
  // R67: MỌI dòng phân tích đều kết thúc bằng đoạn ngày. R68: ngày viết
  // hoa và cho vào ngoặc — "· (Hôm nay)", "· (dd/mm/yyyy)".
  // Trước đây chỉ hiện ngày khi khác hôm nay nên "không ngày" mập mờ:
  // không phân biệt được "ghi cho hôm nay" hay "mất ngày".
  var today = formatDateToDDMMYYYY(new Date());
  var d = it.date || today;
  var dateSeg = ' · (' + (d === today ? 'Hôm nay' : escapeHTML(d)) + ')';
  if (!it.ok) return '<div class="qe-parseline qe-flag">⚠ ' + escapeHTML(it.error) + dateSeg + '</div>';
  var line = escapeHTML(it.type) + ' · ' + __qeAmtText(it.amount) + (it.category ? ' · ' + escapeHTML(it.category) : '') + (it.content ? ' · ' + escapeHTML(it.content) : '') + (it.note ? ' · (' + escapeHTML(it.note) + ')' : '') + dateSeg;
  var flag = '';
  if (!it.category) flag = '<div class="qe-parseline qe-flag">⚠ Chưa có danh mục — chọn bên dưới để lưu được.</div>';
  if (it.saveError) flag += '<div class="qe-parseline qe-flag">⚠ Lưu lỗi — vẫn giữ trong khung chat, bấm Lưu tất cả để thử lại.</div>';
  return '<div class="qe-parseline">' + line + '</div>' + flag;
}
function __qeRenderMsg(m) {
  var bubble;
  if (m.editing) {
    bubble = '<div class="qe-bubble-edit"><textarea id="qeEditInput_' + m.id + '" class="field-input" style="margin:0; resize:none;" rows="3">' + escapeHTML(m.text) + '</textarea>'
      + '<div style="display:flex;gap:8px;margin-top:8px;"><button type="button" class="btn-save flex-1 m-0" onclick="quickEntrySaveEdit(' + m.id + ')">Lưu sửa</button>'
      + '<button type="button" class="btn-cancel flex-1 m-0" onclick="quickEntryCancelEdit(' + m.id + ')">Hủy</button></div></div>';
  } else {
    bubble = '<div class="qe-bubble">' + escapeHTML(m.text) + '</div>'
      + '<div class="qe-msg-actions"><button type="button" onclick="quickEntryEditMsg(' + m.id + ')">Sửa</button>'
      + '<button type="button" onclick="quickEntryRemoveMsg(' + m.id + ')">✕ Xóa</button></div>';
  }
  var body = '';
  m.items.forEach(function (it) {
    body += __qeParseLine(it);
    if (it.ok && !it.category) {
      body += '<select class="field-input qe-cat-select" onchange="quickEntrySetMsgCategory(' + it.id + ', this.value)">' + __qeCatOptions('') + '</select>';
    }
  });
  return '<div class="qe-msg">' + bubble + body + '</div>';
}
function __qeRenderThread() {
  var th = document.getElementById('quickEntryThread'); if (!th) return;
  // R57: thread CHÍNH LÀ bản xem trước — nút đầu là Lưu, đếm khoản HỢP LỆ.
  // R59: nút Lưu giữ trạng thái khóa trong lúc đang lưu (đề phòng render
  // chen ngang khi fetch danh mục xong) — chống bấm đúp.
  var btn = document.getElementById('quickEntrySaveBtn');
  var c0 = __qeCounts();
  if (btn) { btn.textContent = 'Lưu (' + c0.valid + ')'; btn.disabled = __qeSaving || c0.valid === 0; }
  // R59: dòng hệ thống (thông báo kết quả lưu kiểu webhook) luôn vẽ sau
  // các tin nhắn, kể cả khi thread đã trống sau khi lưu xong.
  var notices = __qeNotices.map(function (n) { return '<div class="qe-system">' + escapeHTML(n) + '</div>'; }).join('');
  if (!__qeThread.length) {
    th.innerHTML = '<div class="qe-empty"><strong><i class="fas fa-book-open qe-guide-icon"></i>HƯỚNG DẪN NHẬP DỮ LIỆU:</strong><br>Nhập tin nhắn theo cú pháp để app tự động ghi nhận:<br><br><strong><i class="fas fa-lightbulb qe-guide-icon"></i>MẸO NHẬP SỐ TIỀN:</strong><br>• Nhập đầy đủ: 50000 = 50.000 VNĐ<br>• Dùng chữ tắt: k = nghìn, m = triệu<br>• VD: 50k = 50.000 • 1m5 = 1.500.000 • 2m = 2.000.000<br>──────────────<br><strong>1. Chi tiêu cơ bản (Hôm nay)</strong><br>Cú pháp: [Số tiền] [Nội dung]<br><i class="fas fa-arrow-right qe-guide-icon"></i>VD: 50k ăn trưa hoặc 50000 ăn trưa<br><br><strong>2. Chi tiêu theo ngày cụ thể</strong><br>Cú pháp: [Ngày/Tháng] [Số tiền] [Nội dung]<br><i class="fas fa-arrow-right qe-guide-icon"></i>VD: 12/06 1m5 đóng tiền nhà<br><br><strong>3. Thêm ghi chú</strong><br>Cú pháp: ... [Nội dung] (Ghi chú)<br><i class="fas fa-arrow-right qe-guide-icon"></i>VD: 500k siêu thị (mua đồ cả tuần)<br><br><strong>4. Thu nhập</strong><br>Thêm dấu + trước số tiền.<br><i class="fas fa-arrow-right qe-guide-icon"></i>VD: +10m lương tháng<br>──────────────<br>Nhiều khoản trong 1 tin, cách nhau bằng dấu chấm: 50k ăn trưa. 7k gửi xe.</div>' + notices;
    return;
  }
  th.innerHTML = __qeThread.map(__qeRenderMsg).join('') + notices;
  th.scrollTop = th.scrollHeight;
}

// R65: ô gõ đa dòng — textarea tự cao dần theo nội dung (tối đa ~5
// dòng rồi cuộn trong), KHÔNG chặn Enter (Enter xuống dòng theo hành vi
// mặc định của textarea, kể cả khi đang gõ IME; gửi chỉ qua nút
// paper-plane). Gắn 1 lần, guard cho VM test không có DOM thật.
function __qeAutoresizeComposer() {
  var inp = document.getElementById('quickEntryInput'); if (!inp) return;
  try {
    inp.style.height = 'auto';
    var max = 120;
    inp.style.height = Math.min(inp.scrollHeight, max) + 'px';
    inp.style.overflowY = (inp.scrollHeight > max) ? 'auto' : 'hidden';
  } catch (e) {}
}
try {
  if (typeof document !== 'undefined') {
    var __qeInp0 = document.getElementById('quickEntryInput');
    if (__qeInp0 && __qeInp0.addEventListener && !__qeInp0.__qeResizeBound) {
      __qeInp0.addEventListener('input', __qeAutoresizeComposer);
      __qeInp0.__qeResizeBound = true;
    }
  }
} catch (e) {}

// PERSONAL ROUND 4b — KHÓA CUỘN TRANG NỀN KHI KHUNG CHAT MỞ (theo mẫu
// 3w của modal chi tiết ngày: lockDetailModalScroll). Vấn đề Hùng báo:
// mở khung chat rồi vuốt ở vùng ngoài khung thì màn hình bên dưới vẫn bị
// cuộn theo — vì app chưa từng khóa cuộn nền khi mở modal (overlay chỉ
// che chạm, không chặn cuộn: kéo trên overlay vẫn cuộn được trang dưới,
// cuộn thread tới đáy cũng chain xuống body). Khóa: html+body overflow
// hidden + thread overscroll contain + pan-y (thread vẫn tự cuộn được).
// Trạng thái riêng (__qeScrollLock, không dùng chung với detail modal) để
// hai khóa không ghi đè prev của nhau nếu lỡ mở chồng. Mở khóa TRƯỚC mọi
// thứ trong nhánh đóng đã xác nhận (như closeDetailModal) để không rò rỉ
// khóa nếu haptic/render sau đó ném lỗi; đóng qua hộp xác nhận mà bấm Hủy
// thì khóa Ở NGUYÊN vì khung vẫn mở.
var __qeScrollLock = null;
function lockQuickEntryScroll() {
  if (__qeScrollLock && __qeScrollLock.active) return;
  var scrollEl = null;
  try { scrollEl = document.getElementById('quickEntryThread'); } catch (e) { scrollEl = null; }
  __qeScrollLock = {
    active: true,
    savedY: (typeof window.scrollY === 'number') ? window.scrollY : 0,
    prevBodyOverflow: document.body ? document.body.style.overflow : '',
    prevDocOverflow: document.documentElement ? document.documentElement.style.overflow : '',
    prevScrollOverscroll: scrollEl ? scrollEl.style.overscrollBehavior : '',
    prevScrollTouch: scrollEl ? scrollEl.style.touchAction : '',
    scrollEl: scrollEl
  };
  try {
    if (document.documentElement) document.documentElement.style.overflow = 'hidden';
    if (document.body) document.body.style.overflow = 'hidden';
    if (scrollEl) { scrollEl.style.overscrollBehavior = 'contain'; scrollEl.style.touchAction = 'pan-y'; }
  } catch (e) {}
  window.__qeScrollLockState = __qeScrollLock;
}
function unlockQuickEntryScroll() {
  var st = __qeScrollLock;
  if (!st || !st.active) return;
  st.active = false;
  try {
    if (document.documentElement) document.documentElement.style.overflow = st.prevDocOverflow;
    if (document.body) document.body.style.overflow = st.prevBodyOverflow;
    if (st.scrollEl) { st.scrollEl.style.overscrollBehavior = st.prevScrollOverscroll; st.scrollEl.style.touchAction = st.prevScrollTouch; }
  } catch (e) {}
  try {
    if (typeof window.scrollY === 'number' && window.scrollY !== st.savedY) window.scrollTo(0, st.savedY);
  } catch (e) {}
}

window.openQuickEntry = function () {
  lockQuickEntryScroll();
  try { triggerHaptic('light'); } catch (e) {}
  var tv = document.getElementById('quickEntryThreadView'); if (tv) tv.style.display = 'flex';
  var ov = document.getElementById('modalOverlay'); if (ov) ov.classList.add('show');
  setTimeout(function () { var s = document.getElementById('quickEntryModal'); if (s) s.classList.add('show'); }, 10);
  __qeRenderThread();
  var inp = document.getElementById('quickEntryInput');
  if (inp) {
    if (inp.addEventListener && !inp.__qeResizeBound) {
      inp.addEventListener('input', __qeAutoresizeComposer);
      inp.__qeResizeBound = true;
    }
    __qeAutoresizeComposer();
    setTimeout(function () { inp.focus(); }, 350);
  }
};

window.closeQuickEntry = function (force, afterClose) {
  var remaining = __qeCounts().total;
  if (!force && remaining) {
    showCustomConfirm('Đóng khung nhập nhanh',
      'Còn <strong>' + remaining + ' dòng</strong> chưa lưu, đóng sẽ mất. Bạn có muốn đóng không?',
      'Đóng', function () { window.closeQuickEntry(true, afterClose); });
    return;
  }
  unlockQuickEntryScroll(); // 4b: mở khóa TRƯỚC mọi thứ — không rò rỉ khóa nếu render sau đó ném lỗi
  __qeThread = []; __qeSaving = false; __qeNotices = [];
  // R60: đóng khung cũng giấu popup lưu nếu còn hiện (phòng trường hợp
  // đóng bằng đường khác ngoài nút "Đóng" của popup).
  try { var sp = document.getElementById('quickEntrySavePopup'); if (sp) sp.style.display = 'none'; } catch (e) {}
  // R58: vẽ lại thread sau khi dọn để DOM khớp dữ liệu (trước đây DOM cũ
  // vẫn còn cho tới lần mở sau, dù dữ liệu đã trống).
  try { __qeRenderThread(); } catch (e) {}
  var s = document.getElementById('quickEntryModal'); if (s) s.classList.remove('show');
  setTimeout(function () { var ov = document.getElementById('modalOverlay'); if (ov) ov.classList.remove('show'); }, 300);
  var inp = document.getElementById('quickEntryInput'); if (inp) { inp.value = ''; __qeAutoresizeComposer(); }
  // R61: callback chạy sau khi đóng (nút "Đóng" của popup lưu dùng để quay
  // về Tab 1); các đường đóng khác không truyền callback nên không đổi.
  if (typeof afterClose === 'function') { try { afterClose(); } catch (e) {} }
};

// PERSONAL ROUND 4b — CHỈ NÚT ✕ MỚI TẮT ĐƯỢC KHUNG CHAT (Hùng chốt).
// Chạm overlay (vùng ngoài khung) không đóng khung, bấm handle cũng không.
// Vì vậy wrap closeAllModals: khi khung chat đang mở thì NUỐT LUÔN lệnh
// đóng — không được chạy closeAllModals gốc, vì closeDetailModal trong đó
// sẽ gỡ overlay sau 300ms dù khung chat vẫn mở (khung trơ không có lớp
// mờ, màn nền lại bấm/vuốt được — đúng lỗi Hùng báo). Khi khung không mở,
// wrap đi qua bình thường. Nút Đóng trong popup lưu vẫn đóng khung + về
// Tab 1 như cũ (đó là nút kết thúc luồng lưu, không phải đường tắt khung).
(function () {
  var prevCloseAllModals = window.closeAllModals;
  window.closeAllModals = function () {
    try {
      var s = document.getElementById('quickEntryModal');
      if (s && s.classList.contains('show')) return;
    } catch (e) {}
    try { if (typeof prevCloseAllModals === 'function') prevCloseAllModals(); } catch (e) {}
  };
})();

async function __qeLoadKeywordEntries() {
  try {
    if (cachedKeywords && cachedKeywords.length) return cachedKeywords;
    if (typeof window.loadKeywords === 'function') { await window.loadKeywords(true); return cachedKeywords || []; }
  } catch (e) {}
  return [];
}

// Gửi 1 tin: KHÔNG mở modal, chỉ thêm vào thread và dọn ô gõ để nhập tiếp.
window.quickEntrySend = async function () {
  var inp = document.getElementById('quickEntryInput');
  var text = inp ? inp.value.trim() : '';
  if (!text) return;
  var entries = await __qeLoadKeywordEntries();
  __qeAddMessage(text, entries);
  if (inp) { inp.value = ''; __qeAutoresizeComposer(); }
  __qeRenderThread();
  __qeEnsureCats();
  if (inp) inp.focus();
};

window.quickEntryRemoveMsg = function (id) {
  __qeRemoveMessage(id);
  __qeRenderThread();
};
window.quickEntrySetMsgCategory = function (id, category) {
  var it = __qeFindItem(id);
  if (it) { it.category = category; it.saveError = false; }
  __qeRenderThread();
};
window.quickEntryEditMsg = function (id) {
  __qeThread.forEach(function (m) { m.editing = (m.id === id); });
  __qeRenderThread();
  var el = document.getElementById('qeEditInput_' + id);
  if (el) { el.focus(); el.setSelectionRange(el.value.length, el.value.length); }
};
window.quickEntryCancelEdit = function (id) {
  __qeThread.forEach(function (m) { if (m.id === id) m.editing = false; });
  __qeRenderThread();
};
window.quickEntrySaveEdit = async function (id) {
  var el = document.getElementById('qeEditInput_' + id);
  var m = null;
  __qeThread.forEach(function (x) { if (x.id === id) m = x; });
  if (!m) return;
  var text = el ? el.value.trim() : '';
  if (text) m.text = text;
  m.editing = false;
  var entries = await __qeLoadKeywordEntries();
  __qeReparseMessage(m, entries);
  __qeRenderThread();
  __qeEnsureCats();
};

// R60: popup lưu GIỮA MÀN HÌNH thay cho spin/đếm trong thread của R59
// (Hùng: "Spin lúc chờ lưu nó là show popup giữa màn hình chứ. Icon tick
// phải dạng flat."). Popup z-index 2500: trên sheet chat (2000) và overlay
// (1500), dưới trang fullscreen (3000) và sheet nhập CSV (3500); lớp phủ
// chặn tương tác trong lúc lưu nên không bấm đúp được. Xong: CÙNG popup
// chuyển sang tick FLAT (SVG 1 màu, không emoji, không gradient, không
// bóng) + "Đã lưu N giao dịch" (+ dòng lỗi/chưa hợp lệ nếu có) và ĐỨNG
// YÊN tới khi user bấm "Đóng" (R61 đổi nhãn từ "Đã hiểu", bấm thì đóng
// luôn khung chat và quay về Tab 1) — không tự tắt để khỏi giấu dòng lỗi.
// Popup này LÀ thông báo lưu nên dòng hệ thống trong thread của R59 bị gỡ
// để khỏi thông báo trùng 2 lần cho cùng 1 lần lưu (dòng lỗi/chưa hợp lệ
// vẫn giữ trong thread, gắn cờ như trước).
function __qeShowSavePopup() {
  var p = document.getElementById('quickEntrySavePopup'); if (!p) return;
  var ic = document.getElementById('quickEntrySavePopupIcon');
  var tx = document.getElementById('quickEntrySavePopupText');
  var btn = document.getElementById('quickEntrySavePopupBtn');
  if (ic) ic.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i>';
  if (tx) tx.textContent = '';
  if (btn) btn.style.display = 'none';
  p.style.display = 'flex';
}
function __qeUpdateSavePopupCount(i, n) {
  var tx = document.getElementById('quickEntrySavePopupText');
  if (tx) tx.textContent = 'Đang lưu ' + i + '/' + n + '…';
}
function __qeShowSavePopupDone(saved, failed, invalid, savedByDate) {
  var p = document.getElementById('quickEntrySavePopup'); if (!p) return;
  var ic = document.getElementById('quickEntrySavePopupIcon');
  var tx = document.getElementById('quickEntrySavePopupText');
  var btn = document.getElementById('quickEntrySavePopupBtn');
  // Tick FLAT: SVG 1 màu #10B981, không emoji, không gradient, không bóng.
  if (ic) ic.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" stroke="#10B981" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  if (tx) {
    var lines = [];
    // R61: kết quả lưu TÁCH THEO NGÀY — nguyên tắc webhook (mỗi giao dịch
    // xác nhận kèm "📅 Ngày:" của nó) áp cho dạng tổng: hôm nay trước,
    // rồi các ngày khác tăng dần; chỉ đếm khoản ghi THÀNH CÔNG theo ngày
    // (khoản lưu lỗi rơi vào dòng ⚠️, không vào dòng ngày nào).
    // Lưu ý trung thực: webhook KHÔNG có chuỗi tổng gom nhóm theo ngày —
    // nó xác nhận từng giao dịch kèm ngày riêng; đây là dạng tổng theo
    // đúng yêu cầu của Hùng, giữ nguyên tắc "ngày nào ra ngày đó".
    var map = savedByDate || {};
    var dates = Object.keys(map).filter(function (d) { return map[d] > 0; });
    if (dates.length) {
      var todayStr = formatDateToDDMMYYYY(new Date());
      var key = function (d) { var a = String(d).split('/'); return (parseInt(a[2], 10) || 0) * 10000 + (parseInt(a[1], 10) || 0) * 100 + (parseInt(a[0], 10) || 0); };
      dates.sort(function (a, b) { return key(a) - key(b); });
      if (map[todayStr]) lines.push('Đã lưu ' + map[todayStr] + ' giao dịch cho hôm nay');
      dates.forEach(function (d) { if (d !== todayStr) lines.push('Đã lưu ' + map[d] + ' giao dịch cho ngày ' + d); });
    } else if (saved > 0) {
      lines.push('Đã lưu ' + saved + ' giao dịch');
    }
    if (failed > 0) lines.push('⚠️ ' + failed + ' dòng lưu lỗi, vẫn giữ trong khung chat để sửa');
    if (invalid > 0) lines.push('⚠️ ' + invalid + ' dòng chưa hợp lệ chưa được lưu');
    tx.textContent = lines.join('\n');
  }
  if (btn) btn.style.display = 'block';
  p.style.display = 'flex';
}
// R61: nút "Đóng" của popup lưu — đóng khung chat rồi quay về Tab 1 để
// xem ngay dữ liệu vừa lưu. Đi qua closeQuickEntry nên hộp xác nhận vẫn
// bảo vệ các dòng chưa lưu còn lại: không còn dòng chưa lưu thì đóng
// thẳng về Tab 1; còn thì hộp xác nhận hiện trước, chỉ khi xác nhận đóng
// mới về Tab 1; bấm hủy thì khung chat ở nguyên, popup vẫn hiện kết quả.
window.quickEntryCloseFromSavePopup = function () {
  window.closeQuickEntry(false, function () {
    try {
      if (typeof window.activateTab === 'function') window.activateTab('tab1');
      else if (typeof window.openTab === 'function') window.openTab('tab1');
    } catch (e) {}
  });
};

// R57 (port 4a): Lưu từ thread (không còn màn xem trước tổng). Ghi TUẦN
// TỰ các khoản hợp lệ (cấp id theo tháng của bản cá nhân bắt buộc tuần tự,
// không song song — mỗi lần lưu đổi file tháng mà lần cấp id sau đọc).
// R59: nút Lưu khóa chống bấm đúp; KHÔNG toast tổng kết.
// R60: tiến trình + kết quả qua popup giữa màn hình (xem trên).
window.quickEntrySave = async function () {
  if (__qeSaving) return;
  var rows = __qeFlatItems().filter(__qeValid);
  if (!rows.length) { try { showToast('Chưa có dòng hợp lệ để lưu', 'info'); } catch (e) {} return; }
  __qeSaving = true;
  var btn = document.getElementById('quickEntrySaveBtn'); if (btn) btn.disabled = true;
  __qeShowSavePopup();
  var saved = 0, failed = 0, savedByDate = {};
  for (var i = 0; i < rows.length; i++) {
    __qeUpdateSavePopupCount(i + 1, rows.length);
    var ok = false;
    try { ok = await submitTx(__qeBuildTx(rows[i]), { quiet: true }); } catch (e) { ok = false; }
    if (ok) { saved++; rows[i]._saved = true; var d = rows[i].date; savedByDate[d] = (savedByDate[d] || 0) + 1; } else { failed++; rows[i].saveError = true; }
  }
  __qeThread.forEach(function (m) { m.items = m.items.filter(function (it) { return !it._saved; }); });
  __qeThread = __qeThread.filter(function (m) { return m.items.length; });
  __qeThread.forEach(function (m) { m.items.forEach(function (it) { delete it._saved; }); });
  // 4a: bản cá nhân không cần bước lọc cache riêng như bản chính — invalidate
  // xóa sạch dayTxCache/apiTxCache/monthDataCache và tải lại tab đang mở.
  try { await invalidateCachesAndRefreshUI({ reason: 'quickEntrySave' }); } catch (e) {}
  // R58: lưu hàng loạt chỉ rung 1 lần cuối khi có dòng lưu thành công
  // (submitTx quiet đã tắt haptic từng dòng).
  if (saved > 0) { try { triggerHapticNotification('success'); } catch (e) {} }
  __qeSaving = false;
  var c = __qeCounts();
  __qeShowSavePopupDone(saved, failed, c.invalid, savedByDate);
  __qeRenderThread();

};

// Hook cho test Node (không ảnh hưởng hành vi bản cá nhân).
window.__quickEntryTest = {
  parseQuickMessage: parseQuickMessage,
  __qeParseNumberToken: __qeParseNumberToken,
  __qeFindAmount: __qeFindAmount,
  __qeDetectType: __qeDetectType,
  __qeMatchCategory: __qeMatchCategory,
  addMessage: __qeAddMessage,
  reparseMessage: __qeReparseMessage,
  removeMessage: __qeRemoveMessage,
  buildTx: __qeBuildTx,
  isValid: __qeValid,
  counts: __qeCounts,
  splitQuickMessage: __qeSplitMessage,
  parseMessageMulti: __qeParseMessageMulti,
  getThread: function () { return __qeThread; },
  getItems: __qeFlatItems,
  removeItem: __qeRemoveItem,
  findItem: __qeFindItem,
  clearThread: function () { __qeThread = []; __qeNextId = 1; __qeNextItemId = 1; __qeNotices = []; },
  getNotices: function () { return __qeNotices.slice(); },
  renderThread: __qeRenderThread,
  showSavePopupDone: __qeShowSavePopupDone,
  getSavePopup: function () {
    var p = document.getElementById('quickEntrySavePopup');
    var t = document.getElementById('quickEntrySavePopupText');
    var ic = document.getElementById('quickEntrySavePopupIcon');
    var b = document.getElementById('quickEntrySavePopupBtn');
    return { display: p ? p.style.display : undefined, text: t ? t.textContent : undefined,
      icon: ic ? ic.innerHTML : undefined, btnDisplay: b ? b.style.display : undefined };
  },
};