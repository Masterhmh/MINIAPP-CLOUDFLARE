// Báo cho Telegram biết App đã sẵn sàng để hiển thị ngay lập tức
if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

const urlParams = new URLSearchParams(window.location.search);
const apiUrl = urlParams.get('api');
const sheetId = urlParams.get('sheetId');
const proxyUrl = '/api/proxy?url=';

// KẾT NỐI TRỰC TIẾP FIREBASE
const FIREBASE_URL = 'https://quanlychitieu-hmh-default-rtdb.firebaseio.com/';

if (!apiUrl || !sheetId) showToast("Thiếu thông tin API hoặc Sheet ID!", "error");

// Quản lý trạng thái
let cachedTransactions = null, cachedChartData = null; 
let filterModeCache = { monthly: {}, yearly: {}, custom: {} };
let cachedSearchResults = [], cachedKeywords = []; 
window.categoryIconMap = {}; 
window.customCategoryIcons = {}; 

let toastQueue = [], isShowingToast = false, currentEditKeyword = null;

const itemsPerPage = 10;
let currentPageTab1 = 1, currentPageCategory = 1, currentPageSearch = 1;
window.apiTxCache = {}; 
let currentFilterMode = 'weekly', activePeriodDate = new Date();
let savedScrollPositionTab2 = 0;

// ---------------- UTILITIES ----------------
function triggerHaptic(style = 'light') { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred(style); }
function triggerHapticNotification(type = 'success') { if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred(type); }

function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message, type = "info") { toastQueue.push({ message, type }); if (!isShowingToast) processToastQueue(); }

function processToastQueue() {
  if (toastQueue.length === 0) { isShowingToast = false; return; }
  isShowingToast = true;
  const { message, type } = toastQueue.shift();
  const toast = document.createElement('div');
  let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icon}" style="font-size: 1.2rem; color: var(--${type === 'success' ? 'income' : (type === 'error' ? 'expense' : 'balance')});"></i> <span>${escapeHTML(message)}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { toast.remove(); processToastQueue(); }, 300); }, 3000);
}

