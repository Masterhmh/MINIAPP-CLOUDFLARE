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
let toastQueue = [], isShowingToast = false, currentEditKeyword = null;

const itemsPerPage = 10;
let currentPageTab1 = 1, currentPageCategory = 1, currentPageSearch = 1;
window.apiTxCache = {}; 
let currentFilterMode = 'weekly', activePeriodDate = new Date();

let savedScrollPositionTab2 = 0;

// ---------------- UTILITIES ----------------
function showToast(message, type = "info") {
  toastQueue.push({ message, type });
  if (!isShowingToast) processToastQueue();
}

function processToastQueue() {
  if (toastQueue.length === 0) { isShowingToast = false; return; }
  isShowingToast = true;
  const { message, type } = toastQueue.shift();
  const toast = document.createElement('div');
  let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
  toast.className = `toast ${type}`;
  toast.innerHTML = `<i class="fas ${icon}" style="font-size: 1.2rem; color: var(--${type === 'success' ? 'income' : (type === 'error' ? 'expense' : 'balance')});"></i> <span>${message}</span>`;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => { toast.remove(); processToastQueue(); }, 300); }, 3000);
}

function showLoading(show, tabId) {
  const el = document.getElementById(`loading${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (el) el.style.display = show ? 'block' : 'none';
}

function formatDate(dateStr) {
  const parts = dateStr.split('/');
  if (parts.length !== 3) return dateStr;
  return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`;
}
function formatDateToYYYYMMDD(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDateToDDMMYYYY(date) { return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth() + 1).padStart(2,'0')}/${date.getFullYear()}`; }
function formatNumberWithCommas(value) { return value.replace(/[^0-9]/g, '').replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function parseNumber(value) { return parseInt(value.replace(/[^0-9]/g, '')) || 0; }
function getColorByIndex(i) { const c = ['#6366F1', '#F43F5E', '#10B981', '#F59E0B', '#3B82F6', '#EC4899', '#14B8A6', '#8B5CF6']; return c[i % c.length]; }

function getCategoryIcon(cat) {
    const defaultIcon = '<i class="fas fa-box-open"></i>'; 
    if (!cat) return defaultIcon;
    const categoryName = cat.trim();
    
    const faMap = {
        'Ăn uống': 'fa-utensils', 
        'Bảo hiểm': 'fa-shield-halved', 
        'Công nghệ': 'fa-laptop',
        'Công việc': 'fa-briefcase', 
        'giặt ủi': 'fa-shirt', 
        'sửa chữa': 'fa-screwdriver-wrench',
        'Đi lại': 'fa-car-side', 
        'Giải trí': 'fa-clapperboard', 
        'Giáo dục': 'fa-graduation-cap', 
        'Gia đình': 'fa-house-user',
        'Hóa đơn': 'fa-file-invoice-dollar', 
        'Chăm sóc': 'fa-spa', 
        'Làm đẹp': 'fa-spa',
        'Mua sắm': 'fa-bag-shopping',
        'Quà tặng': 'fa-gift', 
        'Sức khỏe': 'fa-dumbbell', 
        'Tiết kiệm': 'fa-chart-line',
        'Đầu tư': 'fa-chart-line',
        'Y tế': 'fa-pills', 
        'Khác': 'fa-layer-group'
    };

    for (let key in faMap) {
        if (categoryName.toLowerCase().includes(key.toLowerCase())) {
            return `<i class="fas ${faMap[key]}"></i>`;
        }
    }
    return defaultIcon;
}

function getCompareHTML(current, prev, type, text = 'so với kỳ trước') {
    if (prev === 0 && current === 0) return `<span style="color: var(--text-2); font-weight: 500;">− 0đ ${text}</span>`;
    let diff = current - prev;
    if (diff === 0) return `<span style="color: var(--text-2); font-weight: 500;">− Bằng ${text}</span>`;
    let isUp = diff > 0;
    let icon = isUp ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    let arrowText = isUp ? (type === 'balance' ? 'Dư' : 'Tăng') : (type === 'balance' ? 'Âm' : 'Giảm');
    
    let colorVar = type === 'expense' ? (isUp ? 'var(--expense)' : 'var(--income)') : (isUp ? 'var(--income)' : 'var(--expense)');
    
    return `<span style="color: ${colorVar}; font-weight: 600;">${icon} ${arrowText} ${formatNumberWithCommas(Math.abs(diff).toString())}đ ${text}</span>`;
}

window.openTab = function(tabId) {
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
    } catch (e) {}
    return [];
}

// ---------------- TAB 1: GIAO DỊCH ----------------
window.fetchTransactions = async function(forceRefresh = false) {
  const tDate = document.getElementById('transactionDate').value;
  if (!tDate) return;
  const [y, m, d] = tDate.split('-');
  
  // TÍNH TOÁN HIỂN THỊ TEXT "HÔM NAY", "HÔM QUA" THÔNG MINH
  const selectedDateObj = new Date(y, m - 1, d);
  const todayObj = new Date();
  todayObj.setHours(0,0,0,0);
  selectedDateObj.setHours(0,0,0,0);
  const diffDays = Math.round((selectedDateObj - todayObj) / (1000 * 60 * 60 * 24));
  
  // Sửa lỗi dấu phẩy dư thừa ở chữ "Ngày"
  let prefixText = "Ngày "; 
  if (diffDays === 0) prefixText = "Hôm nay, ";
  else if (diffDays === -1) prefixText = "Hôm qua, ";
  else if (diffDays === 1) prefixText = "Ngày mai, ";
  
  document.getElementById('displayCurrentDate').textContent = `${prefixText}${d}/${m}/${y}`;
  
  const cacheKey = `${d}/${m}/${y}`;
  
  // TÍNH TOÁN TRƯỚC NGÀY LIỀN KỀ ĐỂ PHỤC VỤ LOGIC SO SÁNH ĐỘNG
  const currDateObj = new Date(y, m - 1, d);
  currDateObj.setDate(currDateObj.getDate() - 1);
  const prevDateStr = formatDateToDDMMYYYY(currDateObj);
  const prevM = String(currDateObj.getMonth() + 1).padStart(2, '0');

  // ĐUÔI CHỮ SO SÁNH TỰ ĐỘNG NHẢY THEO NGÀY ĐANG CHỌN (Hôm nay -> so với hôm qua, Ngày khác -> so với ngày cũ)
  let compareSuffix = "so với hôm qua";
  if (diffDays !== 0) {
      compareSuffix = `so với ngày ${prevDateStr}`;
  }
  
  if (!forceRefresh && cachedTransactions && cachedTransactions.cacheKey === cacheKey) {
      displayTransactions(); return;
  }

  showLoading(true, 'tab1');
  try {
    const currDateStr = `${d}/${m}/${y}`;
    let dataCurrMonth, dataPrevMonth;
    if (m === prevM) {
        dataCurrMonth = await fetchMonthData(m);
        dataPrevMonth = dataCurrMonth;
    } else {
        [dataCurrMonth, dataPrevMonth] = await Promise.all([ fetchMonthData(m), fetchMonthData(prevM) ]);
    }

    let dataCurr = dataCurrMonth.filter(t => t.date === currDateStr);
    let dataPrev = dataPrevMonth.filter(t => t.date === prevDateStr);
    dataCurr.sort((a,b) => b.id.localeCompare(a.id));
    dataPrev.sort((a,b) => b.id.localeCompare(a.id));
    
    // Lưu đuôi chữ so sánh động vào bộ nhớ tạm cache
    cachedTransactions = { cacheKey, data: dataCurr, prevData: dataPrev, compareSuffix: compareSuffix };
    
    currentPageTab1 = 1; 
    displayTransactions();
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
  
  const heroInc = document.getElementById('heroIncome');
  if(heroInc) heroInc.textContent = formatNumberWithCommas(tInc.toString()) + 'đ';
  
  const heroBalSub = document.getElementById('heroBalanceSub');
  if(heroBalSub) { let sign = tBal > 0 ? '+' : (tBal < 0 ? '−' : ''); heroBalSub.textContent = `${sign}${formatNumberWithCommas(Math.abs(tBal).toString())}đ`; }
  
  // TRUYỀN ĐUÔI CHỮ SO SÁNH ĐỘNG VÀO HÀM ĐỂ IN RA GIAO DIỆN
  const heroExpCompare = document.getElementById('heroExpenseCompare');
  if(heroExpCompare) heroExpCompare.innerHTML = getCompareHTML(tExp, pExp, 'expense', compSuffix);
  
  const headerTitle = document.querySelector('#tab1 .section-title');
  if(headerTitle) headerTitle.innerHTML = `Giao dịch trong ngày <span style="font-size: 0.75rem; color: var(--text-2); text-transform: none;">(Tổng: ${data.length})</span>`;

  if (data.length === 0) {
    container.innerHTML = '<div class="notification">Không có giao dịch nào trong ngày này</div>';
    document.getElementById('pagination').style.display = 'none'; return;
  }
  
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
        <div class="tx-title">${item.content}</div>
        <div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
           <span class="tx-date" style="margin-right: 2px;">${formatDate(item.date)}</span>
           <span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${item.type}</span>
           <span class="tx-badge ${tCls}">${item.category}</span>
        </div>
        ${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${item.note}</div>` : ''}
        <div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;">
           <span>STT: ${stt}</span> • <span>#${item.id}</span>
        </div>
      </div>
      <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
        <div class="tx-amount ${tCls}"><span>${isInc ? '+' : '−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div>
        <div class="tx-actions">
           <button class="tx-btn edit-btn" data-id="${item.id}" title="Sửa"><i class="fas fa-pen"></i></button>
           <button class="tx-btn delete-btn" data-id="${item.id}" title="Xóa"><i class="fas fa-trash"></i></button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });
  
  document.getElementById('pageInfo').textContent = `${currentPageTab1} / ${tPages}`;
  document.getElementById('prevPage').disabled = currentPageTab1 === 1;
  document.getElementById('nextPage').disabled = currentPageTab1 === tPages;
  document.getElementById('prevPage').onclick = () => { if(currentPageTab1 > 1) { currentPageTab1--; displayTransactions(); } };
  document.getElementById('nextPage').onclick = () => { if(currentPageTab1 < tPages) { currentPageTab1++; displayTransactions(); } };
  
  document.querySelectorAll('#transactionsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id'))));
  document.querySelectorAll('#transactionsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

// ---------------- TAB 2: BÁO CÁO ----------------
function getWeekNumber(d) {
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}
function formatWeekInput(date) { return `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`; }
function getDateFromWeekString(weekStr) {
  const [yearStr, weekPart] = weekStr.split('-W');
  if(!yearStr || !weekPart) return null;
  const year = parseInt(yearStr); const week = parseInt(weekPart);
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const dow = simple.getDay(); const start = new Date(simple);
  if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
  else start.setDate(simple.getDate() + 8 - simple.getDay());
  return start;
}

async function getTransactionsInRange(startDate, endDate) {
    const startStr = formatDateToYYYYMMDD(startDate);
    const endStr = formatDateToYYYYMMDD(endDate);
    const cacheKey = startStr + '_' + endStr;
    if (window.apiTxCache[cacheKey]) return window.apiTxCache[cacheKey];

    try {
        const sY = startDate.getFullYear(), eY = endDate.getFullYear();
        let txs = [];
        let fetchPromises = [];

        for (let y = sY; y <= eY; y++) {
            let sM = (y === sY) ? startDate.getMonth() + 1 : 1;
            let eM = (y === eY) ? endDate.getMonth() + 1 : 12;
            for (let m = sM; m <= eM; m++) {
                fetchPromises.push((async () => {
                    let monthData = await fetchMonthData(m);
                    return { y, m, data: monthData };
                })());
            }
        }

        const monthsResults = await Promise.all(fetchPromises);
        monthsResults.forEach(res => {
            res.data.forEach(t => {
                const dParts = t.date.split('/');
                const txDate = new Date(res.y, parseInt(dParts[1], 10) - 1, parseInt(dParts[0], 10));
                if (txDate >= startDate && txDate <= endDate) txs.push(t);
            });
        });

        window.apiTxCache[cacheKey] = txs;
        return txs;
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
    
    let compareText = 'so với kỳ trước';
    if (currentFilterMode === 'weekly') compareText = 'so với tuần trước';
    else if (currentFilterMode === 'monthly') compareText = 'so với tháng trước';
    else if (currentFilterMode === 'yearly') compareText = 'so với năm trước';

    document.getElementById('tab2IncomeCompare').innerHTML = getCompareHTML(tInc, pInc, 'income', compareText);
    document.getElementById('tab2ExpenseCompare').innerHTML = getCompareHTML(tExp, pExp, 'expense', compareText);
    document.getElementById('tab2BalanceCompare').innerHTML = getCompareHTML(tBal, pBal, 'balance', compareText);
    
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (window.mChart) window.mChart.destroy();
    window.mChart = new Chart(ctx, {
      type: 'bar',
      data: { labels: labels, datasets: [
          { label: 'Thu nhập', data: incs, backgroundColor: '#10B981', borderRadius: 0, maxBarThickness: 20 }, 
          { label: 'Chi tiêu', data: exps, backgroundColor: '#F43F5E', borderRadius: 0, maxBarThickness: 20 }
      ]},
      options: { 
          responsive: true, maintainAspectRatio: false, layout: { padding: { top: 20 } }, 
          scales: { x: { grid: { display: false }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' } } }, 
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94A3B8', font: { size: 10, family: 'Plus Jakarta Sans' }, callback: v => v >= 1000 ? (v/1000)+'K' : v } } }, 
          plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: ${formatNumberWithCommas(ctx.raw.toString())}đ` } } } 
      }
    });

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
  
  window.pChart = new Chart(ctx, { 
    type: 'doughnut', 
    data: { labels:lbls, datasets: [{data:amts, backgroundColor:bg, borderWidth: 0, hoverOffset: 4}] }, 
    options: { 
        cutout:'75%', 
        layout: {padding: 8}, 
        plugins: { 
            legend: {display:false}, 
            tooltip: { enabled: false } 
        },
        onClick: (event, activeEls) => {
            if (activeEls && activeEls.length > 0) {
                const activeIdx = activeEls[0].index;
                const catName = lbls[activeIdx];
                const catAmt = amts[activeIdx];
                const color = bg[activeIdx];
                currentPageCategory = 1; 
                showCategoryDetail(catName, catAmt, color);
            }
        }
    }, 
    plugins: [{ 
        id:'cText', 
        afterDraw(c) { 
            const {ctx} = c; 
            ctx.save(); 
            ctx.textAlign='center'; 
            ctx.textBaseline='middle'; 
            
            const activeEls = c.getActiveElements();
            if (activeEls && activeEls.length > 0) {
                const activeIdx = activeEls[0].index;
                const catName = c.data.labels[activeIdx];
                const catAmt = c.data.datasets[0].data[activeIdx];
                const color = c.data.datasets[0].backgroundColor[activeIdx];
                const pct = total > 0 ? ((catAmt/total)*100).toFixed(1) : 0;
                
                let shortName = catName.length > 14 ? catName.substring(0, 14) + '...' : catName;
                
                ctx.fillStyle = '#94A3B8'; 
                ctx.font = '600 9px Plus Jakarta Sans'; 
                ctx.fillText(shortName, c.width/2, c.height/2 - 12); 
                
                ctx.fillStyle = color; 
                ctx.font = '800 12px Plus Jakarta Sans'; 
                ctx.fillText(formatNumberWithCommas(catAmt.toString()) + 'đ', c.width/2, c.height/2 + 4);
                
                ctx.fillStyle = '#94A3B8';
                ctx.font = '500 9px Plus Jakarta Sans';
                ctx.fillText(`(${pct}%)`, c.width/2, c.height/2 + 16);

            } else {
                ctx.fillStyle='#94A3B8'; 
                ctx.font='500 10px Plus Jakarta Sans'; 
                ctx.fillText('Tổng chi', c.width/2, c.height/2 - 10); 
                ctx.fillStyle='#F43F5E'; 
                ctx.font='800 13px Plus Jakarta Sans'; 
                ctx.fillText(formatNumberWithCommas(total.toString()) + 'đ', c.width/2, c.height/2 + 8); 
            }
            ctx.restore(); 
        } 
    }] 
  });

  const leg = document.getElementById('monthlyCustomLegend'); 
  if(leg) leg.innerHTML = '';
  
  const progList = document.getElementById('monthlyCategoryProgressList');
  if(progList) progList.innerHTML = '';

  data.forEach((i, idx) => {
    const pct = total>0 ? ((i.amount/total)*100).toFixed(1) : 0; 
    const c = bg[idx];

    if (leg) {
        const divLeg = document.createElement('div'); divLeg.className = 'legend-item';
        divLeg.innerHTML = `
          <div class="legend-item-left">
             <div class="legend-dot" style="background:${c}"></div>
             <span class="legend-name" title="${i.category}">${i.category}</span>
          </div>
          <div class="legend-value-col">
             <span class="legend-pct" style="color:${c}; font-size: 0.8rem; font-weight: 700;">${pct}%</span>
          </div>
        `;
        divLeg.onclick = () => { currentPageCategory = 1; showCategoryDetail(i.category, i.amount, c); };
        leg.appendChild(divLeg);
    }

    if (progList) {
        const icon = getCategoryIcon(i.category);
        const divProg = document.createElement('div'); divProg.className = 'cat-progress-card';
        divProg.innerHTML = `
          <div class="cat-progress-header">
            <div class="cat-progress-info">
              <div class="cat-progress-icon" style="background:${c}22; color:${c}; font-size: 1.3rem;">${icon}</div>
              <span class="cat-progress-title">${i.category}</span>
            </div>
            <div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;">
              <span class="cat-progress-amt" style="color:${c}">${formatNumberWithCommas(i.amount.toString())}đ</span>
              <span style="font-size: 0.65rem; color: var(--text-3); font-weight: 600;">${pct}%</span>
            </div>
          </div>
          <div class="cat-progress-bar-bg"><div class="cat-progress-bar-fill" style="width:${pct}%; background:${c}"></div></div>
        `;
        divProg.onclick = () => { currentPageCategory = 1; showCategoryDetail(i.category, i.amount, c); };
        progList.appendChild(divProg);
    }
  });
}

async function loadWeeklyReport(weekStr) {
    showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none';
    try {
        const startDate = getDateFromWeekString(weekStr);
        if (!startDate) throw new Error("Dữ liệu tuần không hợp lệ");
        
        const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
        const prevStartDate = new Date(startDate); prevStartDate.setDate(prevStartDate.getDate() - 7);
        const prevEndDate = new Date(endDate); prevEndDate.setDate(prevEndDate.getDate() - 7);
        const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]);
        document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (${formatDateToDDMMYYYY(startDate).substring(0,5)} - ${formatDateToDDMMYYYY(endDate).substring(0,5)})`;
        
        const dayNames = ['Chủ nhật','Thứ 2','Thứ 3','Thứ 4','Thứ 5','Thứ 6','Thứ 7'];
        const labels = [], incs = [], exps = [];
        for(let i=0; i<7; i++) {
            const d = new Date(startDate); d.setDate(d.getDate() + i);
            labels.push(`${dayNames[d.getDay()]}\nNgày ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`);
            const dateStr = formatDateToDDMMYYYY(d);
            const dayTx = currentTx.filter(t => t.date === dateStr);
            let inc = 0, exp = 0; dayTx.forEach(t => { if(t.type==='Thu nhập') inc+=t.amount; else exp+=t.amount; });
            incs.push(inc); exps.push(exp);
        }
        processReportData(currentTx, prevTx, labels, incs, exps);
        cachedChartData = { mode: 'weekly', txs: currentTx, periodStr: weekStr };
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); }
}

async function loadMonthlyReport(monthStr) {
    showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none';
    try {
        const [year, month] = monthStr.split('-').map(Number);
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0);
        let prevM = month - 1; let prevY = year; if(prevM === 0) { prevM = 12; prevY = year - 1; }
        const prevStartDate = new Date(prevY, prevM - 1, 1); const prevEndDate = new Date(prevY, prevM, 0);
        const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]);
        document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (Tháng ${month}/${year})`;
        
        const labels = [`Tháng ${month}`], incs = [0], exps = [0];
        currentTx.forEach(t => { if(t.type==='Thu nhập') incs[0]+=t.amount; else exps[0]+=t.amount; });
        processReportData(currentTx, prevTx, labels, incs, exps);
        cachedChartData = { mode: 'monthly', txs: currentTx, periodStr: monthStr };
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); }
}

async function loadCustomReport(startMonth, endMonth, year) {
    showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none';
    try {
        const startDate = new Date(year, startMonth - 1, 1); const endDate = new Date(year, endMonth, 0);
        const prevStartDate = new Date(year - 1, startMonth - 1, 1); const prevEndDate = new Date(year - 1, endMonth, 0);
        const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]);
        document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (T${startMonth} - T${endMonth} / ${year})`;
        const labels = [], incs = [], exps = [];
        for(let m=startMonth; m<=endMonth; m++) {
            labels.push(`Tháng ${m}`);
            const mTx = currentTx.filter(t => parseInt(t.date.split('/')[1]) === m && parseInt(t.date.split('/')[2]) === year);
            let inc=0, exp=0; mTx.forEach(t => { if(t.type==='Thu nhập') inc+=t.amount; else exp+=t.amount; });
            incs.push(inc); exps.push(exp);
        }
        processReportData(currentTx, prevTx, labels, incs, exps);
        cachedChartData = { mode: 'custom', txs: currentTx, periodStr: `${startMonth}-${endMonth}-${year}` };
    } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); }
}

