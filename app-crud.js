/* =========================================================================
   app-crud.js — Tu khoa, danh muc, CRUD giao dich, Icon Picker
   Nap sau app-reports.js, truoc app-export.js / app-init.js
   -------------------------------------------------------------------------
   [A] LAM MOI DU LIEU SAU MOI THAY DOI
       Truoc day submitTx tu tay va lai cac mang cache (cachedTransactions.data,
       cachedChartData.txs, cachedSearchResults) roi goi displayTransactions()
       => ve lai chinh mang CU (vi du van hien 9/8 sau khi doi sang 8/8).
       Nay: xoa SACH cache roi goi refreshAllData() de tai lai tu nguon.

   [B] TAB 3 — QUAN LY DANH MUC
       Chon danh muc co san => hien luon danh sach tu khoa cua danh muc do
       de sua truc tiep trong modal.

   [C] NUT XOA DANH MUC
       index.html da co inline style="display:none" cho #deleteCategoryBtn,
       nen dieu khien bang btn.style.display la dung co che goc.
       TUYET DOI khong dat rule CSS `#deleteCategoryBtn { display:none !important }`
       vi !important se chan JS => nut khong bao gio hien.

   [D] LUOI ICON KHONG BI CAT
       Vung cat that la #iconPickerBody (div boc co overflow-y:auto, khong padding
       ngang) — xem upgrade.css. O day: khong doi o dang chon len dau luoi nua,
       va reset scroll cua dung #iconPickerBody.
   ========================================================================= */

/* =========================================================================
   PHAN 0 — CACHE & LAM MOI DU LIEU
   ========================================================================= */

function __wipeObj(obj) {
    try { if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => delete obj[k]); } catch (e) {}
}

/** Xoa sach moi tang cache de lan doc tiep theo luon lay du lieu moi. */
function clearAllDataCaches() {
    try { if (typeof dayTxCache !== 'undefined') __wipeObj(dayTxCache); } catch (e) {}
    try { if (typeof monthDataCache !== 'undefined') __wipeObj(monthDataCache); } catch (e) {}
    try { if (typeof apiTxCache !== 'undefined') __wipeObj(apiTxCache); } catch (e) {}
    try { if (typeof __yearHasDataCache !== 'undefined') __wipeObj(__yearHasDataCache); } catch (e) {}
    try { if (typeof __yearFetchInFlight !== 'undefined') __wipeObj(__yearFetchInFlight); } catch (e) {}
    try { if (typeof cachedTransactions !== 'undefined') cachedTransactions = null; } catch (e) {}
    try { if (typeof cachedChartData !== 'undefined') cachedChartData = null; } catch (e) {}
    try { if (typeof cachedSearchResults !== 'undefined') cachedSearchResults = null; } catch (e) {}
    try { if (typeof __navBoundsPromise !== 'undefined') __navBoundsPromise = null; } catch (e) {}
    try { if (typeof tab2NeedsReload !== 'undefined') tab2NeedsReload = true; } catch (e) {}
    window.__navBoundsPromise = null;
}
window.clearAllDataCaches = clearAllDataCaches;

/**
 * [A] Lam moi TOAN BO du lieu dang hien tren man hinh.
 * Goi sau MOI thao tac them / sua / xoa giao dich hoac danh muc.
 */
window.refreshAllData = async function refreshAllData() {
    clearAllDataCaches();
    try {
        if (typeof fetchTransactions === 'function') await fetchTransactions(true);
    } catch (e) {}
    try {
        if (typeof updateTimeNavUI === 'function') updateTimeNavUI();
    } catch (e) {}
    // Neu Tab 2 dang mo thi ve lai bao cao ngay
    try {
        const tab2 = document.getElementById('tab2');
        if (tab2 && tab2.classList.contains('active') && typeof loadReportData === 'function') {
            await loadReportData(true);
        }
    } catch (e) {}
    // Neu dang mo ket qua tim kiem thi chay lai truy van
    try {
        if (typeof window.rerunSearch === 'function') await window.rerunSearch();
    } catch (e) {}
};

/** Chay lai tim kiem hien tai (neu co) de ket qua khong con la du lieu cu. */
window.rerunSearch = async function rerunSearch() {
    const modal = document.getElementById('searchModal');
    const q = document.getElementById('searchQuery');
    if (!modal || !q || !q.value.trim()) return;
    if (!modal.classList.contains('show')) return;
    const btn = document.getElementById('searchTransactionsBtn');
    if (btn && typeof btn.onclick === 'function') { await btn.onclick(); return; }
    if (typeof searchTransactions === 'function') await searchTransactions();
};