function showLoading(show, tabId) {
  const el = document.getElementById(`loading${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (el) el.style.display = show ? 'block' : 'none';
}

function formatDate(dateStr) { const parts = dateStr.split('/'); if (parts.length !== 3) return dateStr; return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`; }
function formatDateToYYYYMMDD(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDateToDDMMYYYY(date) { return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth() + 1).padStart(2,'0')}/${date.getFullYear()}`; }
function formatNumberWithCommas(value) { return value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function parseNumber(value) { return parseInt(value.replace(/[^0-9]/g, '')) || 0; }
function getColorByIndex(i) { 
    const c = [
        '#6366F1', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', 
        '#EC4899', '#84CC16', '#8B5CF6', '#F97316', '#14B8A6', 
        '#EAB308', '#D946EF', '#22C55E', '#0EA5E9', '#A855F7', 
        '#EF4444', '#64748B', '#059669', '#DC2626', '#4F46E5', '#C026D3'
    ]; 
    return c[i % c.length]; 
}

function getCategoryIcon(cat) {
    if (!cat) return '<i class="fas fa-box-open"></i>';
    const categoryName = cat.trim();
    if (window.customCategoryIcons && window.customCategoryIcons[categoryName]) {
        let iconCode = window.customCategoryIcons[categoryName].trim();
        if (iconCode) {
            if (!iconCode.includes('fa-')) iconCode = `fa-${iconCode}`;
            if (!iconCode.includes('fas ')) iconCode = `fas ${iconCode}`;
            return `<i class="${iconCode}"></i>`;
        }
    }
    const faMap = {
        'ăn uống': 'fa-utensils', 'bảo hiểm': 'fa-shield-halved', 'công nghệ': 'fa-laptop', 'công việc': 'fa-briefcase', 'giặt ủi': 'fa-shirt', 'sửa chữa': 'fa-screwdriver-wrench',
        'đi lại': 'fa-car-side', 'giải trí': 'fa-clapperboard', 'giáo dục': 'fa-graduation-cap', 'gia đình': 'fa-house-user', 'hóa đơn': 'fa-file-invoice-dollar', 'chăm sóc': 'fa-spa', 
        'làm đẹp': 'fa-spa', 'mua sắm': 'fa-bag-shopping', 'quà tặng': 'fa-gift', 'sức khỏe': 'fa-dumbbell', 'tiết kiệm': 'fa-chart-line', 'đầu tư': 'fa-chart-line', 'y tế': 'fa-pills',
        'nhà cửa': 'fa-house', 'xăng': 'fa-gas-pump', 'lương': 'fa-money-bill-wave', 'thưởng': 'fa-gift', 'khác': 'fa-layer-group'
    };
    for (let key in faMap) { 
        if (categoryName.toLowerCase().includes(key)) return `<i class="fas ${faMap[key]}"></i>`; 
    }
    const emojiToFa = {
        '🍔': 'fa-burger', '🍽️': 'fa-utensils', '🍜': 'fa-bowl-food', '☕': 'fa-mug-hot', '🍺': 'fa-beer-mug-empty',
        '🚗': 'fa-car', '🛵': 'fa-motorcycle', '🚕': 'fa-taxi', '🚌': 'fa-bus', '✈️': 'fa-plane', '⛽': 'fa-gas-pump',
        '🏠': 'fa-house', '🏢': 'fa-building', '🛒': 'fa-cart-shopping', '🛍️': 'fa-bag-shopping', '👕': 'fa-shirt', '👗': 'fa-shirt',
        '💻': 'fa-laptop', '📱': 'fa-mobile-screen', '🎮': 'fa-gamepad', '🎧': 'fa-headphones',
        '💡': 'fa-bolt', '💧': 'fa-droplet', '🔥': 'fa-fire', '📶': 'fa-wifi',
        '💊': 'fa-pills', '🩺': 'fa-stethoscope', '🏥': 'fa-house-medical', '💪': 'fa-dumbbell',
        '🎓': 'fa-graduation-cap', '📚': 'fa-book', '💼': 'fa-briefcase',
        '📈': 'fa-chart-line', '💰': 'fa-money-bill-wave', '🏦': 'fa-building-columns', '💳': 'fa-credit-card',
        '🎁': 'fa-gift', '🎂': 'fa-cake-candles', '🐶': 'fa-paw', '🐱': 'fa-cat', '👶': 'fa-baby',
        '🎬': 'fa-film', '🎵': 'fa-music', '⚽': 'fa-futbol',
        '🛡️': 'fa-shield-halved', '🧾': 'fa-file-invoice-dollar', '💅': 'fa-spa', '🔧': 'fa-wrench'
    };
    if (window.categoryIconMap && window.categoryIconMap[categoryName]) {
        let sheetIcon = window.categoryIconMap[categoryName].trim();
        const firstChar = Array.from(sheetIcon)[0];
        if (emojiToFa[firstChar]) return `<i class="fas ${emojiToFa[firstChar]}"></i>`;
        if (emojiToFa[sheetIcon]) return `<i class="fas ${emojiToFa[sheetIcon]}"></i>`;
        if (!/[^\x00-\x7F]/.test(sheetIcon)) {
            if (!sheetIcon.includes('fa-')) sheetIcon = `fa-${sheetIcon}`;
            if (!sheetIcon.includes('fas ')) sheetIcon = `fas ${sheetIcon}`;
            return `<i class="${sheetIcon}"></i>`;
        }
    }
    const firstLetter = Array.from(categoryName)[0].toUpperCase();
    return `<span style="font-weight: 900; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9em; line-height: 1;">${firstLetter}</span>`;
}

function getCompareHTML(current, prev, type, text = 'so với kỳ trước') {
    if (prev === 0 && current === 0) return `<span style="color: var(--text-2); font-weight: 500;">− 0đ ${escapeHTML(text)}</span>`;
    let diff = current - prev;
    if (diff === 0) return `<span style="color: var(--text-2); font-weight: 500;">− Bằng ${escapeHTML(text)}</span>`;
    let isUp = diff > 0;
    let icon = isUp ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    let arrowText = isUp ? (type === 'balance' ? 'Dư' : 'Tăng') : (type === 'balance' ? 'Âm' : 'Giảm');
    let colorVar = type === 'expense' ? (isUp ? 'var(--expense)' : 'var(--income)') : (isUp ? 'var(--income)' : 'var(--expense)');
    return `<span style="color: ${colorVar}; font-weight: 600;">${icon} ${arrowText} ${formatNumberWithCommas(Math.abs(diff).toString())}đ ${escapeHTML(text)}</span>`;
}

window.openTab = function(tabId) {
  triggerHaptic('light');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(btn) btn.classList.add('active');
};

async function fetchMonthData(month) {
    try {
        const res = await fetch(`${FIREBASE_URL}/transactions/month_${parseInt(month, 10)}.json`);
        const data = await res.json();
        if(data) return Object.values(data).filter(item => item !== null);
    } catch (e) {} return [];
}

// ---------------- TAB 1: GIAO DỊCH ----------------
window.fetchTransactions = async function(forceRefresh = false) {
  const tDate = document.getElementById('transactionDate').value;
  if (!tDate) return;
  const [y, m, d] = tDate.split('-');
  
  const selectedDateObj = new Date(y, m - 1, d); const todayObj = new Date(); todayObj.setHours(0,0,0,0); selectedDateObj.setHours(0,0,0,0);
  const diffDays = Math.round((selectedDateObj - todayObj) / (1000 * 60 * 60 * 24));
  let prefixText = "Ngày "; if (diffDays === 0) prefixText = "Hôm nay, "; else if (diffDays === -1) prefixText = "Hôm qua, "; else if (diffDays === 1) prefixText = "Ngày mai, ";
  
  document.getElementById('displayCurrentDate').textContent = `${prefixText}${d}/${m}/${y}`;
  const cacheKey = `${d}/${m}/${y}`;
  const currDateObj = new Date(y, m - 1, d); currDateObj.setDate(currDateObj.getDate() - 1);
  const prevDateStr = formatDateToDDMMYYYY(currDateObj); const prevM = String(currDateObj.getMonth() + 1).padStart(2, '0');
  let compareSuffix = diffDays !== 0 ? `so với ngày ${prevDateStr}` : "so với hôm qua";
  
  if (!forceRefresh && cachedTransactions && cachedTransactions.cacheKey === cacheKey) { displayTransactions(); return; }

  showLoading(true, 'tab1');
  try {
    const currDateStr = `${d}/${m}/${y}`;
    let dataCurrMonth, dataPrevMonth;
    if (m === prevM) { dataCurrMonth = await fetchMonthData(m); dataPrevMonth = dataCurrMonth; } 
    else { [dataCurrMonth, dataPrevMonth] = await Promise.all([ fetchMonthData(m), fetchMonthData(prevM) ]); }

    let dataCurr = dataCurrMonth.filter(t => t.date === currDateStr);
    let dataPrev = dataPrevMonth.filter(t => t.date === prevDateStr);
    dataCurr.sort((a,b) => b.id.localeCompare(a.id)); dataPrev.sort((a,b) => b.id.localeCompare(a.id));
    
    cachedTransactions = { cacheKey, data: dataCurr, prevData: dataPrev, compareSuffix: compareSuffix };
    currentPageTab1 = 1; displayTransactions();
  } catch (err) { cachedTransactions = { cacheKey, data: [], prevData: [], compareSuffix: compareSuffix }; displayTransactions(); }
  finally { showLoading(false, 'tab1'); }
};

function displayTransactions() {
  const data = cachedTransactions?.data || [];
  const prevData = cachedTransactions?.prevData || [];
  const compSuffix = cachedTransactions?.compareSuffix || 'so với hôm qua'; 
  const container = document.getElementById('transactionsContainer'); container.innerHTML = '';
  
  let tInc = 0, tExp = 0; if (Array.isArray(data)) data.forEach(i => { if (i.type === 'Thu nhập') tInc += i.amount; else tExp += i.amount; });
  const tBal = tInc - tExp;
  let pInc = 0, pExp = 0; if (Array.isArray(prevData)) prevData.forEach(i => { if (i.type === 'Thu nhập') pInc += i.amount; else pExp += i.amount; });
  const pBal = pInc - pExp;

  const heroExpMain = document.getElementById('heroExpenseMain');
  if(heroExpMain) heroExpMain.innerHTML = `${formatNumberWithCommas(tExp.toString())}<span style="font-size: 1.4rem; opacity: 0.8; margin-left: 2px;">đ</span>`;
  const heroInc = document.getElementById('heroIncome'); if(heroInc) heroInc.textContent = formatNumberWithCommas(tInc.toString()) + 'đ';
  const heroBalSub = document.getElementById('heroBalanceSub');
  if(heroBalSub) { let sign = tBal > 0 ? '+' : (tBal < 0 ? '−' : ''); heroBalSub.textContent = `${sign}${formatNumberWithCommas(Math.abs(tBal).toString())}đ`; }
  
  const heroExpCompare = document.getElementById('heroExpenseCompare');
  if(heroExpCompare) heroExpCompare.innerHTML = getCompareHTML(tExp, pExp, 'expense', compSuffix);
  
  const headerTitle = document.querySelector('#tab1 .section-title');
  if(headerTitle) headerTitle.innerHTML = `GIAO DỊCH TRONG NGÀY <span style="font-size: 0.75rem; color: var(--text-2); text-transform: none;">(Tổng: ${data.length})</span>`;

  if (data.length === 0) {
    document.getElementById('placeholderTab1').style.display = 'block';
    document.getElementById('pagination').style.display = 'none'; return;
  }
  document.getElementById('placeholderTab1').style.display = 'none';
  document.getElementById('pagination').style.display = 'flex';
  
  const tPages = Math.ceil(data.length / itemsPerPage);
  const pData = data.slice((currentPageTab1 - 1) * itemsPerPage, currentPageTab1 * itemsPerPage);

  pData.forEach((item, index) => {
    const isInc = item.type === 'Thu nhập'; const tCls = isInc ? 'income' : 'expense';
    const icon = getCategoryIcon(item.category);
    const stt = (currentPageTab1 - 1) * itemsPerPage + index + 1;
    
    const card = document.createElement('div'); card.className = `tx-card ${tCls}`;
    card.innerHTML = `
      <div class="tx-icon-wrap ${tCls}" style="font-size: 1.3rem;">${icon}</div>
      <div class="tx-body">
        <div class="tx-title">${escapeHTML(item.content)}</div>
        <div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
           <span class="tx-date" style="margin-right: 2px;">${escapeHTML(formatDate(item.date))}</span>
           <span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${escapeHTML(item.type)}</span>
           <span class="tx-badge ${tCls}">${escapeHTML(item.category)}</span>
        </div>
        ${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${escapeHTML(item.note)}</div>` : ''}
        <div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;">
           <span>STT: ${stt}</span> • <span>#${escapeHTML(item.id)}</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <div class="tx-amount ${tCls}"><span>${isInc ? '+' : '−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div>
        <div class="tx-actions">
           <button class="tx-btn edit-btn" data-id="${escapeHTML(item.id)}" title="Sửa"><i class="fas fa-pen"></i></button>
           <button class="tx-btn delete-btn" data-id="${escapeHTML(item.id)}" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  document.getElementById('pageInfo').textContent = `${currentPageTab1} / ${tPages}`;
  document.getElementById('prevPage').disabled = currentPageTab1 === 1;
  document.getElementById('nextPage').disabled = currentPageTab1 === tPages;
  document.getElementById('prevPage').onclick = () => { triggerHaptic('light'); if(currentPageTab1 > 1) { currentPageTab1--; displayTransactions(); } };
  document.getElementById('nextPage').onclick = () => { triggerHaptic('light'); if(currentPageTab1 < tPages) { currentPageTab1++; displayTransactions(); } };
  document.querySelectorAll('#transactionsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id'))));
  document.querySelectorAll('#transactionsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

// ---------------- CÁC BÁO CÁO ----------------
function getWeekNumber(d) { d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7)); var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1)); return Math.ceil((((d - yearStart) / 86400000) + 1)/7); }
function formatWeekInput(date) { return `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`; }
function getDateFromWeekString(weekStr) { const [yearStr, weekPart] = weekStr.split('-W'); if(!yearStr || !weekPart) return null; const year = parseInt(yearStr); const week = parseInt(weekPart); const simple = new Date(year, 0, 1 + (week - 1) * 7); const dow = simple.getDay(); const start = new Date(simple); if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1); else start.setDate(simple.getDate() + 8 - simple.getDay()); return start; }

async function getTransactionsInRange(startDate, endDate) {
    const startStr = formatDateToYYYYMMDD(startDate); const endStr = formatDateToYYYYMMDD(endDate); const cacheKey = startStr + '_' + endStr;
    if (window.apiTxCache[cacheKey]) return window.apiTxCache[cacheKey];
    try {
        const sY = startDate.getFullYear(), eY = endDate.getFullYear(); let txs = []; let fetchPromises = [];
        for (let y = sY; y <= eY; y++) { let sM = (y === sY) ? startDate.getMonth() + 1 : 1; let eM = (y === eY) ? endDate.getMonth() + 1 : 12;
            for (let m = sM; m <= eM; m++) { fetchPromises.push((async () => { let monthData = await fetchMonthData(m); return { y, m, data: monthData }; })()); }
        }
        const monthsResults = await Promise.all(fetchPromises);
        monthsResults.forEach(res => { res.data.forEach(t => { const dParts = t.date.split('/'); const txDate = new Date(res.y, parseInt(dParts[1], 10) - 1, parseInt(dParts[0], 10)); if (txDate >= startDate && txDate <= endDate) txs.push(t); }); });
        window.apiTxCache[cacheKey] = txs; return txs;
    } catch (e) { return []; }
}

function processReportData(currentTx, prevTx, labels, incs, exps) {
    let tInc = 0, tExp = 0; currentTx.forEach(i => { if(i.type==='Thu nhập') tInc += i.amount; else tExp += i.amount; });
    const tBal = tInc - tExp;
    let pInc = 0, pExp = 0; prevTx.forEach(i => { if(i.type==='Thu nhập') pInc += i.amount; else pExp += i.amount; });
    const pBal = pInc - pExp;
    
    document.getElementById('tab2Income').textContent = formatNumberWithCommas(tInc.toString()) + 'đ';
    document.getElementById('tab2Expense').textContent = formatNumberWithCommas(tExp.toString()) + 'đ';
    let sign = tBal > 0 ? '+' : (tBal < 0 ? '−' : '');
    document.getElementById('tab2Balance').innerHTML = `${sign}${formatNumberWithCommas(Math.abs(tBal).toString())}đ`;
    
    let compareText = currentFilterMode === 'weekly' ? 'so với tuần trước' : (currentFilterMode === 'monthly' ? 'so với tháng trước' : 'so với năm trước');
    document.getElementById('tab2IncomeCompare').innerHTML = getCompareHTML(tInc, pInc, 'income', compareText);
    document.getElementById('tab2ExpenseCompare').innerHTML = getCompareHTML(tExp, pExp, 'expense', compareText);
    document.getElementById('tab2BalanceCompare').innerHTML = getCompareHTML(tBal, pBal, 'balance', compareText);
    
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (window.mChart) window.mChart.destroy();
    window.mChart = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [ { label: 'Thu nhập', data: incs, backgroundColor: '#10B981', borderRadius: 0, maxBarThickness: 20 }, { label: 'Chi tiêu', data: exps, backgroundColor: '#F43F5E', borderRadius: 0, maxBarThickness: 20 } ]}, options: { devicePixelRatio: 4, responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } }, scales: { x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' } } }, y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' }, callback: v => v >= 1000 ? (v/1000)+'K' : v } } }, plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumberWithCommas(ctx.raw.toString())}đ` } } } } });

    const catMap = {}; currentTx.forEach(t => { if(t.type==='Chi tiêu') catMap[t.category] = (catMap[t.category]||0)+t.amount; });
    drawMonthlyPieChart(Object.keys(catMap).map(k => ({category: k, amount: catMap[k]})));
    document.querySelector('#tab2 .chart-container').style.display = 'block';
}