function updateTimeNavUI() {
   const label = document.getElementById('currentPeriodLabel');
   const weekP = document.getElementById('weekPicker');
   const monthP = document.getElementById('monthPicker');
   const timeNav = document.getElementById('timeNavContainer');
   const customNav = document.getElementById('customFilterContainer');
   
   if (currentFilterMode === 'weekly') {
       timeNav.style.display = 'flex'; customNav.style.display = 'none';
       weekP.style.display = 'block'; monthP.style.display = 'none';
       // KHẮC PHỤC LỖI IOS/SAFARI KHÔNG ĐỌC ĐƯỢC <input type="week">
       const wStr = formatWeekInput(activePeriodDate); 
       weekP.value = wStr; 
       label.textContent = `Tuần ${getWeekNumber(activePeriodDate)}, ${activePeriodDate.getFullYear()}`;
       loadWeeklyReport(wStr); 
       
   } else if (currentFilterMode === 'monthly') {
       timeNav.style.display = 'flex'; customNav.style.display = 'none';
       weekP.style.display = 'none'; monthP.style.display = 'block';
       const mStr = `${activePeriodDate.getFullYear()}-${String(activePeriodDate.getMonth()+1).padStart(2,'0')}`;
       monthP.value = mStr;
       label.textContent = `Tháng ${activePeriodDate.getMonth()+1}/${activePeriodDate.getFullYear()}`;
       loadMonthlyReport(mStr);
       
   } else if (currentFilterMode === 'yearly') {
       timeNav.style.display = 'none'; customNav.style.display = 'none';
       loadCustomReport(1, 12, new Date().getFullYear());
       
   } else if (currentFilterMode === 'custom') {
       timeNav.style.display = 'none'; customNav.style.display = 'flex';
       const curM = new Date().getMonth() + 1;
       document.getElementById('startMonth').value = '1'; document.getElementById('endMonth').value = curM.toString();
   }
}