/* =========================================================================
   PHAN 1 — TU KHOA (TAB 3)
   ========================================================================= */

/** Chuan hoa danh sach tu khoa: bo trang, bo rong, bo trung (khong phan biet hoa/thuong). */
function normalizeKeywordList(list) {
    const out = [];
    const seen = new Set();
    (Array.isArray(list) ? list : []).forEach(k => {
        const s = String(k == null ? '' : k).trim();
        if (!s) return;
        const key = s.toLowerCase();
        if (seen.has(key)) return;
        seen.add(key);
        out.push(s);
    });
    return out;
}
window.normalizeKeywordList = normalizeKeywordList;

/** Doc tu khoa cua 1 danh muc tu Firebase. */
async function fetchCategoryKeywords(cat) {
    if (!cat) return [];
    try {
        const res = await secureFetch(`/categories/${encodeURIComponent(cat)}/keywords.json`, 'GET');
        if (!res) return [];
        if (Array.isArray(res)) return normalizeKeywordList(res);
        if (typeof res === 'object') return normalizeKeywordList(Object.values(res));
        if (typeof res === 'string') return normalizeKeywordList(res.split(','));
    } catch (e) {}
    return [];
}
window.fetchCategoryKeywords = fetchCategoryKeywords;

/** Ghi de toan bo tu khoa cua 1 danh muc len Firebase. */
async function putCategoryKeywords(cat, list) {
    if (!cat) return false;
    try {
        await secureFetch(`/categories/${encodeURIComponent(cat)}/keywords.json`, 'PUT', normalizeKeywordList(list));
        return true;
    } catch (e) { return false; }
}
window.putCategoryKeywords = putCategoryKeywords;

/** Tai toan bo tu khoa va ve ra Tab 3. */
window.loadKeywords = async function loadKeywords(isInit) {
    const box = document.getElementById('keywordsContainer');
    const ph = document.getElementById('placeholderTab3');
    const sp = document.getElementById('loadingTab3');
    if (sp) sp.style.display = 'block';
    if (ph) ph.style.display = 'none';
    try {
        const data = await secureFetch('/categories.json', 'GET') || {};
        window.cachedKeywords = data;
        displayKeywords(data);
    } catch (e) {
        if (box) box.innerHTML = '';
        if (ph) { ph.textContent = 'Không tải được dữ liệu từ khóa'; ph.style.display = 'block'; }
    } finally {
        if (sp) sp.style.display = 'none';
    }
};

/** Ve danh sach tu khoa theo tung danh muc (accordion). */
window.displayKeywords = function displayKeywords(data) {
    const box = document.getElementById('keywordsContainer');
    const ph = document.getElementById('placeholderTab3');
    if (!box) return;
    const cats = Object.keys(data || {}).sort((a, b) => a.localeCompare(b, 'vi'));
    if (!cats.length) {
        box.innerHTML = '';
        if (ph) { ph.textContent = 'Chưa có từ khóa nào'; ph.style.display = 'block'; }
        return;
    }
    if (ph) ph.style.display = 'none';

    const html = cats.map(cat => {
        const node = data[cat] || {};
        let kws = node.keywords;
        if (kws && !Array.isArray(kws) && typeof kws === 'object') kws = Object.values(kws);
        kws = normalizeKeywordList(kws);
        const tags = kws.length
            ? kws.map(k => `<span class="keyword-tag" onclick="startEditKeyword('${escapeHTML(cat).replace(/'/g, "\\'")}','${escapeHTML(k).replace(/'/g, "\\'")}')">${escapeHTML(k)}</span>`).join('')
            : '<span class="empty-state" style="padding:6px 0;">Chưa có từ khóa</span>';
        return `
        <div class="keyword-group-card">
          <div class="accordion-header" onclick="this.parentElement.classList.toggle('open')">
            <span class="acc-icon">${getCategoryIcon(cat)}</span>
            <span class="acc-title">${escapeHTML(cat)}</span>
            <span class="acc-count">${kws.length}</span>
            <i class="fas fa-chevron-down acc-caret"></i>
          </div>
          <div class="accordion-body"><div class="keyword-tags">${tags}</div></div>
        </div>`;
    }).join('');
    box.innerHTML = html;
};