function drawMonthlyPieChart(data) {
  const ctx = document.getElementById('monthlyPieChart').getContext('2d');
  if(window.pChart) window.pChart.destroy();
  data.sort((a,b) => b.amount - a.amount);
  const amts = data.map(i=>i.amount); const lbls = data.map(i=>i.category); const bg = data.map((_,i)=>getColorByIndex(i));
  const total = amts.reduce((a,b)=>a+b,0);
  
  window.pChart = new Chart(ctx, { type: 'doughnut', data: { labels:lbls, datasets: [{data:amts, backgroundColor:bg, borderWidth: 0, hoverOffset: 4}] }, options: { devicePixelRatio: 4, cutout:'75%', layout: {padding: 8}, plugins: { legend: {display:false}, tooltip: { enabled: false } }, onClick: (event, activeEls) => { if (activeEls && activeEls.length > 0) { const activeIdx = activeEls[0].index; const catName = lbls[activeIdx]; const catAmt = amts[activeIdx]; const color = bg[activeIdx]; currentPageCategory = 1; showCategoryDetail(catName, catAmt, color); } } }, plugins: [{ id:'cText', afterDraw(c) { const {ctx} = c; ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; const activeEls = c.getActiveElements(); if (activeEls && activeEls.length > 0) { const activeIdx = activeEls[0].index; const catName = c.data.labels[activeIdx]; const catAmt = c.data.datasets[0].data[activeIdx]; const color = c.data.datasets[0].backgroundColor[activeIdx]; const pct = total > 0 ? ((catAmt/total)*100).toFixed(1) : 0; let shortName = catName.length > 14 ? catName.substring(0, 14) + '...' : catName; ctx.fillStyle = '#94A3B8'; ctx.font = '600 9px Plus Jakarta Sans'; ctx.fillText(shortName, c.width/2, c.height/2 - 12); ctx.fillStyle = color; ctx.font = '800 12px Plus Jakarta Sans'; ctx.fillText(formatNumberWithCommas(catAmt.toString()) + 'đ', c.width/2, c.height/2 + 4); ctx.fillStyle = '#94A3B8'; ctx.font = '500 9px Plus Jakarta Sans'; ctx.fillText(`(${pct}%)`, c.width/2, c.height/2 + 16); } else { ctx.fillStyle='#94A3B8'; ctx.font='500 10px Plus Jakarta Sans'; ctx.fillText('Tổng chi', c.width/2, c.height/2 - 10); ctx.fillStyle='#F43F5E'; ctx.font='800 13px Plus Jakarta Sans'; ctx.fillText(formatNumberWithCommas(total.toString()) + 'đ', c.width/2, c.height/2 + 8); } ctx.restore(); } }] });

  const leg = document.getElementById('monthlyCustomLegend'); if(leg) leg.innerHTML = '';
  const progList = document.getElementById('monthlyCategoryProgressList'); if(progList) progList.innerHTML = '';

  data.forEach((i, idx) => {
    const pct = total>0 ? ((i.amount/total)*100).toFixed(1) : 0; const c = bg[idx];
    const catIconHTML = getCategoryIcon(i.category);

    if (leg) { 
        const divLeg = document.createElement('div'); divLeg.className = 'legend-item'; 
        divLeg.innerHTML = `
          <div class="legend-item-left">
             <span style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; color:${c}; font-size:13px; margin-right: 8px;">${catIconHTML}</span>
             <span class="legend-name" title="${escapeHTML(i.category)}">${escapeHTML(i.category)}</span>
          </div>
          <div class="legend-value-col">
             <span class="legend-pct" style="color:${c}; font-size: 0.8rem; font-weight: 700;">${pct}%</span>
          </div>
        `; 
        divLeg.onclick = () => { triggerHaptic('light'); currentPageCategory = 1; showCategoryDetail(i.category, i.amount, c); }; 
        leg.appendChild(divLeg); 
    }
    
    if (progList) { 
        const divProg = document.createElement('div'); divProg.className = 'cat-progress-card'; 
        divProg.innerHTML = `
          <div class="cat-progress-header">
            <div class="cat-progress-info">
              <div class="cat-progress-icon" style="background:${c}22; color:${c}; font-size: 1.3rem;">${catIconHTML}</div>
              <span class="cat-progress-title">${escapeHTML(i.category)}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
              <span class="cat-progress-amt" style="color:${c}">${formatNumberWithCommas(i.amount.toString())}đ</span>
              <span style="font-size: 0.65rem; color: var(--text-3); font-weight: 600;">${pct}%</span>
            </div>
          </div>
          <div class="cat-progress-bar-bg"><div class="cat-progress-bar-fill" style="width:${pct}%; background:${c}"></div></div>
        `; 
        divProg.onclick = () => { triggerHaptic('light'); currentPageCategory = 1; showCategoryDetail(i.category, i.amount, c); }; 
        progList.appendChild(divProg); 
    }
  });
}