// ---------------- CHI TIẾT DANH MỤC ----------------
async function showCategoryDetail(cat, amt, color) {
  savedScrollPositionTab2 = window.scrollY || document.documentElement.scrollTop;

  document.getElementById('tab2Overview').style.display='none'; 
  
  const detailView = document.getElementById('categoryDetailView');
  detailView.style.display='block';
  
  detailView.classList.remove('slide-out-right');
  detailView.classList.add('slide-in-right');
  window.scrollTo(0, 0);

  document.getElementById('categoryDetailTitle').textContent = cat; 
  document.getElementById('categoryDetailTitle').style.color = color;
  
  const totalAmtEl = document.getElementById('categoryDetailTotalAmt');
  if(totalAmtEl) {
      totalAmtEl.textContent = formatNumberWithCommas(amt.toString()) + 'đ';
      totalAmtEl.style.color = color;
  }
  
  const txs = cachedChartData.txs.filter(t => t.category === cat);
  const detailHeader = document.getElementById('categoryDetailListTitle');
  if(detailHeader) detailHeader.innerHTML = `Giao dịch chi tiết <span style="font-size: 0.75rem; color: var(--text-2); text-transform: none;">(Tổng: ${txs.length})</span>`;
  
  const ctx = document.getElementById('categoryMonthlyChart').getContext('2d');
  if (window.categoryMonthlyChartInstance) window.categoryMonthlyChartInstance.destroy();
  
  let chartLabels = [], chartData = [];
  if (cachedChartData.mode === 'weekly') {
      const map = {}; txs.forEach(t => { map[t.date] = (map[t.date]||0) + t.amount; });
      chartLabels = Object.keys(map).map(d => `Ngày ${d.substring(0,5)}`); 
      chartData = Object.values(map);
  } else {
      const map = {}; txs.forEach(t => { const m = parseInt(t.date.split('/')[1]); map[m] = (map[m]||0) + t.amount; });
      const allMonths = [...new Set(cachedChartData.txs.map(t => parseInt(t.date.split('/')[1])))].sort((a,b)=>a-b);
      chartLabels = allMonths.map(m => `Tháng ${m}`); 
      chartData = allMonths.map(m => map[m] || 0);
  }
  
  window.categoryMonthlyChartInstance = new Chart(ctx, {
      type: 'bar', data: { labels: chartLabels, datasets: [{label: cat, data: chartData, backgroundColor: color+'CC', borderColor: color, borderWidth: 1, borderRadius: 0, maxBarThickness: 20}] },
      options: { responsive: true, maintainAspectRatio: false, layout: {padding:{top:10}}, scales: { x:{grid:{display:false}, ticks:{color:'#94A3B8', font:{size:10, family:'Plus Jakarta Sans'}}}, y:{ticks:{callback:v=>v>=1000?(v/1000)+'K':v, color:'#94A3B8', font:{size:10, family:'Plus Jakarta Sans'}}, grid:{color:'rgba(255,255,255,0.05)'}} }, plugins: { legend:{display:false}, tooltip: {callbacks:{label:ctx=>`${formatNumberWithCommas(ctx.raw.toString())}đ`}} } }
  });
  displayCategoryTransactionsList(txs);
}