/** Bat dau sua 1 tu khoa: dua len o nhap va doi nut sang che do sua. */
window.startEditKeyword = function startEditKeyword(cat, kw) {
    triggerHaptic('light');
    window.currentEditKeyword = { cat: cat, kw: kw };
    const kCat = document.getElementById('keywordCategory');
    const kInp = document.getElementById('keywordInput');
    if (kCat) kCat.value = cat;
    if (kInp) { kInp.value = kw; kInp.focus(); }
    const add = document.getElementById('addKeywordBtn');
    if (add) add.innerHTML = '<i class="fas fa-save"></i> Cập nhật';
    let cancel = document.getElementById('cancelKeywordBtn');
    const wrap = document.getElementById('keywordActionContainer');
    if (!cancel && wrap) {
        cancel = document.createElement('button');
        cancel.id = 'cancelKeywordBtn';
        cancel.type = 'button';
        cancel.className = 'btn-cancel flex-1 m-0';
        cancel.innerHTML = '<i class="fas fa-times"></i> Hủy';
        cancel.onclick = window.cancelEditKeyword;
        wrap.appendChild(cancel);
    }
    if (cancel) cancel.style.display = 'flex';
    let del = document.getElementById('deleteEditKeywordBtn');
    if (!del && wrap) {
        del = document.createElement('button');
        del.id = 'deleteEditKeywordBtn';
        del.type = 'button';
        del.className = 'btn-danger-outline flex-1 m-0';
        del.innerHTML = '<i class="fas fa-trash"></i> Xóa';
        del.onclick = () => window.deleteKeyword(window.currentEditKeyword);
        wrap.appendChild(del);
    }
    if (del) del.style.display = 'flex';
    try { document.getElementById('tab3').scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) {}
};