async function loadWeeklyReport(weekStr) { showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none'; document.getElementById('placeholderTab2').style.display='none'; try { const startDate = getDateFromWeekString(weekStr); if (!startDate) throw new Error("Dữ liệu tuần không hợp lệ"); const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6); const prevStartDate = new Date(startDate); prevStartDate.setDate(prevStartDate.getDate() - 7); const prevEndDate = new Date(endDate); prevEndDate.setDate(prevEndDate.getDate() - 7); const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]); document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (${formatDateToDDMMYYYY(startDate).substring(0,5)} - ${formatDateToDDMMYYYY(endDate).substring(0,5)})`; const dayNames = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7']; const labels = [], incs = [], exps = []; for(let i=0; i<7; i++) { const d = new Date(startDate); d.setDate(d.getDate() + i); labels.push(`${dayNames[d.getDay()]}\nNgày ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`); const dateStr = formatDateToDDMMYYYY(d); const dayTx = currentTx.filter(t => t.date === dateStr); let inc = 0, exp = 0; dayTx.forEach(t => { if(t.type==='Thu nhập') inc+=t.amount; else exp+=t.amount; }); incs.push(inc); exps.push(exp); } processReportData(currentTx, prevTx, labels, incs, exps); cachedChartData = { mode: 'weekly', txs: currentTx, periodStr: weekStr }; } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); } }
async function loadMonthlyReport(monthStr) { showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none'; document.getElementById('placeholderTab2').style.display='none'; try { const [year, month] = monthStr.split('-').map(Number); const startDate = new Date(year, month - 1, 1); const endDate = new Date(year, month, 0); let prevM = month - 1; let prevY = year; if(prevM === 0) { prevM = 12; prevY = year - 1; } const prevStartDate = new Date(prevY, prevM - 1, 1); const prevEndDate = new Date(prevY, prevM, 0); const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]); document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (Tháng ${month}/${year})`; const labels = [`Tháng ${month}`], incs = [0], exps = [0]; currentTx.forEach(t => { if(t.type==='Thu nhập') incs[0]+=t.amount; else exps[0]+=t.amount; }); processReportData(currentTx, prevTx, labels, incs, exps); cachedChartData = { mode: 'monthly', txs: currentTx, periodStr: monthStr }; } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); } }
async function loadCustomReport(startMonth, endMonth, year) { showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none'; document.getElementById('placeholderTab2').style.display='none'; try { const startDate = new Date(year, startMonth - 1, 1); const endDate = new Date(year, endMonth, 0); const prevStartDate = new Date(year - 1, startMonth - 1, 1); const prevEndDate = new Date(year - 1, endMonth, 0); const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]); document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (T${startMonth} - T${endMonth} / ${year})`; const labels = [], incs = [], exps = []; for(let m=startMonth; m<=endMonth; m++) { labels.push(`Tháng ${m}`); const mTx = currentTx.filter(t => parseInt(t.date.split('/')[1]) === m && parseInt(t.date.split('/')[2]) === year); let inc=0, exp=0; mTx.forEach(t => { if(t.type==='Thu nhập') inc+=t.amount; else exp+=t.amount; }); incs.push(inc); exps.push(exp); } processReportData(currentTx, prevTx, labels, incs, exps); cachedChartData = { mode: 'custom', txs: currentTx, periodStr: `${startMonth}-${endMonth}-${year}` }; } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); } }

function updateTimeNavUI() {
   const label = document.getElementById('currentPeriodLabel'); const weekP = document.getElementById('weekPicker'); const monthP = document.getElementById('monthPicker'); const timeNav = document.getElementById('timeNavContainer'); const customNav = document.getElementById('customFilterContainer');
   if (currentFilterMode === 'weekly') { timeNav.style.display = 'flex'; customNav.style.display = 'none'; weekP.style.display = 'block'; monthP.style.display = 'none'; const wStr = formatWeekInput(activePeriodDate); weekP.value = wStr; label.textContent = `Tuần ${getWeekNumber(activePeriodDate)}, ${activePeriodDate.getFullYear()}`; loadWeeklyReport(wStr); } 
   else if (currentFilterMode === 'monthly') { timeNav.style.display = 'flex'; customNav.style.display = 'none'; weekP.style.display = 'none'; monthP.style.display = 'block'; const mStr = `${activePeriodDate.getFullYear()}-${String(activePeriodDate.getMonth()+1).padStart(2,'0')}`; monthP.value = mStr; label.textContent = `Tháng ${activePeriodDate.getMonth()+1}/${activePeriodDate.getFullYear()}`; loadMonthlyReport(mStr); } 
   else if (currentFilterMode === 'yearly') { timeNav.style.display = 'none'; customNav.style.display = 'none'; loadCustomReport(1, 12, new Date().getFullYear()); } 
   else if (currentFilterMode === 'custom') { timeNav.style.display = 'none'; customNav.style.display = 'flex'; const curM = new Date().getMonth() + 1; document.getElementById('startMonth').value = '1'; document.getElementById('endMonth').value = curM.toString(); }
}

async function showCategoryDetail(cat, amt, color) {
  savedScrollPositionTab2 = window.scrollY || document.documentElement.scrollTop;
  document.getElementById('tab2Overview').style.display='none'; 
  const detailView = document.getElementById('categoryDetailView'); detailView.style.display='block'; detailView.classList.remove('slide-out-right'); detailView.classList.add('slide-in-right'); window.scrollTo(0, 0);
  document.getElementById('categoryDetailTitle').textContent = cat; document.getElementById('categoryDetailTitle').style.color = color;
  const totalAmtEl = document.getElementById('categoryDetailTotalAmt'); if(totalAmtEl) { totalAmtEl.textContent = formatNumberWithCommas(amt.toString()) + 'đ'; totalAmtEl.style.color = color; }
  const txs = cachedChartData.txs.filter(t => t.category === cat);
  const detailHeader = document.getElementById('categoryDetailListTitle'); if(detailHeader) detailHeader.innerHTML = `Giao dịch chi tiết <span style="font-size: 0.75rem; color: var(--text-2); text-transform: none;">(Tổng: ${txs.length})</span>`;
  const ctx = document.getElementById('categoryMonthlyChart').getContext('2d'); if (window.categoryMonthlyChartInstance) window.categoryMonthlyChartInstance.destroy();
  let chartLabels = [], chartData = [];
  if (cachedChartData.mode === 'weekly') { const map = {}; txs.forEach(t => { map[t.date] = (map[t.date]||0) + t.amount; }); chartLabels = Object.keys(map).map(d => `Ngày ${d.substring(0,5)}`); chartData = Object.values(map); } 
  else { const map = {}; txs.forEach(t => { const m = parseInt(t.date.split('/')[1]); map[m] = (map[m]||0) + t.amount; }); const allMonths = [...new Set(cachedChartData.txs.map(t => parseInt(t.date.split('/')[1])))].sort((a,b)=>a-b); chartLabels = allMonths.map(m => `Tháng ${m}`); chartData = allMonths.map(m => map[m] || 0); }
  window.categoryMonthlyChartInstance = new Chart(ctx, { type: 'bar', data: { labels: chartLabels, datasets: [{label: cat, data: chartData, backgroundColor: color+'CC', borderColor: color, borderWidth: 1, borderRadius: 0, maxBarThickness: 20}] }, options: { responsive: true, maintainAspectRatio: false, layout: {padding:{top:10}}, scales: { x:{grid:{display:false}, ticks:{color:'#94A3B8', font:{size:10, family:'Plus Jakarta Sans'}}}, y:{ticks:{callback:v=>v>=1000?(v/1000)+'K':v, color:'#94A3B8', font:{size:10, family:'Plus Jakarta Sans'}}, grid:{color:'rgba(255,255,255,0.05)'}} }, plugins: { legend:{display:false}, tooltip: {callbacks:{label:ctx=>`${formatNumberWithCommas(ctx.raw.toString())}đ`}} } } });
  displayCategoryTransactionsList(txs);
}

function displayCategoryTransactionsList(txs) {
  const list = document.getElementById('categoryTransactionsContainer'); list.innerHTML = '';
  if(txs.length === 0) { list.innerHTML = '<div class="empty-state">Không có giao dịch nào</div>'; document.getElementById('paginationCategoryDetail').style.display = 'none'; return; }
  document.getElementById('paginationCategoryDetail').style.display = 'flex';
  const tPages = Math.ceil(txs.length / itemsPerPage); const pData = txs.slice((currentPageCategory - 1) * itemsPerPage, currentPageCategory * itemsPerPage);
  pData.forEach((item, index) => { const tCls = item.type === 'Thu nhập' ? 'income' : 'expense'; const icon = getCategoryIcon(item.category); const stt = (currentPageCategory - 1) * itemsPerPage + index + 1; const card = document.createElement('div'); card.className = `tx-card ${tCls}`; card.innerHTML = `<div class="tx-icon-wrap ${tCls}" style="font-size: 1.3rem;">${icon}</div><div class="tx-body"><div class="tx-title">${escapeHTML(item.content)}</div><div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;"><span class="tx-date" style="margin-right: 2px;">${escapeHTML(formatDate(item.date))}</span><span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${escapeHTML(item.type)}</span><span class="tx-badge ${tCls}">${escapeHTML(item.category)}</span></div>${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${escapeHTML(item.note)}</div>` : ''}<div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;"><span>STT: ${stt}</span> • <span>#${escapeHTML(item.id)}</span></div></div><div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;"><div class="tx-amount ${tCls}"><span>${item.type==='Thu nhập'?'+':'−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div><div class="tx-actions"><button class="tx-btn edit-btn" data-id="${escapeHTML(item.id)}"><i class="fas fa-pen"></i></button><button class="tx-btn delete-btn" data-id="${escapeHTML(item.id)}"><i class="fas fa-trash"></i></button></div></div>`; list.appendChild(card); });
  document.getElementById('pageInfoCategoryDetail').textContent = `${currentPageCategory} / ${tPages}`; document.getElementById('prevPageCategoryDetail').disabled = currentPageCategory === 1; document.getElementById('nextPageCategoryDetail').disabled = currentPageCategory === tPages; document.getElementById('prevPageCategoryDetail').onclick = () => { triggerHaptic('light'); if(currentPageCategory > 1) { currentPageCategory--; displayCategoryTransactionsList(txs); } }; document.getElementById('nextPageCategoryDetail').onclick = () => { triggerHaptic('light'); if(currentPageCategory < tPages) { currentPageCategory++; displayCategoryTransactionsList(txs); } };
  document.querySelectorAll('#categoryTransactionsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(txs.find(i => String(i.id) === btn.getAttribute('data-id')))); document.querySelectorAll('#categoryTransactionsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

function closeCategoryDetailView() { triggerHaptic('light'); const overview = document.getElementById('tab2Overview'); const detailView = document.getElementById('categoryDetailView'); detailView.classList.remove('slide-in-right'); detailView.classList.add('slide-out-right'); setTimeout(() => { detailView.style.display = 'none'; overview.style.display = 'block'; overview.classList.add('fade-in-view'); window.scrollTo(0, savedScrollPositionTab2); setTimeout(() => { overview.classList.remove('fade-in-view'); }, 300); }, 250); }
document.getElementById('backToCategoryBtn')?.addEventListener('click', closeCategoryDetailView);
const categoryView = document.getElementById('categoryDetailView'); let touchStartX = 0, touchStartY = 0; categoryView.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, { passive: true }); categoryView.addEventListener('touchend', e => { const swipeDistanceX = e.changedTouches[0].screenX - touchStartX; const swipeDistanceY = Math.abs(e.changedTouches[0].screenY - touchStartY); if (swipeDistanceX > 70 && swipeDistanceY < 50) closeCategoryDetailView(); }, { passive: true });

// ---------------- TAB 3: TÌM KIẾM ----------------
function displaySearchResults() {
    const list = document.getElementById('searchResultsContainer'); list.innerHTML='';
    const data = cachedSearchResults;
    const headerTitle = document.querySelector('#tab3 .notification');
    if(headerTitle) headerTitle.innerHTML = `Tìm thấy <strong style="color: var(--primary-light);">${data.length}</strong> giao dịch phù hợp`;

    if(!data || data.length === 0) {
        document.getElementById('placeholderTab3').style.display = 'block';
        document.getElementById('paginationSearch').style.display = 'none';
        return;
    }
    document.getElementById('placeholderTab3').style.display = 'none';
    document.getElementById('paginationSearch').style.display = 'flex';
    
    const tPages = Math.ceil(data.length / itemsPerPage); const pData = data.slice((currentPageSearch - 1) * itemsPerPage, currentPageSearch * itemsPerPage);
    pData.forEach((item, index) => { const tCls = item.type==='Thu nhập'?'income':'expense'; const icon = getCategoryIcon(item.category); const stt = (currentPageSearch - 1) * itemsPerPage + index + 1; const card = document.createElement('div'); card.className = `tx-card ${tCls}`; card.innerHTML = `<div class="tx-icon-wrap ${tCls}" style="font-size: 1.3rem;">${icon}</div><div class="tx-body"><div class="tx-title">${escapeHTML(item.content)}</div><div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;"><span class="tx-date" style="margin-right: 2px;">${escapeHTML(formatDate(item.date))}</span><span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${escapeHTML(item.type)}</span><span class="tx-badge ${tCls}">${escapeHTML(item.category)}</span></div>${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${escapeHTML(item.note)}</div>` : ''}<div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;"><span>STT: ${stt}</span> • <span>#${escapeHTML(item.id)}</span></div></div><div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;"><div class="tx-amount ${tCls}"><span>${item.type==='Thu nhập'?'+':'−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div><div class="tx-actions"><button class="tx-btn edit-btn" data-id="${escapeHTML(item.id)}"><i class="fas fa-pen"></i></button><button class="tx-btn delete-btn" data-id="${escapeHTML(item.id)}"><i class="fas fa-trash"></i></button></div></div>`; list.appendChild(card); });
    document.getElementById('pageInfoSearch').textContent = `${currentPageSearch} / ${tPages}`; document.getElementById('prevPageSearch').disabled = currentPageSearch === 1; document.getElementById('nextPageSearch').disabled = currentPageSearch === tPages; document.getElementById('prevPageSearch').onclick = () => { triggerHaptic('light'); if(currentPageSearch > 1) { currentPageSearch--; displaySearchResults(); } }; document.getElementById('nextPageSearch').onclick = () => { triggerHaptic('light'); if(currentPageSearch < tPages) { currentPageSearch++; displaySearchResults(); } };
    document.querySelectorAll('#searchResultsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id')))); document.querySelectorAll('#searchResultsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

// ---------------- TAB 4: TÌM KIẾM TỪ KHÓA ----------------
window.loadKeywords = async function(isInit = false) {
    if(!isInit) showLoading(true, 'tab4');
    if(!isInit) document.getElementById('keywordsContainer').innerHTML = '';
    try {
        const iconRes = await fetch(`${FIREBASE_URL}/categoryIcons.json`); const iconData = await iconRes.json(); if(iconData) window.customCategoryIcons = iconData;
        const res = await fetch(`${FIREBASE_URL}/keywords.json`); let data = await res.json();
        if(!data) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getKeywords&sheetId=${sheetId}`)); data = await gasRes.json(); }
        cachedKeywords = data || []; window.categoryIconMap = {}; cachedKeywords.forEach(kw => { if (kw && kw.category && kw.icon) window.categoryIconMap[kw.category.trim()] = kw.icon.trim(); });
        if(!isInit) displayKeywords();
    } catch(e) { if(!isInit) showToast(e.message, 'error'); } finally { if(!isInit) showLoading(false, 'tab4'); }
};

window.startEditKeyword = function(kw, category) { triggerHaptic('light'); document.getElementById('keywordInput').value = kw; document.getElementById('keywordCategory').value = category; currentEditKeyword = kw; const btnAdd = document.getElementById('addKeywordBtn'); btnAdd.innerHTML = '<i class="fas fa-save"></i> Lưu sửa'; btnAdd.classList.add('btn-edit-kw'); document.getElementById('cancelKeywordBtn').style.display = 'block'; document.getElementById('deleteEditKeywordBtn').style.display = 'block'; };
window.cancelEditKeyword = function() { triggerHaptic('light'); document.getElementById('keywordInput').value = ''; currentEditKeyword = null; const btnAdd = document.getElementById('addKeywordBtn'); btnAdd.innerHTML = '<i class="fas fa-plus"></i> Thêm'; btnAdd.classList.remove('btn-edit-kw'); document.getElementById('cancelKeywordBtn').style.display = 'none'; document.getElementById('deleteEditKeywordBtn').style.display = 'none'; };

function displayKeywords() {
   const container = document.getElementById('keywordsContainer'); container.innerHTML = '';
   if(!cachedKeywords || cachedKeywords.length === 0) { document.getElementById('placeholderTab4').style.display = 'block'; return; }
   document.getElementById('placeholderTab4').style.display = 'none';
   const groupedKeywords = {}; cachedKeywords.forEach(item => { const category = item.category || 'Khác'; if (!groupedKeywords[category]) groupedKeywords[category] = { keywords: [] }; if (item.keywords && typeof item.keywords === 'string') { const kwsArray = item.keywords.split(',').map(k => k.trim()).filter(k => k !== ''); kwsArray.forEach(kw => { if (!groupedKeywords[category].keywords.includes(kw)) groupedKeywords[category].keywords.push(kw); }); } });
   
   // Sắp xếp danh mục từ khóa hiển thị A-Z
   Object.keys(groupedKeywords).sort((a,b) => a.localeCompare(b, 'vi')).forEach(category => { 
       const group = groupedKeywords[category]; 
       let tagsHTML = ''; 
       // Sắp xếp các từ khóa con A-Z
       group.keywords.sort((a,b) => a.localeCompare(b, 'vi')).forEach(kw => { 
           tagsHTML += `<span style="display:inline-block; background:var(--bg-card2); padding:6px 12px; border-radius:12px; font-size:0.75rem; color:var(--text-1); margin: 0 6px 6px 0; border:1px solid rgba(255,255,255,0.05); cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='var(--balance)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.05)'" onclick="startEditKeyword('${escapeHTML(kw)}', '${escapeHTML(category)}')">${escapeHTML(kw)}</span>`; 
       }); 
       const div = document.createElement('div'); div.className = 'tx-card'; div.style.cssText = 'padding:14px; margin-bottom:16px; flex-direction:column; align-items:flex-start; gap:10px;'; div.innerHTML = `<div style="display:flex; align-items:center; gap:12px; width:100%;"><div class="tx-icon-wrap expense" style="font-size: 1.3rem;">${getCategoryIcon(category)}</div><div class="tx-body"><div class="tx-title" style="font-size:0.95rem;">${escapeHTML(category)}</div><div class="tx-meta" style="font-size: 0.65rem; color: var(--text-2);">${group.keywords.length} từ khóa</div></div></div><div style="width:100%; display:flex; flex-wrap:wrap; margin-top:4px;">${tagsHTML || '<span style="font-size:0.75rem; color:var(--text-3); font-style:italic;">Chưa có từ khóa</span>'}</div>`; container.appendChild(div); 
   });
}

// ---------------- CÁC HÀM MODALS GIAO DỊCH ----------------
async function fetchCategories() { 
    try { 
        const res = await fetch(`${FIREBASE_URL}/categories.json`); 
        let cats = await res.json(); 
        if(!cats) { 
            const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getCategories&sheetId=${sheetId}`)); 
            cats = await gasRes.json(); 
        } 
        if (cats && Array.isArray(cats)) cats.sort((a, b) => a.localeCompare(b, 'vi')); // Tự động sắp xếp A-Z
        return cats || []; 
    } catch(e) { return []; } 
}

window.selectType = function(formId, type, el) { triggerHaptic('light'); document.getElementById(formId + 'Type').value = type; const pills = el.parentElement.querySelectorAll('.type-pill'); pills.forEach(p => p.classList.remove('income-active', 'expense-active')); if(type === 'Chi tiêu') el.classList.add('expense-active'); else el.classList.add('income-active'); };

window.openAddForm = async function() {
  triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('addModal').classList.add('show'), 10);
  document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập'; else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu'; });
  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date()); document.getElementById('addContent').value = ''; document.getElementById('addAmount').value = ''; document.getElementById('addNote').value = ''; document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Chi tiêu')) p.click(); });
  const catSel = document.getElementById('addCategory'); catSel.innerHTML = ''; const cats = await fetchCategories(); cats.forEach(c => catSel.appendChild(new Option(c, c)));
};
window.closeAddForm = function() { document.getElementById('addModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };

window.openEditForm = async function(tx) {
  if(!tx) return; triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('editModal').classList.add('show'), 10);
  const pills = document.querySelectorAll('#editModal .type-pill'); pills.forEach(p => { if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập'; else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu'; });
  document.getElementById('editTransactionId').value = tx.id; document.getElementById('editContent').value = tx.content; document.getElementById('editAmount').value = formatNumberWithCommas(tx.amount.toString()); document.getElementById('editNote').value = tx.note || ''; const [d,m,y] = tx.date.split('/'); document.getElementById('editDate').value = `${y}-${m}-${d}`;
  pills.forEach(p => { if(tx.type === 'Thu nhập' && p.textContent.includes('Thu nhập')) p.click(); if(tx.type === 'Chi tiêu' && p.textContent.includes('Chi tiêu')) p.click(); });
  const catSel = document.getElementById('editCategory'); catSel.innerHTML = ''; const cats = await fetchCategories(); cats.forEach(c => { const opt = new Option(c, c); if(c === tx.category) opt.selected = true; catSel.appendChild(opt); });
};
window.closeEditForm = function() { document.getElementById('editModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.closeAllModals = function() { 
  closeAddForm(); closeEditForm(); 
  if (document.getElementById('confirmDeleteModal')) document.getElementById('confirmDeleteModal').classList.remove('show'); 
  if (document.getElementById('iconPickerModal')) document.getElementById('iconPickerModal').classList.remove('show');
  if (document.getElementById('pdfPreviewModal')) document.getElementById('pdfPreviewModal').classList.remove('show');
};
window.closeConfirmDeleteModal = function() { document.getElementById('confirmDeleteModal').classList.remove('show'); };

document.getElementById('addForm').onsubmit = async function(e) { e.preventDefault(); closeAddForm(); const [y,m,d] = document.getElementById('addDate').value.split('-'); const tx = { content: document.getElementById('addContent').value, amount: parseNumber(document.getElementById('addAmount').value), type: document.getElementById('addType').value, category: document.getElementById('addCategory').value, note: document.getElementById('addNote').value, date: `${d}/${m}/${y}`, action: 'addTransaction', sheetId }; await submitTx(tx); };
document.getElementById('editForm').onsubmit = async function(e) { e.preventDefault(); closeEditForm(); const [y,m,d] = document.getElementById('editDate').value.split('-'); const tx = { id: document.getElementById('editTransactionId').value, content: document.getElementById('editContent').value, amount: parseNumber(document.getElementById('editAmount').value), type: document.getElementById('editType').value, category: document.getElementById('editCategory').value, note: document.getElementById('editNote').value, date: `${d}/${m}/${y}`, month: m, action: 'updateTransaction', sheetId }; await submitTx(tx); };

async function submitTx(tx) {
  try {
    showToast("Đang lưu giao dịch...", "info");
    if (tx.action === 'addTransaction') { let maxId = 0; const allLoadedTxs = [...(cachedTransactions?.data || []), ...(cachedChartData?.txs || []), ...(cachedSearchResults || [])]; allLoadedTxs.forEach(item => { if (item.id && String(item.id).startsWith('GD') && !String(item.id).includes('_')) { let num = parseInt(String(item.id).replace('GD', ''), 10); if (!isNaN(num) && num > maxId) maxId = num; } }); tx.id = "GD" + String(maxId + 1).padStart(3, '0'); }
    const month = parseInt(tx.date.split('/')[1], 10); const fbTx = { id: tx.id, date: tx.date, type: tx.type, content: tx.content, amount: tx.amount, category: tx.category, note: tx.note };
    if (tx.action === 'addTransaction') { if (cachedTransactions?.data) cachedTransactions.data.unshift(fbTx); } else { [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => { if (!arr) return; const idx = arr.findIndex(i => String(i.id) === String(tx.id)); if (idx !== -1) arr[idx] = { ...arr[idx], ...fbTx }; }); }
    if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults();
    await fetch(`${FIREBASE_URL}/transactions/month_${month}/${tx.id}.json`, { method: 'PUT', body: JSON.stringify(fbTx) }); triggerHapticNotification('success'); showToast("Đã lưu giao dịch!", "success");
    fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify(tx) }).catch(e => console.log("Lỗi backup Sheet:", e));
  } catch(e) { showToast(e.message, "error"); }
}