function displayCategoryTransactionsList(txs) {
  const list = document.getElementById('categoryTransactionsContainer'); list.innerHTML = '';
  if(txs.length === 0) { 
      list.innerHTML = '<div class="notification">Không có giao dịch nào</div>'; 
      document.getElementById('paginationCategoryDetail').style.display = 'none';
      return; 
  }
  document.getElementById('paginationCategoryDetail').style.display = 'flex';
  const tPages = Math.ceil(txs.length / itemsPerPage);
  const pData = txs.slice((currentPageCategory - 1) * itemsPerPage, currentPageCategory * itemsPerPage);

  pData.forEach((item, index) => {
      const tCls = item.type === 'Thu nhập' ? 'income' : 'expense';
      const icon = getCategoryIcon(item.category);
      const stt = (currentPageCategory - 1) * itemsPerPage + index + 1;
      const card = document.createElement('div'); card.className = `tx-card ${tCls}`;
      card.innerHTML = `
        <div class="tx-icon-wrap ${tCls}" style="font-size: 1.3rem;">${icon}</div>
        <div class="tx-body">
          <div class="tx-title">${item.content}</div>
          <div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
             <span class="tx-date" style="margin-right: 2px;">${formatDate(item.date)}</span>
             <span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${item.type}</span>
             <span class="tx-badge ${tCls}">${item.category}</span>
          </div>
          ${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${item.note}</div>` : ''}
          <div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;"><span>STT: ${stt}</span> • <span>#${item.id}</span></div>
        </div>
        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
          <div class="tx-amount ${tCls}"><span>${item.type==='Thu nhập'?'+':'−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div>
          <div class="tx-actions">
             <button class="tx-btn edit-btn" data-id="${item.id}"><i class="fas fa-pen"></i></button>
             <button class="tx-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `;
      list.appendChild(card);
  });
  
  document.getElementById('pageInfoCategoryDetail').textContent = `${currentPageCategory} / ${tPages}`;
  document.getElementById('prevPageCategoryDetail').disabled = currentPageCategory === 1;
  document.getElementById('nextPageCategoryDetail').disabled = currentPageCategory === tPages;
  document.getElementById('prevPageCategoryDetail').onclick = () => { if(currentPageCategory > 1) { currentPageCategory--; displayCategoryTransactionsList(txs); } };
  document.getElementById('nextPageCategoryDetail').onclick = () => { if(currentPageCategory < tPages) { currentPageCategory++; displayCategoryTransactionsList(txs); } };
  document.querySelectorAll('#categoryTransactionsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(txs.find(i => String(i.id) === btn.getAttribute('data-id'))));
  document.querySelectorAll('#categoryTransactionsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

function closeCategoryDetailView() {
    const overview = document.getElementById('tab2Overview');
    const detailView = document.getElementById('categoryDetailView');

    detailView.classList.remove('slide-in-right');
    detailView.classList.add('slide-out-right');

    setTimeout(() => {
        detailView.style.display = 'none';
        overview.style.display = 'block';
        
        overview.classList.add('fade-in-view');

        window.scrollTo(0, savedScrollPositionTab2);

        setTimeout(() => {
            overview.classList.remove('fade-in-view');
        }, 300);
    }, 250); 
}

document.getElementById('backToCategoryBtn')?.addEventListener('click', closeCategoryDetailView);

const categoryView = document.getElementById('categoryDetailView');
let touchStartX = 0, touchStartY = 0;
categoryView.addEventListener('touchstart', e => { touchStartX = e.changedTouches[0].screenX; touchStartY = e.changedTouches[0].screenY; }, { passive: true });
categoryView.addEventListener('touchend', e => {
    const swipeDistanceX = e.changedTouches[0].screenX - touchStartX;
    const swipeDistanceY = Math.abs(e.changedTouches[0].screenY - touchStartY);
    if (swipeDistanceX > 70 && swipeDistanceY < 50) {
        closeCategoryDetailView();
    }
}, { passive: true });

// ---------------- TAB 3: TÌM KIẾM ----------------
function displaySearchResults() {
    const list = document.getElementById('searchResultsContainer'); list.innerHTML='';
    const data = cachedSearchResults;
    const headerTitle = document.querySelector('#tab3 .notification');
    if(headerTitle) headerTitle.innerHTML = `Tìm thấy <strong style="color: var(--primary-light);">${data.length}</strong> giao dịch phù hợp`;

    if(!data || data.length === 0) {
        document.getElementById('paginationSearch').style.display = 'none';
        return;
    }
    
    document.getElementById('paginationSearch').style.display = 'flex';
    const tPages = Math.ceil(data.length / itemsPerPage);
    const pData = data.slice((currentPageSearch - 1) * itemsPerPage, currentPageSearch * itemsPerPage);
    
    pData.forEach((item, index) => {
        const tCls = item.type==='Thu nhập'?'income':'expense';
        const icon = getCategoryIcon(item.category);
        const stt = (currentPageSearch - 1) * itemsPerPage + index + 1;
        const card = document.createElement('div'); card.className = `tx-card ${tCls}`;
        card.innerHTML = `
          <div class="tx-icon-wrap ${tCls}" style="font-size: 1.3rem;">${icon}</div>
          <div class="tx-body">
             <div class="tx-title">${item.content}</div>
             <div class="tx-meta" style="margin-bottom: 2px; display: flex; align-items: center; gap: 4px; flex-wrap: wrap;">
                <span class="tx-date" style="margin-right: 2px;">${formatDate(item.date)}</span>
                <span class="tx-badge" style="background: var(--bg-card2); color: var(--text-2); border: 1px solid var(--border-color);">${item.type}</span>
                <span class="tx-badge ${tCls}">${item.category}</span>
             </div>
             ${item.note ? `<div class="tx-meta" style="font-size: 0.75rem; color: var(--text-3); margin-top: 4px; font-style: italic;"><i class="fas fa-tag" style="font-size: 0.65rem; margin-right: 4px;"></i>${item.note}</div>` : ''}             
             <div class="tx-meta" style="font-size: 0.65rem; color: var(--text-3); font-weight: 500; margin-top: 4px;"><span>STT: ${stt}</span> • <span>#${item.id}</span></div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:6px;">
             <div class="tx-amount ${tCls}"><span>${item.type==='Thu nhập'?'+':'−'}</span><span>${formatNumberWithCommas(item.amount.toString())}đ</span></div>
             <div class="tx-actions">
                <button class="tx-btn edit-btn" data-id="${item.id}"><i class="fas fa-pen"></i></button>
                <button class="tx-btn delete-btn" data-id="${item.id}"><i class="fas fa-trash"></i></button>
             </div>
          </div>
        `;
        list.appendChild(card);
    });
    
    document.getElementById('pageInfoSearch').textContent = `${currentPageSearch} / ${tPages}`;
    document.getElementById('prevPageSearch').disabled = currentPageSearch === 1;
    document.getElementById('nextPageSearch').disabled = currentPageSearch === tPages;
    document.getElementById('prevPageSearch').onclick = () => { if(currentPageSearch > 1) { currentPageSearch--; displaySearchResults(); } };
    document.getElementById('nextPageSearch').onclick = () => { if(currentPageSearch < tPages) { currentPageSearch++; displaySearchResults(); } };
    document.querySelectorAll('#searchResultsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id'))));
    document.querySelectorAll('#searchResultsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

// ---------------- TAB 4: TÌM KIẾM TỪ KHÓA ----------------
window.loadKeywords = async function(isInit = false) {
    if(!isInit) showLoading(true, 'tab4');
    if(!isInit) document.getElementById('keywordsContainer').innerHTML = '';
    try {
        const res = await fetch(`${FIREBASE_URL}/keywords.json`);
        let data = await res.json();
        if(!data) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getKeywords&sheetId=${sheetId}`)); data = await gasRes.json(); }
        cachedKeywords = data || [];
        window.categoryIconMap = {};
        cachedKeywords.forEach(kw => { if (kw && kw.category && kw.icon) window.categoryIconMap[kw.category.trim()] = kw.icon.trim(); });
        if(!isInit) displayKeywords();
    } catch(e) { if(!isInit) showToast(e.message, 'error'); }
    finally { if(!isInit) showLoading(false, 'tab4'); }
};

window.startEditKeyword = function(kw, category) {
    document.getElementById('keywordInput').value = kw;
    document.getElementById('keywordCategory').value = category;
    currentEditKeyword = kw; 
    const btnAdd = document.getElementById('addKeywordBtn');
    btnAdd.innerHTML = '<i class="fas fa-save"></i> Lưu sửa';
    btnAdd.classList.add('btn-edit-kw');
    document.getElementById('cancelKeywordBtn').style.display = 'block';
    document.getElementById('deleteEditKeywordBtn').style.display = 'block';
};

window.cancelEditKeyword = function() {
    document.getElementById('keywordInput').value = '';
    currentEditKeyword = null;
    const btnAdd = document.getElementById('addKeywordBtn');
    btnAdd.innerHTML = '<i class="fas fa-plus"></i> Thêm';
    btnAdd.classList.remove('btn-edit-kw');
    document.getElementById('cancelKeywordBtn').style.display = 'none';
    document.getElementById('deleteEditKeywordBtn').style.display = 'none';
};

function displayKeywords() {
   const container = document.getElementById('keywordsContainer');
   container.innerHTML = '';
   if(!cachedKeywords || cachedKeywords.length === 0) { document.getElementById('placeholderTab4').style.display = 'block'; return; }
   document.getElementById('placeholderTab4').style.display = 'none';
   
   const groupedKeywords = {};
   cachedKeywords.forEach(item => {
       const category = item.category || 'Khác';
       if (!groupedKeywords[category]) groupedKeywords[category] = { keywords: [] };
       if (item.keywords && typeof item.keywords === 'string') {
           const kwsArray = item.keywords.split(',').map(k => k.trim()).filter(k => k !== '');
           kwsArray.forEach(kw => { if (!groupedKeywords[category].keywords.includes(kw)) groupedKeywords[category].keywords.push(kw); });
       }
   });

   Object.keys(groupedKeywords).forEach(category => {
       const group = groupedKeywords[category];
       let tagsHTML = '';
       group.keywords.forEach(kw => {
           tagsHTML += `<span style="display:inline-block; background:var(--bg-card2); padding:6px 12px; border-radius:12px; font-size:0.75rem; color:var(--text-1); margin: 0 6px 6px 0; border:1px solid rgba(255,255,255,0.05); cursor:pointer; transition:0.2s;" onmouseover="this.style.borderColor='var(--balance)'" onmouseout="this.style.borderColor='rgba(255,255,255,0.05)'" onclick="startEditKeyword('${kw}', '${category}')">${kw}</span>`;
       });
       const div = document.createElement('div');
       div.className = 'tx-card'; div.style.cssText = 'padding:14px; margin-bottom:16px; flex-direction:column; align-items:flex-start; gap:10px;';
       div.innerHTML = `<div style="display:flex; align-items:center; gap:12px; width:100%;"><div class="tx-icon-wrap expense" style="font-size: 1.3rem;">${getCategoryIcon(category)}</div><div class="tx-body"><div class="tx-title" style="font-size:0.95rem;">${category}</div><div class="tx-meta" style="font-size: 0.65rem; color: var(--text-2);">${group.keywords.length} từ khóa</div></div></div><div style="width:100%; display:flex; flex-wrap:wrap; margin-top:4px;">${tagsHTML || '<span style="font-size:0.75rem; color:var(--text-3); font-style:italic;">Chưa có từ khóa</span>'}</div>`;
       container.appendChild(div);
   });
}

// ---------------- CÁC HÀM MODALS ----------------
async function fetchCategories() {
  try {
    const res = await fetch(`${FIREBASE_URL}/categories.json`);
    let cats = await res.json();
    if(!cats) { const gasRes = await fetch(proxyUrl + encodeURIComponent(`${apiUrl}?action=getCategories&sheetId=${sheetId}`)); cats = await gasRes.json(); }
    return cats || [];
  } catch(e) { return []; }
}

window.selectType = function(formId, type, el) {
  document.getElementById(formId + 'Type').value = type;
  const pills = el.parentElement.querySelectorAll('.type-pill');
  pills.forEach(p => p.classList.remove('income-active', 'expense-active'));
  if(type === 'Chi tiêu') el.classList.add('expense-active'); else el.classList.add('income-active');
};

window.openAddForm = async function() {
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => document.getElementById('addModal').classList.add('show'), 10);
  document.querySelectorAll('#addModal .type-pill').forEach(p => {
     if(p.textContent.includes('Thu nhập')) p.innerHTML = '<i class="fas fa-hand-holding-dollar" style="margin-right: 5px;"></i>Thu nhập';
     else if(p.textContent.includes('Chi tiêu')) p.innerHTML = '<i class="fas fa-money-bill-transfer" style="margin-right: 5px;"></i>Chi tiêu';
  });
  document.getElementById('addDate').value = formatDateToYYYYMMDD(new Date());
  document.getElementById('addContent').value = ''; document.getElementById('addAmount').value = ''; document.getElementById('addNote').value = '';
  document.querySelectorAll('#addModal .type-pill').forEach(p => { if(p.textContent.includes('Chi tiêu')) p.click(); });
  const catSel = document.getElementById('addCategory'); catSel.innerHTML = '';
  const cats = await fetchCategories(); cats.forEach(c => catSel.appendChild(new Option(c, c)));
  document.getElementById('addAmount').oninput = function() { this.value = formatNumberWithCommas(this.value); };
};

window.closeAddForm = function() { document.getElementById('addModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };

window.openEditForm = async function(tx) {
  if(!tx) return;
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
  const [d,m,y] = tx.date.split('/'); document.getElementById('editDate').value = `${y}-${m}-${d}`;
  pills.forEach(p => {
     if(tx.type === 'Thu nhập' && p.textContent.includes('Thu nhập')) p.click();
     if(tx.type === 'Chi tiêu' && p.textContent.includes('Chi tiêu')) p.click();
  });
  const catSel = document.getElementById('editCategory'); catSel.innerHTML = '';
  const cats = await fetchCategories(); cats.forEach(c => {
    const opt = new Option(c, c); if(c === tx.category) opt.selected = true; catSel.appendChild(opt);
  });
  document.getElementById('editAmount').oninput = function() { this.value = formatNumberWithCommas(this.value); };
};

window.closeEditForm = function() { document.getElementById('editModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); };
window.closeAllModals = function() { closeAddForm(); closeEditForm(); document.getElementById('confirmDeleteModal').classList.remove('show'); };
window.closeConfirmDeleteModal = function() { document.getElementById('confirmDeleteModal').classList.remove('show'); };

document.getElementById('addForm').onsubmit = async function(e) {
  e.preventDefault(); closeAddForm(); 
  const [y,m,d] = document.getElementById('addDate').value.split('-');
  const tx = { content: document.getElementById('addContent').value, amount: parseNumber(document.getElementById('addAmount').value), type: document.getElementById('addType').value, category: document.getElementById('addCategory').value, note: document.getElementById('addNote').value, date: `${d}/${m}/${y}`, action: 'addTransaction', sheetId };
  await submitTx(tx); 
};

document.getElementById('editForm').onsubmit = async function(e) {
  e.preventDefault(); closeEditForm(); 
  const [y,m,d] = document.getElementById('editDate').value.split('-');
  const tx = { id: document.getElementById('editTransactionId').value, content: document.getElementById('editContent').value, amount: parseNumber(document.getElementById('editAmount').value), type: document.getElementById('editType').value, category: document.getElementById('editCategory').value, note: document.getElementById('editNote').value, date: `${d}/${m}/${y}`, month: m, action: 'updateTransaction', sheetId };
  await submitTx(tx); 
};

// ⚡ LƯU GIAO DỊCH TRỰC TIẾP LÊN FIREBASE
async function submitTx(tx) {
  try {
    showToast("Đang lưu giao dịch...", "info");
    
    if (tx.action === 'addTransaction') {
      let maxId = 0;
      const allLoadedTxs = [...(cachedTransactions?.data || []), ...(cachedChartData?.txs || []), ...(cachedSearchResults || [])];
      
      allLoadedTxs.forEach(item => {
          if (item.id && String(item.id).startsWith('GD') && !String(item.id).includes('_')) {
              let num = parseInt(String(item.id).replace('GD', ''), 10);
              if (!isNaN(num) && num > maxId) maxId = num;
          }
      });
      tx.id = "GD" + String(maxId + 1).padStart(3, '0');
    }

    const month = parseInt(tx.date.split('/')[1], 10);
    const fbTx = { id: tx.id, date: tx.date, type: tx.type, content: tx.content, amount: tx.amount, category: tx.category, note: tx.note };

    if (tx.action === 'addTransaction') {
      if (cachedTransactions?.data) cachedTransactions.data.unshift(fbTx);
    } else {
      [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => {
        if (!arr) return;
        const idx = arr.findIndex(i => String(i.id) === String(tx.id));
        if (idx !== -1) arr[idx] = { ...arr[idx], ...fbTx };
      });
    }

    if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); 
    else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI();
    else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults();

    await fetch(`${FIREBASE_URL}/transactions/month_${month}/${tx.id}.json`, {
        method: 'PUT',
        body: JSON.stringify(fbTx)
    });
    showToast("Đã lưu giao dịch!", "success");

    fetch(proxyUrl + encodeURIComponent(apiUrl), { 
        method: 'POST', 
        body: JSON.stringify(tx) 
    }).catch(e => console.log("Lỗi backup Sheet:", e));
    
  } catch(e) { showToast(e.message, "error"); }
}

// ⚡ XÓA TRỰC TIẾP TRÊN FIREBASE
window.deleteTransaction = function(id) {
  closeEditForm(); document.getElementById('modalOverlay').classList.add('show'); document.getElementById('confirmDeleteModal').classList.add('show');
  document.getElementById('confirmDeleteBtn').onclick = async () => {
    document.getElementById('confirmDeleteModal').classList.remove('show'); document.getElementById('modalOverlay').classList.remove('show');
    
    let tx = null;
    if (cachedTransactions?.data) tx = cachedTransactions.data.find(i => String(i.id) === String(id));
    if (!tx && cachedSearchResults) tx = cachedSearchResults.find(i => String(i.id) === String(id));
    if (!tx && cachedChartData?.txs) tx = cachedChartData.txs.find(i => String(i.id) === String(id));
    const monthToUpdate = tx ? parseInt(tx.date.split('/')[1], 10) : 1;

    [cachedTransactions?.data, cachedChartData?.txs, cachedSearchResults].forEach(arr => {
      if (!arr) return;
      const idx = arr.findIndex(i => String(i.id) === String(id));
      if (idx !== -1) arr.splice(idx, 1);
    });
    
    if(document.getElementById('tab1').classList.contains('active')) displayTransactions(); 
    else if(document.getElementById('tab2').classList.contains('active')) updateTimeNavUI();
    else if(document.getElementById('tab3').classList.contains('active')) displaySearchResults();

    showToast("Đang xóa giao dịch...", "info");

    try {
      await fetch(`${FIREBASE_URL}/transactions/month_${monthToUpdate}/${id}.json`, { method: 'DELETE' });
      showToast("Đã xóa giao dịch!", "success");
      fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({action: 'deleteTransaction', id, month: monthToUpdate, sheetId}) }).catch(e => console.log("Lỗi xóa Sheet:", e));
    } catch(e) { showToast(e.message, "error"); }
  };
};

// ---------------- INIT LẮNG NGHE SỰ KIỆN ----------------
document.addEventListener('DOMContentLoaded', async () => {
  const currentMonthValue = new Date().getMonth() + 1;
  if (document.getElementById('searchStartMonth')) document.getElementById('searchStartMonth').value = '1';
  if (document.getElementById('searchEndMonth')) document.getElementById('searchEndMonth').value = currentMonthValue.toString();

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
              showToast('Đã xóa từ khóa', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);
          } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab4'); }
      };
      kwActionContainer.appendChild(deleteBtn);

      const cancelBtn = document.createElement('button'); cancelBtn.id = 'cancelKeywordBtn'; cancelBtn.className = 'btn-cancel-kw'; cancelBtn.style.cssText = "flex: 1; display: none;"; cancelBtn.innerHTML = '<i class="fas fa-times"></i> Hủy';
      cancelBtn.onclick = window.cancelEditKeyword;
      kwActionContainer.appendChild(cancelBtn);
  }

  const tDate = document.getElementById('transactionDate');
  if(tDate) { tDate.value = formatDateToYYYYMMDD(new Date()); tDate.onchange = () => window.fetchTransactions(true); }
  
  // SỰ KIỆN CLICK CHO MŨI TÊN TRÁI (LÙI NGÀY)
  const prevDayBtn = document.getElementById('prevDayBtn');
  if(prevDayBtn) {
      prevDayBtn.onclick = (e) => {
          e.stopPropagation(); 
          const dateInput = document.getElementById('transactionDate');
          if (!dateInput.value) return;
          const [y, m, d] = dateInput.value.split('-');
          const currDate = new Date(y, m - 1, d);
          currDate.setDate(currDate.getDate() - 1); 
          dateInput.value = formatDateToYYYYMMDD(currDate);
          window.fetchTransactions(true);
      };
  }

  // SỰ KIỆN CLICK CHO MŨI TÊN PHẢI (TIẾN NGÀY)
  const nextDayBtn = document.getElementById('nextDayBtn');
  if(nextDayBtn) {
      nextDayBtn.onclick = (e) => {
          e.stopPropagation();
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

  document.getElementById('filterWeeklyBtn').onclick = () => { setFilterMode('weekly'); };
  document.getElementById('filterMonthlyBtn').onclick = () => { setFilterMode('monthly'); };
  document.getElementById('filterYearlyBtn').onclick = () => { setFilterMode('yearly'); };
  document.getElementById('filterCustomBtn').onclick = () => { setFilterMode('custom'); };
  document.getElementById('prevPeriodBtn').onclick = () => { shiftPeriod(-1); };
  document.getElementById('nextPeriodBtn').onclick = () => { shiftPeriod(1); };
  document.getElementById('weekPicker').onchange = (e) => { const d = getDateFromWeekString(e.target.value); if(d) { activePeriodDate = d; updateTimeNavUI(); } };
  document.getElementById('monthPicker').onchange = (e) => { const val = e.target.value; if(val) { const [y, m] = val.split('-'); activePeriodDate = new Date(y, m-1, 1); updateTimeNavUI(); } };
  document.getElementById('fetchCustomDataBtn').onclick = () => { const s = parseInt(document.getElementById('startMonth').value); const e = parseInt(document.getElementById('endMonth').value); if(s > e) return showToast("Tháng bắt đầu phải nhỏ hơn kết thúc", "warning"); loadCustomReport(s, e, new Date().getFullYear()); };
  
  function setFilterMode(mode) { currentFilterMode = mode; document.querySelectorAll('#tab2 .period-pill').forEach(p => p.classList.remove('active')); document.getElementById('filter' + mode.charAt(0).toUpperCase() + mode.slice(1) + 'Btn').classList.add('active'); activePeriodDate = new Date(); updateTimeNavUI(); }
  function shiftPeriod(dir) { if (currentFilterMode === 'weekly') activePeriodDate.setDate(activePeriodDate.getDate() + (dir * 7)); else if (currentFilterMode === 'monthly') activePeriodDate.setMonth(activePeriodDate.getMonth() + dir); updateTimeNavUI(); }
  
  const sPills = document.querySelectorAll('#tab3 .period-pill');
  sPills.forEach(p => p.onclick = function() { sPills.forEach(x=>x.classList.remove('active')); this.classList.add('active'); document.getElementById('searchCustomFilterContainer').style.display = 'none'; if(this.id==='searchCustomBtn') document.getElementById('searchCustomFilterContainer').style.display = 'flex'; });
  
  document.getElementById('searchTransactionsBtn').onclick = async () => {
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
  
  document.getElementById('fetchKeywordsBtn').onclick = () => window.loadKeywords(false);
  document.getElementById('addKeywordBtn').onclick = async () => {
        const cat = document.getElementById('keywordCategory').value, kw = document.getElementById('keywordInput').value;
        if(!cat || !kw) return showToast('Vui lòng nhập đủ thông tin', 'warning');
        showLoading(true, 'tab4');
        try {
            if (currentEditKeyword) await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'deleteKeyword', category: cat, keyword: currentEditKeyword, sheetId: sheetId }) });
            await fetch(proxyUrl + encodeURIComponent(apiUrl), { method: 'POST', body: JSON.stringify({ action: 'addKeyword', category: cat, keywords: kw, sheetId: sheetId }) });
            showToast(currentEditKeyword ? 'Cập nhật thành công' : 'Thêm thành công', 'success'); window.cancelEditKeyword(); window.loadKeywords(false);
        } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab4'); }
  };

  ['addAmount','editAmount','searchAmount'].forEach(id => { const el = document.getElementById(id); if(el) el.oninput = function() { this.value = formatNumberWithCommas(this.value); }; });
  
  async function initCategories() {
    try {
      const cats = await fetchCategories();
      const sCat = document.getElementById('searchCategory'); const kCat = document.getElementById('keywordCategory');
      cats.forEach(c => { sCat.appendChild(new Option(c, c)); kCat.appendChild(new Option(c, c)); });
    } catch(e) {}
  }
  initCategories();
});
