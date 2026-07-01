// ============================================================================
// app-crud.js — TỪ KHÓA, DANH MỤC, CRUD GIAO DỊCH & ICON PICKER
// ----------------------------------------------------------------------------
// Vai trò: Tab 3 (quản lý từ khóa: tải, hiển thị, sửa/hủy), nạp danh mục,
//   thêm/sửa/xóa giao dịch (modal Add/Edit), sinh mã giao dịch, ghi/đọc
//   Firebase + đồng bộ Google Sheet (GAS), và cửa sổ ICON PICKER (cấu hình
//   danh mục + icon + từ khóa).
// ============================================================================

// ---------------- TAB TỪ KHÓA ----------------
window.loadKeywords = async function(isInit = false) {
    if(!isInit) showLoading(true, 'tab3');
    if(!isInit) document.getElementById('keywordsContainer').innerHTML = '';
    try {
        const res = await fetch(`${FIREBASE_URL}/categories.json`); let raw = await res.json();
        if(!raw) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getKeywords&sheetId=${sheetId}`)); raw = await gasRes.json(); }

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
       group.keywords.sort((a,b) => a.localeCompare(b, 'vi')).forEach(kw => { tagsHTML += `<span class="keyword-tag" onclick="startEditKeyword('${escapeHTML(kw)}', '${escapeHTML(category)}')">${escapeHTML(kw)}</span>`; }); 
       const div = document.createElement('div'); div.className = 'tx-card keyword-group-card'; 
       div.innerHTML = `<div class="accordion-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none'?'flex':'none'; this.querySelector('.chevron').style.transform = this.nextElementSibling.style.display==='none'?'rotate(0deg)':'rotate(180deg)';"><div class="flex-row-gap-10" style="align-items:center;"><div class="tx-icon-wrap expense">${getCategoryIcon(category)}</div><div class="tx-body"><div class="tx-title">${escapeHTML(category)}</div><div class="tx-id-row">${group.keywords.length} từ khóa</div></div></div><i class="fas fa-chevron-down chevron" style="color: var(--text-3); transition: 0.3s;"></i></div><div class="accordion-body" style="display:none;">${tagsHTML || '<span class="tx-note">Chưa có từ khóa</span>'}</div>`; 
       container.appendChild(div); 
   });
}

// ---------------- MODALS & CRUD ----------------
async function fetchCategories() { 
    try { 
        const res = await fetch(`${FIREBASE_URL}/categories.json`); let raw = await res.json(); 
        if(!raw) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getCategories&sheetId=${sheetId}`)); raw = await gasRes.json(); } 
        let cats = [];
        if (Array.isArray(raw)) {
            cats = raw.filter(c => c);
        } else if (raw && typeof raw === 'object') {
            cats = Object.keys(raw);
        }
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

// openAddForm(presetType?: 'Thu nhập'|'Chi tiêu')
window.openAddForm = async function(presetType) {
    triggerHaptic('light');
    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => document.getElementById('addModal').classList.add('show'), 10);

    document.querySelectorAll('#addModal .type-pill').forEach(p => {
        if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập';
        else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu';
    });

    // preset type: ẩn nhóm chọn type, chỉ hiển thị đúng loại
    const typeGroup = document.getElementById('addTypeGroup');
    const typeRow = document.getElementById('addTypeRow');
    if (presetType === 'Thu nhập' || presetType === 'Chi tiêu') {
        if (typeRow) typeRow.style.display = 'none';
        if (typeGroup) typeGroup.querySelector('.field-label').textContent = presetType;
        document.getElementById('addType').value = presetType;
    } else {
        if (typeRow) typeRow.style.display = 'flex';
        if (typeGroup) typeGroup.querySelector('.field-label').textContent = 'Phân loại';
        // mặc định chi tiêu
        document.getElementById('addType').value = 'Chi tiêu';
        document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Chi tiêu')) p.click(); });
    }

    document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
    document.getElementById('addContent').value = '';
    document.getElementById('addAmount').value = '';
    document.getElementById('addNote').value = '';

    const catSel = document.getElementById('addCategory');
    catSel.innerHTML = '';
    const cats = await fetchCategories();
    cats.forEach(c => catSel.appendChild(new Option(c, c)));
};

window.closeAddForm = function() { document.getElementById('addModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.openEditForm = async function(tx) { if(!tx) return; triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('editModal').classList.add('show'), 10); const pills = document.querySelectorAll('#editModal .type-pill'); pills.forEach(p => { if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập'; else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu'; }); document.getElementById('editTransactionId').value = tx.id; document.getElementById('editContent').value = tx.content; document.getElementById('editAmount').value = formatNumberWithCommas(tx.amount.toString()); document.getElementById('editNote').value = tx.note || ''; const [d,m,y] = tx.date.split('/'); document.getElementById('editDate').value = `${y}-${m}-${d}`; pills.forEach(p => { if(tx.type === 'Thu nhập' && p.textContent.includes('Thu nhập')) p.click(); if(tx.type === 'Chi tiêu' && p.textContent.includes('Chi tiêu')) p.click(); }); const catSel = document.getElementById('editCategory'); catSel.innerHTML = ''; const cats = await fetchCategories(); cats.forEach(c => { const opt = new Option(c, c); if(c === tx.category) opt.selected = true; catSel.appendChild(opt); }); };
window.closeEditForm = function() { document.getElementById('editModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.closeAllModals = function() { closeAddForm(); closeEditForm(); closeSearchModal(); closeDetailModal(); closeFabMenu(); closeSettingsModal(); closeAboutModal(); if (document.getElementById('iconPickerModal')) document.getElementById('iconPickerModal').classList.remove('show'); if (document.getElementById('pdfPreviewModal')) document.getElementById('pdfPreviewModal').classList.remove('show'); };

// ---- phần dưới giữ nguyên (submitTx/delete/icon picker) ----