window.deleteTransaction = function(id) {
  closeEditForm(); triggerHaptic('medium'); document.getElementById('modalOverlay').classList.add('show'); document.getElementById('confirmDeleteModal').classList.add('show');
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    document.getElementById('confirmDeleteModal').classList.remove('show'); document.getElementById('modalOverlay').classList.remove('show');
    let tx = null; if (cachedTransactions?.data) tx = cachedTransactions.data.find(i => String(i.id) === String(id)); if (!tx && cachedSearchResults) tx = cachedSearchResults.find(i => String(i.id) === String(id)); if (!tx && cachedChartData?.txs) tx = cachedChartData.txs.find(i => String(i.id) === String(id)); const monthToUpdate = tx ? parseInt(tx.date.split('/')[1], 10) : 1;
    [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => { if (!arr) return; const idx = arr.findIndex(i => String(i.id) === String(id)); if (idx !== -1) arr.splice(idx, 1); });
    if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI(); else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults(); showToast("Đang xóa giao dịch...", "info");
    try { await fetch(`${FIREBASE_URL}/transactions/month_${monthToUpdate}/${id}.json`, { method: 'DELETE' }); triggerHapticNotification('success'); showToast("Đã xóa giao dịch!", "success"); fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({action: 'deleteTransaction', id, month: monthToUpdate, sheetId}) }).catch(e => console.log("Lỗi xóa Sheet:", e)); } catch(e) { showToast(e.message, "error"); }
  };
};