/** Thoat che do sua tu khoa. */
window.cancelEditKeyword = function cancelEditKeyword() {
    window.currentEditKeyword = null;
    const kInp = document.getElementById('keywordInput');
    if (kInp) kInp.value = '';
    const add = document.getElementById('addKeywordBtn');
    if (add) add.innerHTML = '<i class="fas fa-plus"></i> Thêm';
    ['cancelKeywordBtn', 'deleteEditKeywordBtn'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
};

/** Them moi hoac cap nhat 1 tu khoa. */
window.submitKeyword = async function submitKeyword() {
    const cat = (document.getElementById('keywordCategory') || {}).value || '';
    const kw = ((document.getElementById('keywordInput') || {}).value || '').trim();
    if (!cat) return showToast('Hãy chọn phân loại', 'warning');
    if (!kw) return showToast('Hãy nhập từ khóa', 'warning');

    showLoading(true);
    try {
        const editing = window.currentEditKeyword;
        if (editing && editing.cat === cat) {
            const list = await fetchCategoryKeywords(cat);
            const idx = list.findIndex(k => k.toLowerCase() === String(editing.kw).toLowerCase());
            if (idx >= 0) list[idx] = kw; else list.push(kw);
            await putCategoryKeywords(cat, list);
        } else if (editing) {
            // Doi sang danh muc khac: bo o danh muc cu, them vao danh muc moi
            const oldList = (await fetchCategoryKeywords(editing.cat))
                .filter(k => k.toLowerCase() !== String(editing.kw).toLowerCase());
            await putCategoryKeywords(editing.cat, oldList);
            const newList = await fetchCategoryKeywords(cat);
            newList.push(kw);
            await putCategoryKeywords(cat, newList);
        } else {
            const list = await fetchCategoryKeywords(cat);
            if (list.some(k => k.toLowerCase() === kw.toLowerCase())) {
                showLoading(false);
                return showToast('Từ khóa này đã tồn tại', 'warning');
            }
            list.push(kw);
            await putCategoryKeywords(cat, list);
        }
        try { await postToSheetWithRetry({ action: 'addKeyword', category: cat, keyword: kw }); } catch (e) {}
        window.cancelEditKeyword();
        await window.loadKeywords();
        triggerHapticNotification('success');
        showToast('Đã lưu từ khóa', 'success');
    } catch (e) {
        showToast('Lỗi khi lưu từ khóa', 'error');
    } finally {
        showLoading(false);
    }
};

/** Xoa 1 tu khoa. */
window.deleteKeyword = async function deleteKeyword(target) {
    if (!target || !target.cat || !target.kw) return;
    const ok = await showCustomConfirm(`Xóa từ khóa "${target.kw}"?`);
    if (!ok) return;
    showLoading(true);
    try {
        const list = (await fetchCategoryKeywords(target.cat))
            .filter(k => k.toLowerCase() !== String(target.kw).toLowerCase());
        await putCategoryKeywords(target.cat, list);
        try { await postToSheetWithRetry({ action: 'deleteKeyword', category: target.cat, keyword: target.kw }); } catch (e) {}
        window.cancelEditKeyword();
        await window.loadKeywords();
        triggerHapticNotification('success');
        showToast('Đã xóa từ khóa', 'success');
    } catch (e) {
        showToast('Lỗi khi xóa từ khóa', 'error');
    } finally {
        showLoading(false);
    }
};

/* =========================================================================
   PHAN 2 — CRUD GIAO DICH
   ========================================================================= */

/** Sinh ma giao dich ke tiep trong thang: GD001, GD002, ... */
window.getNextTransactionId = async function getNextTransactionId(month, year) {
    let max = 0;
    try {
        const data = await secureFetch(`/transactions/${year}/month_${month}.json`, 'GET') || {};
        Object.keys(data).forEach(id => {
            const m = /^GD(\d+)$/i.exec(id);
            if (m) max = Math.max(max, parseInt(m[1], 10));
        });
    } catch (e) {}
    return 'GD' + String(max + 1).padStart(3, '0');
};

/**
 * Them (mode='add') hoac sua (mode='edit') mot giao dich.
 * [A] Ket thuc bang refreshAllData() — KHONG va cache bang tay nua.
 */
window.submitTx = async function submitTx(mode) {
    const p = mode === 'edit' ? 'edit' : 'add';
    const g = id => document.getElementById(p + id);
    const dateStr = (g('Date') || {}).value || '';                     // yyyy-mm-dd
    const content = ((g('Content') || {}).value || '').trim();
    const amount = parseNumber((g('Amount') || {}).value || '');
    const note = ((g('Note') || {}).value || '').trim();
    const category = (g('Category') || {}).value || '';
    const type = (g('Type') || {}).value || 'Chi tiêu';

    if (!dateStr) return showToast('Hãy chọn ngày', 'warning');
    if (!content) return showToast('Hãy nhập nội dung', 'warning');
    if (!amount || amount <= 0) return showToast('Số tiền không hợp lệ', 'warning');
    if (!category) return showToast('Hãy chọn phân loại chi tiết', 'warning');

    const [y, m, d] = dateStr.split('-').map(n => parseInt(n, 10));
    const year = y, month = m;
    const viDate = `${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;

    showLoading(true);
    try {
        let txId;
        let oldMonth = null, oldYear = null;
        if (mode === 'edit') {
            txId = (document.getElementById('editTransactionId') || {}).value || '';
            if (!txId) throw new Error('missing id');
            const meta = (window.__editingTxMeta || {});
            oldMonth = meta.month || null;
            oldYear = meta.year || null;
        } else {
            txId = await window.getNextTransactionId(month, year);
        }

        const tx = {
            id: txId,
            date: viDate,
            content: content,
            amount: amount,
            note: note,
            category: category,
            type: type
        };

        // Neu sua ma doi sang thang/nam khac thi xoa ban ghi o thang cu
        if (mode === 'edit' && oldMonth && oldYear && (oldMonth !== month || oldYear !== year)) {
            try { await secureFetch(`/transactions/${oldYear}/month_${oldMonth}/${txId}.json`, 'DELETE'); } catch (e) {}
        }

        await secureFetch(`/transactions/${year}/month_${month}/${txId}.json`, 'PUT', tx);

        // Dong bo Google Sheet + thong bao Telegram (khong chan luong UI)
        try {
            postToSheetWithRetry({
                action: mode === 'edit' ? 'updateTransaction' : 'addTransaction',
                id: txId, date: viDate, content: content, amount: amount,
                note: note, category: category, type: type
            });
        } catch (e) {}
        try { notifyTelegram(mode === 'edit' ? 'Đã sửa giao dịch' : 'Đã thêm giao dịch', tx); } catch (e) {}

        if (mode === 'edit') { if (typeof closeEditForm === 'function') closeEditForm(); }
        else { if (typeof closeAddForm === 'function') closeAddForm(); }

        // [A] Bat buoc: xoa sach cache va tai lai tu nguon
        await window.refreshAllData();

        triggerHapticNotification('success');
        showToast(mode === 'edit' ? 'Đã cập nhật giao dịch' : 'Đã thêm giao dịch', 'success');
    } catch (e) {
        triggerHapticNotification('error');
        showToast('Lỗi khi lưu giao dịch', 'error');
    } finally {
        showLoading(false);
    }
};

/** Xoa 1 giao dich theo ma. */
window.deleteTransaction = async function deleteTransaction(txId) {
    if (!txId) return;
    const ok = await showCustomConfirm('Bạn có chắc chắn muốn xóa giao dịch này? Hành động này không thể hoàn tác.');
    if (!ok) return;

    let month = null, year = null;
    const meta = window.__editingTxMeta || {};
    if (meta.month && meta.year) { month = meta.month; year = meta.year; }
    if (!month || !year) {
        const dv = (document.getElementById('editDate') || {}).value || '';
        if (dv) { const p = dv.split('-'); year = parseInt(p[0], 10); month = parseInt(p[1], 10); }
    }
    if (!month || !year) { const n = new Date(); year = n.getFullYear(); month = n.getMonth() + 1; }

    showLoading(true);
    try {
        await secureFetch(`/transactions/${year}/month_${month}/${txId}.json`, 'DELETE');
        try { postToSheetWithRetry({ action: 'deleteTransaction', id: txId }); } catch (e) {}
        try { notifyTelegram('Đã xóa giao dịch', { id: txId }); } catch (e) {}
        if (typeof closeEditForm === 'function') closeEditForm();
        if (typeof closeAllModals === 'function') closeAllModals();

        // [A] Xoa sach cache va tai lai
        await window.refreshAllData();

        triggerHapticNotification('success');
        showToast('Đã xóa giao dịch', 'success');
    } catch (e) {
        triggerHapticNotification('error');
        showToast('Lỗi khi xóa giao dịch', 'error');
    } finally {
        showLoading(false);
    }
};

/* =========================================================================
   PHAN 3 — ICON PICKER / QUAN LY DANH MUC
   ========================================================================= */

/** 68 emoji cho luoi chon icon. */
const ICON_PICKER_EMOJIS = [
    '🍚', '🍜', '🍔', '🍕', '☕', '🍺', '🍰', '🍎',
    '🛒', '🏠', '💡', '💧', '🔥', '📱', '💻', '📺',
    '🚗', '🏍️', '⛽', '🚌', '✈️', '🚕', '🅿️', '🛠️',
    '👕', '👖', '👟', '👜', '💄', '✂️', '🧴', '🧼',
    '💊', '🏥', '🩺', '🦷', '🏋️', '⚽', '🎮', '🎬',
    '🎵', '📚', '🎓', '✏️', '🖨️', '🎁', '💐', '🎉',
    '💰', '💳', '🏦', '📈', '🧾', '🪙', '💵', '🤝',
    '👶', '🐶', '🐱', '🌱', '🧹', '🔧', '📦', '🧳',
    '🛫', '🏖️', '⛰️', '❓'
];
window.ICON_PICKER_EMOJIS = ICON_PICKER_EMOJIS;

/** Doi gia tri icon luu trong DB (emoji hoac ten Font Awesome) sang emoji. */
function iconValueToEmoji(raw) {
    if (!raw) return null;
    let v = String(raw).trim();
    if (!v) return null;
    if (v.indexOf('fa-') === -1) return v;                      // da la emoji
    v = v.replace('fas ', '').replace('far ', '').replace('fab ', '').trim();
    if (!v.startsWith('fa-')) v = 'fa-' + v;
    return (typeof FA_TO_EMOJI_MAP !== 'undefined' && FA_TO_EMOJI_MAP[v]) ? FA_TO_EMOJI_MAP[v] : null;
}
window.iconValueToEmoji = iconValueToEmoji;

/** [D] Dua modal + vung cuon that (#iconPickerBody) ve dau. */
function scrollIconPickerToTop() {
    try { window.scrollTo({ top: 0, behavior: 'auto' }); } catch (e) { window.scrollTo(0, 0); }
    [
        document.documentElement,
        document.body,
        document.getElementById('tab3'),
        document.querySelector('.content-wrapper'),
        document.getElementById('iconPickerModal'),
        document.getElementById('iconPickerBody'),      // vung cuon THAT cua modal
        document.getElementById('iconGridContainer')
    ].forEach(el => { if (el) { el.scrollTop = 0; el.scrollLeft = 0; } });
}
window.scrollIconPickerToTop = scrollIconPickerToTop;

/**
 * [C] Nut xoa danh muc: CHI hien khi dang sua MOT danh muc CO SAN.
 * Dung style.display vi index.html da co inline style="display:none".
 * Khong dat rule CSS !important cho #deleteCategoryBtn (se chan ham nay).
 */
function setDeleteBtnVisibility(isExisting) {
    const btn = document.getElementById('deleteCategoryBtn');
    if (!btn) return;
    btn.style.display = isExisting ? 'flex' : 'none';
    btn.disabled = !isExisting;
}
window.setDeleteBtnVisibility = setDeleteBtnVisibility;

/* ---------- Quan ly the tu khoa trong modal ---------- */
let pendingTags = [];
window.pendingTags = pendingTags;

function renderTags() {
    const wrap = document.getElementById('tagsWrapper');
    if (!wrap) return;
    wrap.innerHTML = pendingTags.map((t, i) =>
        `<span class="tag-badge"><span>${escapeHTML(t)}</span><i class="fas fa-times" data-tag-idx="${i}"></i></span>`
    ).join('');
    const hidden = document.getElementById('iconPickerNewKeywords');
    if (hidden) hidden.value = pendingTags.join(', ');
}
window.renderTags = renderTags;

function removeTag(i) {
    if (i < 0 || i >= pendingTags.length) return;
    pendingTags.splice(i, 1);
    renderTags();
}
window.removeTag = removeTag;

function commitTagInput() {
    const inp = document.getElementById('tagInputField');
    if (!inp) return;
    const parts = String(inp.value || '').split(',');
    let changed = false;
    parts.forEach(p => {
        const s = p.trim();
        if (!s) return;
        if (!pendingTags.some(t => t.toLowerCase() === s.toLowerCase())) { pendingTags.push(s); changed = true; }
    });
    inp.value = '';
    if (changed) renderTags();
}
window.commitTagInput = commitTagInput;

/** [B] Nap danh sach tu khoa cua danh muc dang chon vao modal. */
async function loadTagsForCategory(cat) {
    const area = document.getElementById('tagInputArea');
    pendingTags = [];
    window.pendingTags = pendingTags;
    renderTags();
    if (!cat) { if (area) area.style.display = 'none'; return; }
    if (area) area.style.display = 'block';
    const list = await fetchCategoryKeywords(cat);
    pendingTags = list.slice();
    window.pendingTags = pendingTags;
    window.__originalTags = list.slice();
    renderTags();
}
window.loadTagsForCategory = loadTagsForCategory;

/** Ve lai luoi icon (1 lan duy nhat moi khi mo modal). */
function buildIconGrid() {
    const container = document.getElementById('iconGridContainer');
    if (!container) return;
    const frag = document.createDocumentFragment();
    ICON_PICKER_EMOJIS.forEach((emo, idx) => {
        const div = document.createElement('div');
        div.className = 'icon-item';
        div.setAttribute('data-icon', emo);
        div.setAttribute('data-idx', String(idx));
        div.textContent = emo;
        frag.appendChild(div);
    });
    container.innerHTML = '';
    container.appendChild(frag);
}

/**
 * Cap nhat trang thai luoi icon theo danh muc dang chon.
 * [D] KHONG doi o dang chon len dau luoi nua (chinh viec do lam no bi cat mep trai).
 */
function updateIconState(val) {
    const modal = document.getElementById('iconPickerModal');
    const container = document.getElementById('iconGridContainer');
    if (!modal || !container) return;

    // Thu thap icon da duoc danh muc KHAC su dung => khoa lai
    const used = [];
    const maps = [window.customCategoryIcons || {}, window.categoryIconMap || {}];
    maps.forEach(map => {
        Object.keys(map).forEach(c => {
            if (c === val) return;
            const emo = iconValueToEmoji(map[c]);
            if (emo && used.indexOf(emo) === -1) used.push(emo);
        });
    });

    container.querySelectorAll('.icon-item').forEach(item => {
        item.classList.remove('selected');
        const emo = item.getAttribute('data-icon');
        item.classList.toggle('disabled-icon', used.indexOf(emo) !== -1);
    });
    modal.removeAttribute('data-selected-icon');
    if (!val) return;

    const raw = (window.customCategoryIcons && window.customCategoryIcons[val])
        || (window.categoryIconMap && window.categoryIconMap[val])
        || null;
    const target = iconValueToEmoji(raw);
    if (!target) return;

    let item = container.querySelector(`.icon-item[data-icon="${CSS.escape(target)}"]`);
    if (!item) {
        item = document.createElement('div');
        item.className = 'icon-item';
        item.setAttribute('data-icon', target);
        item.textContent = target;
    }
    item.classList.add('selected');
    item.classList.remove('disabled-icon');
    modal.setAttribute('data-selected-icon', target);
    // Icon cu chua co trong luoi thi them vao CUOI, khong chen len dau
    if (!item.parentNode) container.appendChild(item);
    const body = document.getElementById('iconPickerBody');
    if (body) { body.scrollTop = 0; body.scrollLeft = 0; }
}
window.updateIconState = updateIconState;

/** Mo modal Quan ly danh muc. */
window.openIconPickerModal = async function openIconPickerModal() {
    triggerHaptic('light');
    const modal = document.getElementById('iconPickerModal');
    const overlay = document.getElementById('modalOverlay');
    const catSelect = document.getElementById('iconPickerSelect');
    const newGroup = document.getElementById('newCategoryInputGroup');
    const catInput = document.getElementById('iconPickerCategory');
    const delBtn = document.getElementById('deleteCategoryBtn');
    const saveBtn = document.getElementById('saveIconPickerBtn');
    if (!modal || !catSelect) return;

    buildIconGrid();

    // Nap danh sach danh muc
    let cats = [];
    try {
        const data = await secureFetch('/categories.json', 'GET') || {};
        cats = Object.keys(data).sort((a, b) => a.localeCompare(b, 'vi'));
    } catch (e) {}
    catSelect.innerHTML = '<option value="">-- Chọn hoặc tạo danh mục --</option>';
    cats.forEach(c => catSelect.appendChild(new Option(c, c)));
    catSelect.appendChild(new Option('➕ Tạo danh mục mới…', '__NEW__'));

    // Trang thai ban dau: lay theo danh muc dang chon o Tab 3 (neu co)
    const kCatVal = ((document.getElementById('keywordCategory') || {}).value || '').trim();
    if (kCatVal && cats.indexOf(kCatVal) !== -1) {
        catSelect.value = kCatVal;
        window.__editingExistingCat = kCatVal;
        if (newGroup) newGroup.style.display = 'block';
        if (catInput) catInput.value = kCatVal;
        setDeleteBtnVisibility(true);                       // [C]
        updateIconState(kCatVal);
        await loadTagsForCategory(kCatVal);
    } else {
        catSelect.value = '';
        window.__editingExistingCat = null;
        if (newGroup) newGroup.style.display = 'none';
        if (catInput) catInput.value = '';
        setDeleteBtnVisibility(false);                      // [C]
        updateIconState('');
        await loadTagsForCategory('');
    }

    /* ----- Su kien (gan 1 lan, dung delegation cho luoi icon) ----- */
    const container = document.getElementById('iconGridContainer');
    if (container && !container.__bound) {
        container.__bound = true;
        container.addEventListener('click', (e) => {
            const item = e.target.closest('.icon-item');
            if (!item || item.classList.contains('disabled-icon')) return;
            triggerHaptic('light');
            container.querySelectorAll('.icon-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            modal.setAttribute('data-selected-icon', item.getAttribute('data-icon'));
        });
    }
    const tagsWrap = document.getElementById('tagsWrapper');
    if (tagsWrap && !tagsWrap.__bound) {
        tagsWrap.__bound = true;
        tagsWrap.addEventListener('click', (e) => {
            const x = e.target.closest('[data-tag-idx]');
            if (!x) return;
            triggerHaptic('light');
            removeTag(parseInt(x.getAttribute('data-tag-idx'), 10));
        });
    }
    const tagField = document.getElementById('tagInputField');
    if (tagField && !tagField.__bound) {
        tagField.__bound = true;
        tagField.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); commitTagInput(); }
            else if (e.key === 'Backspace' && !tagField.value && pendingTags.length) { removeTag(pendingTags.length - 1); }
        });
        tagField.addEventListener('blur', commitTagInput);
        const cont = document.querySelector('.tag-input-container');
        if (cont) cont.addEventListener('click', () => tagField.focus());
    }

    catSelect.onchange = async () => {
        const val = catSelect.value;
        if (val === '__NEW__') {
            window.__editingExistingCat = null;
            if (newGroup) newGroup.style.display = 'block';
            if (catInput) { catInput.value = ''; catInput.focus(); }
            setDeleteBtnVisibility(false);                  // [C]
            updateIconState('');
            const area = document.getElementById('tagInputArea');
            if (area) area.style.display = 'block';
            pendingTags = []; window.pendingTags = pendingTags; window.__originalTags = [];
            renderTags();
            return;
        }
        window.__editingExistingCat = val || null;
        if (newGroup) newGroup.style.display = val ? 'block' : 'none';
        if (catInput) catInput.value = val || '';
        setDeleteBtnVisibility(!!val);                      // [C]
        updateIconState(val);
        await loadTagsForCategory(val);
    };

    if (delBtn) {
        delBtn.onclick = async () => {
            const cat = window.__editingExistingCat;
            // Chot an toan: chi xoa duoc danh muc CO SAN dang duoc chon
            if (!cat) return showToast('Chỉ xóa được danh mục đã có. Hãy chọn danh mục từ danh sách.', 'warning');
            if (catSelect.value !== cat) return showToast('Chỉ xóa được danh mục đã có. Hãy chọn danh mục từ danh sách.', 'warning');
            const ok = await showCustomConfirm(`Xóa danh mục "${cat}" cùng toàn bộ từ khóa của nó?`);
            if (!ok) return;
            showLoading(true);
            try {
                await secureFetch(`/categories/${encodeURIComponent(cat)}.json`, 'DELETE');
                try { postToSheetWithRetry({ action: 'deleteCategory', category: cat }); } catch (e) {}
                window.closeIconPickerModal();
                if (typeof initCategories === 'function') await initCategories(false);
                await window.loadKeywords();
                triggerHapticNotification('success');
                showToast('Đã xóa danh mục', 'success');
            } catch (e) {
                showToast('Lỗi khi xóa danh mục', 'error');
            } finally { showLoading(false); }
        };
    }

    if (saveBtn) saveBtn.onclick = window.saveIconPicker;

    // Mo modal
    if (overlay) { overlay.style.display = 'flex'; overlay.classList.add('show'); }
    modal.style.display = 'flex';
    requestAnimationFrame(() => {
        modal.classList.add('show');
        scrollIconPickerToTop();                            // luon hien thi tu dau trang
    });
};

/** Luu thay doi: ten (neu tao moi), icon, va danh sach tu khoa. */
window.saveIconPicker = async function saveIconPicker() {
    commitTagInput();
    const modal = document.getElementById('iconPickerModal');
    const catSelect = document.getElementById('iconPickerSelect');
    const catInput = document.getElementById('iconPickerCategory');
    if (!modal || !catSelect) return;

    const isNew = catSelect.value === '__NEW__';
    const existing = window.__editingExistingCat;
    const name = ((catInput || {}).value || '').trim();
    const icon = modal.getAttribute('data-selected-icon') || '';

    if (isNew && !name) return showToast('Hãy nhập tên danh mục', 'warning');
    if (!isNew && !existing) return showToast('Hãy chọn hoặc tạo danh mục', 'warning');
    // Doi TEN danh muc co san: tam thoi chua ho tro dong bo (se lam sau)
    const cat = isNew ? name : existing;

    showLoading(true);
    try {
        if (icon) {
            await secureFetch(`/categories/${encodeURIComponent(cat)}/icon.json`, 'PUT', icon);
            try { postToSheetWithRetry({ action: 'updateCategoryIcon', category: cat, icon: icon }); } catch (e) {}
            if (window.customCategoryIcons) window.customCategoryIcons[cat] = icon;
        }
        // Ghi de toan bo tu khoa theo danh sach dang hien trong modal
        await putCategoryKeywords(cat, pendingTags);

        // Dong bo them/bot tu khoa sang Google Sheet (chay nen, khong chan UI)
        try {
            const before = normalizeKeywordList(window.__originalTags || []);
            const after = normalizeKeywordList(pendingTags);
            const lower = arr => arr.map(s => s.toLowerCase());
            after.filter(k => lower(before).indexOf(k.toLowerCase()) === -1)
                 .forEach(k => postToSheetWithRetry({ action: 'addKeyword', category: cat, keyword: k }));
            before.filter(k => lower(after).indexOf(k.toLowerCase()) === -1)
                  .forEach(k => postToSheetWithRetry({ action: 'deleteKeyword', category: cat, keyword: k }));
        } catch (e) {}

        window.closeIconPickerModal();
        if (typeof initCategories === 'function') await initCategories(true);
        await window.loadKeywords();
        triggerHapticNotification('success');
        showToast('Đã lưu thay đổi', 'success');
    } catch (e) {
        triggerHapticNotification('error');
        showToast('Lỗi khi lưu danh mục', 'error');
    } finally {
        showLoading(false);
    }
};

/** Dong modal + dua moi trang thai ve mac dinh. */
window.closeIconPickerModal = function closeIconPickerModal() {
    triggerHaptic('light');
    const modal = document.getElementById('iconPickerModal');
    const overlay = document.getElementById('modalOverlay');
    if (modal) {
        modal.classList.remove('show');
        modal.removeAttribute('data-selected-icon');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
    if (overlay) { overlay.classList.remove('show'); overlay.style.display = 'none'; }
    window.__editingExistingCat = null;
    window.__originalTags = [];
    pendingTags = []; window.pendingTags = pendingTags;
    renderTags();
    setDeleteBtnVisibility(false);                          // [C] tranh trang thai sot lai
};