window.exportToCSV = async function() {
    const isTab2 = document.getElementById('tab2').classList.contains('active'); const dataToExport = isTab2 ? (cachedChartData?.txs || []) : (cachedTransactions?.data || []);
    if (dataToExport.length === 0) return showToast("Không có dữ liệu giao dịch để xuất!", "warning");
    triggerHaptic('light'); let csvContent = "\uFEFFMã GD,Ngày,Phân loại,Danh mục,Số tiền,Nội dung,Ghi chú\n";
    dataToExport.forEach(t => { let content = t.content ? t.content.replace(/,/g, " ") : ""; let note = t.note ? t.note.replace(/,/g, " ") : ""; csvContent += `${t.id},${t.date},${t.type},${t.category},${t.amount},${content},${note}\n`; });
    const reportName = isTab2 ? (cachedChartData?.periodStr || "Bao_Cao") : formatDateToYYYYMMDD(new Date()); const fileName = `Giao_Dich_${reportName}.csv`; const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const platform = window.Telegram?.WebApp?.platform || 'unknown'; const isMobile = ['android', 'android_x', 'ios'].includes(platform.toLowerCase());
    if (isMobile && navigator.canShare) { try { const file = new File([blob], fileName, { type: 'text/csv' }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: fileName }); triggerHapticNotification('success'); return; } } catch (error) {} } 
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url); triggerHapticNotification('success'); showToast("Đã tải file CSV!", "success");
};

// 💎 XUẤT FILE BÁO CÁO PDF ĐÃ FIX CỘT THU - CHI LINH HOẠT
window.exportToPDF = function() {
    const isTab2 = document.getElementById('tab2').classList.contains('active');
    const data = isTab2 ? (cachedChartData?.txs || []) : (cachedTransactions?.data || []);
    
    if (data.length === 0) {
        return showToast("Không có dữ liệu giao dịch để tạo file PDF!", "warning");
    }
    if (typeof html2pdf === 'undefined') {
        return showToast("Thư viện xuất PDF chưa sẵn sàng, vui lòng thử lại sau!", "error");
    }
    
    triggerHaptic('medium');
    showToast("Đang chuẩn bị bản xem trước...", "info");

    let reportTitle = isTab2 ? document.getElementById('chartTitleTab2')?.textContent : "GIAO DỊCH TRONG NGÀY";
    if (!reportTitle) reportTitle = "BÁO CÁO TÀI CHÍNH";
    const reportNameForFile = isTab2 ? (cachedChartData?.periodStr || "Bao_Cao") : formatDateToYYYYMMDD(new Date());

    const element = document.createElement('div');
    element.style.width = '720px';
    element.style.minWidth = '720px'; 
    element.style.maxWidth = '720px'; 
    element.style.boxSizing = 'border-box'; 
    element.style.padding = '10px 15px';
    element.style.color = '#0F172A';
    element.style.backgroundColor = '#FFFFFF';
    element.style.fontFamily = "'Plus Jakarta Sans', sans-serif";
    element.style.overflow = 'hidden'; 
    
    let tablesHTML = '';
    let totalIncome = 0, totalExpense = 0;
    
    const catMapForColor = {};
    data.forEach(t => { if(t.type === 'Chi tiêu') catMapForColor[t.category] = (catMapForColor[t.category]||0) + t.amount; });
    const catArrForColor = Object.keys(catMapForColor).map(k => ({category: k, amount: catMapForColor[k]})).sort((a,b) => b.amount - a.amount);
    
    const categoryColorMap = {};
    catArrForColor.forEach((c, idx) => { categoryColorMap[c.category] = getColorByIndex(idx); });

    const groupedData = {};
    data.forEach(t => {
        const parts = t.date.split('/');
        const monthYear = parts.length === 3 ? `${parts[1]}/${parts[2]}` : 'Khác';
        if (!groupedData[monthYear]) groupedData[monthYear] = [];
        groupedData[monthYear].push(t);
    });

    const sortedKeys = Object.keys(groupedData).sort((a, b) => {
        if (a === 'Khác') return 1; if (b === 'Khác') return -1;
        const [mA, yA] = a.split('/').map(Number);
        const [mB, yB] = b.split('/').map(Number);
        if (yA !== yB) return yA - yB;
        return mA - mB;
    });

    const showMonthHeader = isTab2 && sortedKeys.length >= 1;
    
    // TÍNH TOÁN LOGIC CỘT THU/CHI
    const hasIncome = data.some(t => t.type === 'Thu nhập');
    const hasExpense = data.some(t => t.type === 'Chi tiêu');

    sortedKeys.forEach(key => {
        let monthRows = '';
        let monthInc = 0, monthExp = 0;
        
        groupedData[key].forEach((t, idx) => {
            const isInc = t.type === 'Thu nhập';
            if (isInc) { totalIncome += t.amount; monthInc += t.amount; }
            else { totalExpense += t.amount; monthExp += t.amount; }
            
            const catColor = categoryColorMap[t.category] || (isInc ? '#10B981' : '#64748B');
            const catIconHTML = getCategoryIcon(t.category);
            
            // XỬ LÝ LOGIC CỘT ĐỘNG TRONG TD
            let tdAmountHTML = '';
            if (hasIncome && hasExpense) {
                tdAmountHTML = `
                    <td style="padding: 12px 6px; font-size: 11px; font-weight: 800; color: #00D26A; text-align: right;">${isInc ? '+' + t.amount.toLocaleString('vi-VN') + 'đ' : ''}</td>
                    <td style="padding: 12px 14px 12px 6px; font-size: 11px; font-weight: 800; color: #FF4444; text-align: right;">${!isInc ? '-' + t.amount.toLocaleString('vi-VN') + 'đ' : ''}</td>
                `;
            } else {
                tdAmountHTML = `<td style="padding: 12px 14px 12px 6px; font-size: 11px; font-weight: 800; color: ${isInc ? '#00D26A' : '#FF4444'}; text-align: right;">
                    ${isInc ? '+' : '-'}${t.amount.toLocaleString('vi-VN')}đ
                </td>`;
            }

            monthRows += `
                <tr style="border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
                    <td style="padding: 12px 6px; font-size: 11px; text-align: center;">${idx + 1}</td>
                    <td style="padding: 12px 6px; font-size: 11px; text-align: center; color: #475569; font-weight: 700;">${t.id || '---'}</td>
                    <td style="padding: 12px 10px; font-size: 11px; font-weight: 700; text-align: left;">${t.content}</td>
                    <td style="padding: 12px 10px; font-size: 11px; color: ${catColor}; font-weight: 700; text-align: left;">
                        <span style="display:inline-block; width:16px; text-align:center; margin-right:4px; font-size:12px;">${catIconHTML}</span>${t.category}
                    </td>
                    <td style="padding: 12px 6px; font-size: 11px; color: #94A3B8; text-align: center;">${t.date.substring(0,5)}</td>
                    ${tdAmountHTML}
                </tr>
            `;
        });

        // XỬ LÝ LOGIC CỘT ĐỘNG TRONG THEAD
        let thAmountHTML = '';
        if (hasIncome && hasExpense) {
            thAmountHTML = `
                <th style="padding: 12px 6px; width: 14%; text-align: right;">Thu nhập</th>
                <th style="padding: 12px 14px 12px 6px; width: 14%; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Chi tiêu</th>
            `;
        } else {
            thAmountHTML = `<th style="padding: 12px 14px 12px 6px; width: 28%; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Số tiền</th>`;
        }

        const theadHTML = `
            <thead>
                <tr style="background: #0891B2; color: #FFFFFF;">
                    <th style="padding: 12px 6px; width: 6%; text-align: center; border-top-left-radius: 6px; border-bottom-left-radius: 6px;">STT</th>
                    <th style="padding: 12px 6px; width: 12%; text-align: center;">Mã GD</th>
                    <th style="padding: 12px 10px; width: 26%; text-align: left;">Nội dung</th>
                    <th style="padding: 12px 10px; width: 18%; text-align: left;">Danh mục</th>
                    <th style="padding: 12px 6px; width: 10%; text-align: center;">Ngày</th>
                    ${thAmountHTML}
                </tr>
            </thead>
        `;

        if (showMonthHeader) {
            tablesHTML += `
                <div style="margin-bottom: 24px; page-break-inside: auto; width: 100%; box-sizing: border-box;">
                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 8px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
                        <span style="font-weight: 800; color: #0F172A; font-size: 12px; text-transform: uppercase;">Tháng ${key}</span>
                        <span style="font-size: 11px; color: #64748B; font-weight: 600;">
                            Thu: <span style="color: #00D26A">+${monthInc.toLocaleString('vi-VN')}đ</span> 
                            <span style="margin: 0 6px; color: #CBD5E1;">|</span> 
                            Chi: <span style="color: #FF4444">-${monthExp.toLocaleString('vi-VN')}đ</span>
                        </span>
                    </div>
                    <table class="pdf-table">
                        ${theadHTML}
                        <tbody>
                            ${monthRows}
                        </tbody>
                    </table>
                </div>
            `;
        } else {
            tablesHTML += `
                <table class="pdf-table" style="margin-top: 10px;">
                    ${theadHTML}
                    <tbody>
                        ${monthRows}
                    </tbody>
                </table>
            `;
        }
    });

    let chartsHTML = '';
    if (isTab2 && window.mChart && window.pChart) {
        const barChartImg = window.mChart.toBase64Image();
        const pieChartImg = window.pChart.toBase64Image();
        
        const catMap = {};
        data.forEach(t => { if(t.type === 'Chi tiêu') catMap[t.category] = (catMap[t.category]||0) + t.amount; });
        const catArr = Object.keys(catMap).map(k => ({category: k, amount: catMap[k]})).sort((a,b) => b.amount - a.amount);
        
        let pieLegendHTML = '';
        catArr.forEach((c, idx) => {
            const pct = totalExpense > 0 ? ((c.amount/totalExpense)*100).toFixed(1) : 0;
            const color = getColorByIndex(idx);
            const catIconHTML = getCategoryIcon(c.category);
            
            pieLegendHTML += `
                <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 12px; align-items: center; width: 100%;">
                    <span style="color: #475569; display: flex; align-items: center; gap: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 75%;">
                        <span style="display:inline-block; width:16px; text-align:center; flex-shrink:0; color:${color}; font-size:13px;">${catIconHTML}</span>
                        ${c.category}
                    </span>
                    <span style="font-weight: 800; color: ${color}; margin-left: 10px; flex-shrink: 0;">${pct}%</span>
                </div>
            `;
        });

        chartsHTML = `
            <div style="margin-top: 20px; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
                <h3 style="font-size: 13px; color: #0891B2; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px;">1. Biểu đồ Thu & Chi</h3>
                <div style="text-align: center; margin-top: 10px;">
                    <img src="${barChartImg}" style="max-width: 100%; height: auto; max-height: 250px; object-fit: contain; display: block; margin: 0 auto;" />
                </div>
            </div>
            <div style="margin-top: 20px; page-break-inside: avoid; display: flex; align-items: stretch; gap: 20px; width: 100%; box-sizing: border-box;">
                <div style="flex: 1; min-width: 0; max-width: 50%;">
                    <h3 style="font-size: 13px; color: #0891B2; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 10px;">2. Tỷ trọng chi tiêu</h3>
                    <div style="text-align: center;">
                        <img src="${pieChartImg}" style="max-width: 100%; height: auto; max-height: 220px; object-fit: contain; display: block; margin: 0 auto;" />
                    </div>
                </div>
                <div style="flex: 1; min-width: 0; max-width: 50%; background: #F8FAFC; padding: 16px; border-radius: 12px; border: 1px solid #E2E8F0; display: flex; flex-direction: column; justify-content: center; box-sizing: border-box;">
                    ${pieLegendHTML || '<span style="font-size: 11px; color: #94A3B8;">Chưa có dữ liệu chi tiêu</span>'}
                </div>
            </div>
            <div style="height: 24px;"></div>
        `;
    }

    element.innerHTML = `
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" crossorigin="anonymous">
        <style>
            * { box-sizing: border-box; }
            .pdf-table { width: 100%; max-width: 100%; border-collapse: collapse; table-layout: fixed; margin-top: 0; }
            .pdf-table th { font-size: 10px; text-transform: uppercase; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .pdf-table td { overflow-wrap: break-word; word-break: break-word; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            thead { display: table-header-group; }
            tfoot { display: table-footer-group; }
        </style>
        <div style="text-align: center; margin-bottom: 24px; width: 100%; box-sizing: border-box;">
            <h2 style="margin: 0; color: #0891B2; font-size: 22px; text-transform: uppercase; letter-spacing: 0.5px;">${isTab2 ? 'BÁO CÁO TÀI CHÍNH TỔNG HỢP' : 'GIAO DỊCH TRONG NGÀY'}</h2>
            <p style="margin: 6px 0 0; color: #64748B; font-size: 13px; font-weight: 600; text-transform: uppercase;">${reportTitle}</p>
        </div>
        
        <div style="display: flex; gap: 12px; margin-bottom: 12px; background: #F8FAFC; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
            <div style="flex: 1; min-width: 0;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Tổng thu nhập</span>
                <div style="font-size: 15px; font-weight: 800; color: #00D26A; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">+${totalIncome.toLocaleString('vi-VN')}đ</div>
            </div>
            <div style="flex: 1; min-width: 0; border-left: 1px solid #E2E8F0; padding-left: 14px;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Tổng chi tiêu</span>
                <div style="font-size: 15px; font-weight: 800; color: #FF4444; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">-${totalExpense.toLocaleString('vi-VN')}đ</div>
            </div>
            <div style="flex: 1; min-width: 0; border-left: 1px solid #E2E8F0; padding-left: 14px;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Số dư thuần</span>
                <div style="font-size: 15px; font-weight: 800; color: ${(totalIncome - totalExpense) >= 0 ? '#00D26A' : '#FF4444'}; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${(totalIncome - totalExpense) >= 0 ? '+' : ''}${(totalIncome - totalExpense).toLocaleString('vi-VN')}đ
                </div>
            </div>
        </div>

        ${chartsHTML}

        <div style="page-break-before: auto; width: 100%; box-sizing: border-box;">
            <h3 style="font-size: 13px; color: #0891B2; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px; margin-bottom: 10px; page-break-inside: avoid;">${isTab2 ? '3. Danh sách chi tiết' : 'Danh sách giao dịch'}</h3>
            ${tablesHTML} 
        </div>
        
        <div style="margin-top: 30px; border-top: 1px dashed #CBD5E1; padding-top: 12px; display: flex; justify-content: space-between; font-size: 10px; color: #94A3B8; font-style: italic; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
            <span>Ngày xuất báo cáo: ${formatDateToDDMMYYYY(new Date())}</span>
            <span>Ứng dụng Quản Lý Chi Tiêu ©masterhmh</span>
        </div>
    `;

    const fileName = `Bao_Cao_${reportNameForFile}.pdf`;
    
    const modal = document.getElementById('pdfPreviewModal');
    const overlay = document.getElementById('modalOverlay');
    const previewContainer = document.getElementById('pdfPreviewContainer');
    
    previewContainer.innerHTML = '';
    const clonedElement = element.cloneNode(true);
    clonedElement.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
    clonedElement.style.borderRadius = '8px';
    clonedElement.style.transformOrigin = 'top left';
    previewContainer.appendChild(clonedElement);

    function adjustPreviewSize() {
        const containerWidth = previewContainer.clientWidth - 20; 
        const scale = containerWidth / 720;
        if (scale < 1) {
            clonedElement.style.transform = `scale(${scale})`;
            const heightDiff = clonedElement.offsetHeight * (1 - scale);
            const widthDiff = 720 * (1 - scale);
            clonedElement.style.marginBottom = `-${heightDiff}px`; 
            clonedElement.style.marginRight = `-${widthDiff}px`;
            clonedElement.style.marginLeft = '0px';
        } else {
            clonedElement.style.transform = 'none';
            clonedElement.style.marginBottom = '0px';
            clonedElement.style.marginRight = '0px';
            clonedElement.style.marginLeft = 'auto'; 
            clonedElement.style.marginRight = 'auto';
        }
    }
    
    setTimeout(adjustPreviewSize, 50);
    window.addEventListener('resize', adjustPreviewSize);
    
    overlay.classList.add('show');
    setTimeout(() => modal.classList.add('show'), 10);
    
    document.getElementById('sharePdfBtn').onclick = async () => {
        triggerHaptic('medium');
        showToast("Đang kết xuất file PDF chuẩn...", "info");
        
        const opt = {
            margin:       [10, 10, 10, 10],
            filename:     fileName,
            image:        { type: 'jpeg', quality: 1 },
            html2canvas:  { scale: 3, useCORS: true, letterRendering: true, windowWidth: 740 }, 
            jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak:    { mode: ['css', 'legacy'] }
        };

        html2pdf().set(opt).from(element).output('blob').then(async function(blob) {
            triggerHapticNotification('success');
            const file = new File([blob], fileName, { type: 'application/pdf' });
            
            const platform = window.Telegram?.WebApp?.platform || 'unknown';
            const isMobile = ['android', 'android_x', 'ios'].includes(platform.toLowerCase());

            if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: fileName });
                    triggerHapticNotification('success');
                } catch (error) {}
            } else {
                const pdfUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = fileName;
                a.click();
                URL.revokeObjectURL(pdfUrl);
                showToast("Đã tải file PDF xuống máy!", "success");
            }
        }).catch(err => {
            showToast("Lỗi tạo PDF: " + err.message, "error");
        });
    };
};

// 🌟 TÍNH NĂNG CỬA SỔ "ICON PICKER"
window.openIconPickerModal = function() {
    triggerHaptic('light');
    const modal = document.getElementById('iconPickerModal');
    const container = document.getElementById('iconGridContainer');
    
    if (container.innerHTML === '') {
        const flatIcons = [
            'fa-utensils', 'fa-coffee', 'fa-burger', 'fa-pizza-slice', 'fa-basket-shopping', 'fa-car', 'fa-motorcycle', 'fa-bus', 'fa-train', 'fa-plane', 'fa-gas-pump',
            'fa-house', 'fa-building', 'fa-cart-shopping', 'fa-bag-shopping', 'fa-shirt', 'fa-shoe-prints', 'fa-glasses', 'fa-laptop', 'fa-mobile-screen', 'fa-tv', 
            'fa-gamepad', 'fa-headphones', 'fa-bolt', 'fa-droplet', 'fa-fire', 'fa-wifi', 'fa-heart-pulse', 'fa-pills', 'fa-stethoscope', 'fa-tooth', 'fa-dumbbell',
            'fa-graduation-cap', 'fa-book', 'fa-pen', 'fa-briefcase', 'fa-money-bill-trend-up', 'fa-chart-line', 'fa-piggy-bank', 'fa-credit-card', 'fa-coins', 'fa-wallet',
            'fa-gift', 'fa-cake-candles', 'fa-champagne-glasses', 'fa-paw', 'fa-child', 'fa-baby', 'fa-user-group', 'fa-wrench', 'fa-hammer', 'fa-scissors',
            'fa-film', 'fa-ticket', 'fa-music', 'fa-spa', 'fa-ellipsis', 'fa-box-open', 'fa-layer-group', 'fa-tag', 'fa-shield-halved', 'fa-file-invoice-dollar'
        ];
        container.innerHTML = flatIcons.map(icon => `<div class="icon-item" data-icon="${icon}"><i class="fas ${icon}"></i></div>`).join('');
        
        const iconItems = modal.querySelectorAll('.icon-item');
        iconItems.forEach(item => {
            item.onclick = function() {
                triggerHaptic('light');
                iconItems.forEach(i => i.classList.remove('selected'));
                this.classList.add('selected');
                modal.setAttribute('data-selected-icon', this.getAttribute('data-icon'));
            };
        });
        
        document.getElementById('saveIconPickerBtn').onclick = async () => {
            const cat = document.getElementById('iconPickerCategory').value.trim();
            const selectedIcon = modal.getAttribute('data-selected-icon');
            if (!cat) return showToast('Vui lòng nhập tên danh mục!', 'warning');
            if (!selectedIcon) return showToast('Vui lòng chọn 1 icon!', 'warning');
            
            triggerHaptic('medium'); showLoading(true, 'tab4');
            try {
                await fetch(`${FIREBASE_URL}/categoryIcons.json`, { method: 'PATCH', body: JSON.stringify({ [cat]: selectedIcon }) });
                window.customCategoryIcons[cat] = selectedIcon; showToast('Đã lưu cấu hình danh mục!', 'success'); closeIconPickerModal();
                
                const kCat = document.getElementById('keywordCategory');
                if(kCat) { let exists = Array.from(kCat.options).some(opt => opt.value === cat); if(!exists) kCat.appendChild(new Option(cat, cat)); kCat.value = cat; }
                const addCat = document.getElementById('addCategory');
                if (addCat) { let exists = Array.from(addCat.options).some(opt => opt.value === cat); if(!exists) addCat.appendChild(new Option(cat, cat)); }
                
                displayKeywords(); 
                if(document.getElementById('tab1').classList.contains('active')) displayTransactions();
                if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI();
            } catch(e) { showToast('Lỗi cập nhật icon: ' + e.message, 'error'); } finally { showLoading(false, 'tab4'); }
        };
    }
    
    const datalist = document.getElementById('iconPickerCatList'); datalist.innerHTML = '';
    const cats = Array.from(document.getElementById('keywordCategory').options).map(opt => opt.value);
    const uniqueCats = [...new Set(cats)]; uniqueCats.forEach(c => { const opt = document.createElement('option'); opt.value = c; datalist.appendChild(opt); });

    const currentSelected = document.getElementById('keywordCategory').value;
    if(currentSelected) document.getElementById('iconPickerCategory').value = currentSelected;

    modal.removeAttribute('data-selected-icon');
    const iconItems = modal.querySelectorAll('.icon-item');
    iconItems.forEach(i => i.classList.remove('selected'));

    if (window.customCategoryIcons[currentSelected]) {
        let mappedIcon = window.customCategoryIcons[currentSelected];
        if (!mappedIcon.includes('fa-')) mappedIcon = `fa-${mappedIcon}`;
        const item = modal.querySelector(`.icon-item[data-icon="${mappedIcon}"]`);
        if (item) item.click();
    }

    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => modal.classList.add('show'), 10);
};

window.closeIconPickerModal = function() {
    const modal = document.getElementById('iconPickerModal');
    if (modal) modal.classList.remove('show');
    setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};

// ---------------- INIT LẮNG NGHE SỰ KIỆN CHÍNH ----------------
document.addEventListener('DOMContentLoaded', async () => {
    
  document.querySelectorAll('.modal-title').forEach(title => {
      title.style.textTransform = 'uppercase';
  });

  const currentMonthValue = new Date().getMonth() + 1;
  if (document.getElementById('searchStartMonth')) document.getElementById('searchStartMonth').value = '1';
  if (document.getElementById('searchEndMonth')) document.getElementById('searchEndMonth').value = currentMonthValue.toString();

  const heroCardTab1 = document.querySelector('#tab1 .hero-card');
  if(heroCardTab1) {
      heroCardTab1.style.cursor = 'pointer';
      heroCardTab1.onclick = (e) => {
          if (e.target.closest('.date-nav-btn') || e.target.closest('.quick-actions') || e.target.closest('.tx-btn')) return;
          const dateInput = document.getElementById('transactionDate');
          if (dateInput) {
              dateInput.value = formatDateToYYYYMMDD(new Date());
              window.fetchTransactions(true);
              triggerHaptic('light');
              showToast("Đã quay về dữ liệu ngày hôm nay", "info");
          }
      };
  }

  let startY = 0;
  const tab1Content = document.getElementById('tab1');
  if (tab1Content) {
      tab1Content.addEventListener('touchstart', e => { if (window.scrollY === 0) startY = e.touches[0].clientY; }, { passive: true });
      tab1Content.addEventListener('touchend', e => {
          if (startY === 0) return;
          let endY = e.changedTouches[0].clientY;
          if (endY - startY > 80 && window.scrollY === 0) { 
              triggerHaptic('medium'); showToast("Đang làm mới giao dịch...", "info"); window.fetchTransactions(true);
          }
          startY = 0;
      }, { passive: true });
  }

  document.querySelectorAll('.nav-btn').forEach(b => {
    b.onclick = () => {
      const targetTab = b.dataset.tab; window.openTab(targetTab);
      if (targetTab === 'tab1') window.fetchTransactions(false);
      if (targetTab === 'tab2') updateTimeNavUI();
    };
  });
  
  const kwActionContainer = document.getElementById('keywordActionContainer');
  if(kwActionContainer) {
      const deleteBtn = document.createElement('button'); deleteBtn.id = 'deleteEditKeywordBtn'; deleteBtn.className = 'btn-cancel-kw'; deleteBtn.style.cssText = "flex: 1; display: none; background: rgba(244,63,94,0.1); color: var(--expense); border: none;"; deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Xóa';
      deleteBtn.onclick = async () => {
          if(!currentEditKeyword) return showToast('Vui lòng chọn từ khóa cần xóa', 'warning');
          showLoading(true, 'tab4');
          try {
              const cat = document.getElementById('keywordCategory').value;
              await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: currentEditKeyword, sheetId: sheetId }) });
              triggerHapticNotification('success');
              showToast('Đã xóa từ khóa thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);
          } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab4'); }
      };
      kwActionContainer.appendChild(deleteBtn);

      const cancelBtn = document.createElement('button'); cancelBtn.id = 'cancelKeywordBtn'; cancelBtn.className = 'btn-cancel-kw'; cancelBtn.style.cssText = "flex: 1; display: none;"; cancelBtn.innerHTML = '<i class="fas fa-times"></i> Hủy';
      cancelBtn.onclick = window.cancelEditKeyword;
      kwActionContainer.appendChild(cancelBtn);
  }

  const tDate = document.getElementById('transactionDate');
  if(tDate) { tDate.value = formatDateToYYYYMMDD(new Date()); tDate.onchange = () => { triggerHaptic('light'); window.fetchTransactions(true); }; }
  
  const prevDayBtn = document.getElementById('prevDayBtn');
  if(prevDayBtn) {
      prevDayBtn.onclick = (e) => {
          e.stopPropagation(); 
          triggerHaptic('light');
          const dateInput = document.getElementById('transactionDate');
          if (!dateInput.value) return;
          const [y, m, d] = dateInput.value.split('-');
          const currDate = new Date(y, m - 1, d);
          currDate.setDate(currDate.getDate() - 1); 
          dateInput.value = formatDateToYYYYMMDD(currDate);
          window.fetchTransactions(true);
      };
  }

  const nextDayBtn = document.getElementById('nextDayBtn');
  if(nextDayBtn) {
      nextDayBtn.onclick = (e) => {
          e.stopPropagation();
          triggerHaptic('light');
          const dateInput = document.getElementById('transactionDate');
          if (!dateInput.value) return;
          const [y, m, d] = dateInput.value.split('-');
          const currDate = new Date(y, m - 1, d);
          currDate.setDate(currDate.getDate() + 1); 
          dateInput.value = formatDateToYYYYMMDD(currDate);
          window.fetchTransactions(true);
      };
  }

  window.openTab('tab1'); 
  showLoading(true, 'tab1'); 
  window.loadKeywords(true); 
  window.fetchTransactions(false);

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
  
  const sPills = document.querySelectorAll('#tab3 .period-pill');
  sPills.forEach(p => p.onclick = function() { triggerHaptic('light'); sPills.forEach(x=>x.classList.remove('active')); this.classList.add('active'); document.getElementById('searchCustomFilterContainer').style.display = 'none'; if(this.id==='searchCustomBtn') document.getElementById('searchCustomFilterContainer').style.display = 'flex'; });
  
  document.getElementById('searchTransactionsBtn').onclick = async () => {
    triggerHaptic('light');
    const c = document.getElementById('searchContent').value.toLowerCase(), a = document.getElementById('searchAmount').value, cat = document.getElementById('searchCategory').value;
    if(!c && !a && !cat) return showToast("Nhập điều kiện tìm kiếm", "warning");
    let sM = 1, eM = 12;
    if(document.getElementById('searchMonthlyBtn').classList.contains('active')) { sM = eM = new Date().getMonth() + 1; }
    else if(document.getElementById('searchCustomBtn').classList.contains('active')) { sM = parseInt(document.getElementById('searchStartMonth').value); eM = parseInt(document.getElementById('searchEndMonth').value); }
    
    showLoading(true, 'tab3');
    try {
      let txs = [];
      let fetchPromises = []; 
      for (let m = sM; m <= eM; m++) { fetchPromises.push((async () => { return await fetchMonthData(m); })()); }
      const monthsResults = await Promise.all(fetchPromises);
      const aNum = parseFloat(a.replace(/[^0-9]/g, ''));

      monthsResults.forEach(monthData => {
          monthData.forEach(t => {
              let matches = true;
              if (c && (!t.content || t.content.toLowerCase().indexOf(c) === -1)) matches = false;
              if (a && Math.abs(t.amount - aNum) > 0.01) matches = false;
              if (cat && t.category !== cat) matches = false;
              if (matches) txs.push(t);
          });
      });
      txs.sort((a,b) => b.id.localeCompare(a.id));
      cachedSearchResults = txs; currentPageSearch = 1; displaySearchResults();
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab3'); }
  };
  
  document.getElementById('fetchKeywordsBtn').onclick = () => { triggerHaptic('light'); window.loadKeywords(false); };
  document.getElementById('addKeywordBtn').onclick = async () => {
        triggerHaptic('light');
        const cat = document.getElementById('keywordCategory').value, kw = document.getElementById('keywordInput').value;
        if(!cat || !kw) return showToast('Vui lòng nhập đủ thông tin', 'warning');
        showLoading(true, 'tab4');
        try {
            if (currentEditKeyword) await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: currentEditKeyword, sheetId: sheetId }) });
            await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'addKeyword', category: cat, keywords: kw, sheetId: sheetId }) });
            triggerHapticNotification('success');
            showToast(currentEditKeyword ? 'Cập nhật từ khóa thành công!' : 'Thêm từ khóa mới thành công!', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);
        } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab4'); }
  };

  ['addAmount','editAmount','searchAmount'].forEach(id => { const el = document.getElementById(id); if(el) el.oninput = function() { this.value = formatNumberWithCommas(this.value); }; });
  
  async function initCategories() {
    try {
      const cats = await fetchCategories();
      const sCat = document.getElementById('searchCategory'); 
      const kCat = document.getElementById('keywordCategory');
      cats.forEach(c => { sCat.appendChild(new Option(c, c)); kCat.appendChild(new Option(c, c)); });
      
      if (kCat && !document.getElementById('openIconPickerBtn')) {
          const btn = document.createElement('button');
          btn.id = 'openIconPickerBtn';
          btn.type = 'button';
          btn.innerHTML = '<i class="fas fa-cog"></i>';
          btn.style.cssText = 'background: var(--bg-card2); color: var(--primary); border: 1px solid var(--border-color); border-radius: 8px; padding: 0 16px; margin-left: 8px; display: flex; align-items: center; justify-content: center; cursor: pointer; transition: 0.2s;';
          btn.onclick = window.openIconPickerModal;
          
          const parent = kCat.parentElement;
          const wrapper = document.createElement('div');
          wrapper.style.display = 'flex';
          wrapper.style.width = '100%';
          
          parent.insertBefore(wrapper, kCat);
          wrapper.appendChild(kCat);
          wrapper.appendChild(btn);
          kCat.style.flex = '1';
      }
    } catch(e) {}
  }
  initCategories();
});
