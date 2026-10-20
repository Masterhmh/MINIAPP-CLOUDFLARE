
// Lấy font app từ biến CSS --app-font trong index.html/styles.css để Chart.js/canvas tự đổi theo font cấu hình.
function getAppFontFamily() {
    try {
        const cssFont = getComputedStyle(document.documentElement)
            .getPropertyValue('--app-font')
            .trim();

        return cssFont || "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    } catch (e) {
        return "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    }
}

function applyAppFontToCharts() {
    const appFont = getAppFontFamily();
    if (window.Chart && Chart.defaults && Chart.defaults.font) {
        Chart.defaults.font.family = appFont;
    }
    return appFont;
}

// ============================================================================
// app-reports.js — Tab 1 (giao dịch trong ngày), Tab 2 (báo cáo tuần/tháng/
//   năm/tùy chọn: lịch, biểu đồ, chi tiết danh mục & theo ngày) và modal Tìm kiếm.
// Phụ thuộc: app-core.js (tiện ích chung, fetchMonthData, renderTxCard) &
//   currency.js (formatCurrencyWithUnit). Nạp sau app-core.js và currency.js.
// ============================================================================

// Giữ nút chuyển trang trong tầm nhìn sau khi đổi trang (tránh bị nhảy vị trí,
// phải kéo xuống mới thấy nút). Cuộn tối thiểu để lộ khối phân trang.
function scrollPager(id){ const el = document.getElementById(id); if(el){ try { el.scrollIntoView({ block: 'nearest' }); } catch(e){} } }

// ---------------- TAB 1: GIAO DỊCH ----------------
window.fetchTransactions = async function(forceRefresh = false) {
  const tDate = document.getElementById('transactionDate').value;
  if (!tDate) return;
  const [y, m, d] = tDate.split('-');
  
  const selectedDateObj = new Date(y, m - 1, d); const todayObj = new Date(); todayObj.setHours(0,0,0,0); selectedDateObj.setHours(0,0,0,0);
  const diffDays = Math.round((selectedDateObj - todayObj) / (1000 * 60 * 60 * 24));
  let prefixText = "Ngày "; if (diffDays === 0) prefixText = "Hôm nay, "; else if (diffDays === -1) prefixText = "Hôm qua, "; else if (diffDays === 1) prefixText = "Ngày mai, ";

  // ROUND 3n (Cách A): màn ≤370px thì nhãn rút gọn còn "dd/mm/yyyy" (bỏ
  // tiền tố "Hôm nay, "/"Ngày "…) để cụm ngày thu hẹp, không đè avatar —
  // khớp tầng CSS ≤400px ở personal-compat.css §27. Đăng ký 1 lần: khi
  // resize qua mốc 370 thì render lại nhãn theo chế độ mới (đi đường
  // cache nên không tốn mạng).
  // Bổ sung 3n — CHỈ ĐIỆN THOẠI (giống §27): desktop không bao giờ rút
  // gọn, kể cả cửa sổ hẹp — cổng = KHÔNG body.hmh-desktop (app-core.js
  // gắn cho tdesktop/macos) VÀ pointer chính là coarse (cảm ứng);
  // desktop dùng chuột/trackpad là pointer fine nên bị loại ở cổng 2.
  const hmhDateIsCompact = () => window.innerWidth <= 370 &&
    !document.body.classList.contains('hmh-desktop') &&
    window.matchMedia('(pointer: coarse)').matches;
  const compactDateLabel = hmhDateIsCompact();
  document.getElementById('displayCurrentDate').textContent = compactDateLabel ? `${d}/${m}/${y}` : `${prefixText}${d}/${m}/${y}`;
  if (!window.__hmhDateCompactResize) {
    window.__hmhDateCompactResize = true;
    let lastCompact = compactDateLabel;
    window.addEventListener('resize', () => {
      const c = hmhDateIsCompact();
      if (c === lastCompact) return;
      lastCompact = c;
      const inp = document.getElementById('transactionDate');
      const tab1 = document.getElementById('tab1');
      if (inp && inp.value && tab1 && tab1.classList.contains('active')) window.fetchTransactions(false);
    });
  }
  const cacheKey = `${d}/${m}/${y}`;
  const currDateObj = new Date(y, m - 1, d); currDateObj.setDate(currDateObj.getDate() - 1);
  const prevDateStr = formatDateToDDMMYYYY(currDateObj); const prevM = String(currDateObj.getMonth() + 1).padStart(2, '0');
  let compareSuffix = diffDays !== 0 ? `so với ngày ${prevDateStr}` : "so với hôm qua";

  // CACHE NHIỀU NGÀY: đã tải ngày nào thì dùng lại, không gọi mạng (trừ khi ép làm mới)
  if (!window.dayTxCache) window.dayTxCache = {};
  if (!forceRefresh) {
    if (cachedTransactions && cachedTransactions.cacheKey === cacheKey) { displayTransactions(); return; }
    if (window.dayTxCache[cacheKey]) { cachedTransactions = window.dayTxCache[cacheKey]; currentPageTab1 = 1; displayTransactions(); return; }
  }

  showLoading(true, 'tab1');
  try {
    const dNum = parseInt(d, 10); const mNum = parseInt(m, 10); const yNum = parseInt(y, 10);
    const pdNum = currDateObj.getDate(); const pmNum = currDateObj.getMonth() + 1; const pyNum = currDateObj.getFullYear();
    
    let dataCurrMonth, dataPrevMonth;
    if (mNum === pmNum && yNum === pyNum) { dataCurrMonth = await fetchMonthData(mNum, yNum); dataPrevMonth = dataCurrMonth; } 
    else { [dataCurrMonth, dataPrevMonth] = await Promise.all([ fetchMonthData(mNum, yNum), fetchMonthData(pmNum, pyNum) ]); }

    let dataCurr = dataCurrMonth.filter(t => { if(!t || !t.date) return false; const pts = t.date.split('/'); return parseInt(pts[0], 10) === dNum && parseInt(pts[1], 10) === mNum && parseInt(pts[2], 10) === yNum; });
    let dataPrev = dataPrevMonth.filter(t => { if(!t || !t.date) return false; const pts = t.date.split('/'); return parseInt(pts[0], 10) === pdNum && parseInt(pts[1], 10) === pmNum && parseInt(pts[2], 10) === pyNum; });
    dataCurr.sort((a,b) => b.id.localeCompare(a.id)); dataPrev.sort((a,b) => b.id.localeCompare(a.id));
    
    cachedTransactions = { cacheKey, data: dataCurr, prevData: dataPrev, compareSuffix: compareSuffix };
    window.dayTxCache[cacheKey] = cachedTransactions;
    currentPageTab1 = 1; displayTransactions();
  } catch (err) {
  cachedTransactions = { cacheKey, data: [], prevData: [], compareSuffix: compareSuffix };
  displayTransactions();
  showToast(navigator.onLine ? ('Lỗi tải giao dịch: ' + err.message) : 'Mất kết nối mạng. Kiểm tra Internet rồi thử lại.', 'error');
}
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

  const tExpObj = formatCurrencyWithUnit(tExp);
  const heroExpMain = document.getElementById('heroExpenseMain');
  if(heroExpMain) heroExpMain.innerHTML = `${tExpObj.val}<span>${tExpObj.unit}</span>`;
  
  const tIncObj = formatCurrencyWithUnit(tInc);
  const heroInc = document.getElementById('heroIncome'); 
  if(heroInc) heroInc.innerHTML = `${tIncObj.val}<span>${tIncObj.unit}</span>`;
  
  const tBalObj = formatCurrencyWithUnit(Math.abs(tBal));
  const heroBalSub = document.getElementById('heroBalanceSub');
  if(heroBalSub) { 
      let sign = tBal > 0 ? '+' : (tBal < 0 ? '−' : ''); 
      heroBalSub.innerHTML = `<span>${sign}</span>${tBalObj.val}<span>${tBalObj.unit}</span>`;
      // PERSONAL ROUND 3f: Số dư ÂM -> hồng tươi #E11D48 (số + icon nhãn),
      // dương/0 -> tím #7C3AED như 3d. Class .bal-neg đặt trên thẻ .hero-stat
      // bao ngoài để CSS (personal-compat §20) nhuộm cả 2; trước đây KHÔNG
      // có quy tắc theo dấu — số dư âm vẫn tím (đo computed thật ở sandbox).
      const stat = heroBalSub.closest('.hero-stat');
      if (stat) stat.classList.toggle('bal-neg', tBal < 0);
  }
  
  const heroExpCompare = document.getElementById('heroExpenseCompare');
  if(heroExpCompare) heroExpCompare.innerHTML = getCompareHTML(tExp, pExp, 'expense', compSuffix);

  // FIX R2-3: co cỡ số tiền hero cho vừa sau mỗi lần vẽ (port production R20)
  try { if (typeof window.fitStatAmounts === 'function') window.fitStatAmounts(); } catch (e) {}
  
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
    const tCls = item.type === 'Thu nhập' ? 'income' : 'expense';
    const stt = (currentPageTab1 - 1) * itemsPerPage + index + 1;
    const card = document.createElement('div'); card.className = `tx-card ${tCls}`;
    card.innerHTML = renderTxCard(item, stt);
    container.appendChild(card);
  });
  
  document.getElementById('pageInfo').textContent = `${currentPageTab1} / ${tPages}`;
  document.getElementById('prevPage').disabled = currentPageTab1 === 1;
  document.getElementById('nextPage').disabled = currentPageTab1 === tPages;
  document.getElementById('prevPage').onclick = () => { triggerHaptic('light'); if(currentPageTab1 > 1) { currentPageTab1--; displayTransactions(); scrollPager('pagination'); } };
  document.getElementById('nextPage').onclick = () => { triggerHaptic('light'); if(currentPageTab1 < tPages) { currentPageTab1++; displayTransactions(); scrollPager('pagination'); } };
  document.querySelectorAll('#transactionsContainer .edit-btn').forEach(btn => btn.onclick = () => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id'))));
  document.querySelectorAll('#transactionsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id')));
}

// ---------------- CÁC BÁO CÁO ----------------
function getWeekNumber(d) {
    const startOfWeek = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const dayNum = d.getUTCDay() || 7;
    if (startOfWeek === 1) d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    else d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() + 1));
    var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
    return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
}

function formatWeekInput(date) { return `${date.getFullYear()}-W${String(getWeekNumber(date)).padStart(2, '0')}`; }

function getDateFromWeekString(weekStr) {
    const startDay = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    if (!weekStr) return null;
    const [yearStr, weekPart] = weekStr.split('-W');
    if(!yearStr || !weekPart) return null;
    const year = parseInt(yearStr); const week = parseInt(weekPart);
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const start = new Date(simple);
    if (startDay === 1) {
        if (dow <= 4) start.setDate(simple.getDate() - simple.getDay() + 1);
        else start.setDate(simple.getDate() + 8 - simple.getDay());
    } else {
        start.setDate(simple.getDate() - simple.getDay());
    }
    return start;
}

async function getTransactionsInRange(startDate, endDate) {
    const startStr = formatDateToYYYYMMDD(startDate); const endStr = formatDateToYYYYMMDD(endDate); const cacheKey = startStr + '_' + endStr;
    if (window.apiTxCache[cacheKey]) return window.apiTxCache[cacheKey];
    try {
        const sY = startDate.getFullYear(), eY = endDate.getFullYear(); let txs = []; let fetchPromises = [];
        for (let y = sY; y <= eY; y++) { let sM = (y === sY) ? startDate.getMonth() + 1 : 1; let eM = (y === eY) ? endDate.getMonth() + 1 : 12;
            for (let m = sM; m <= eM; m++) { fetchPromises.push((async () => { let monthData = await fetchMonthData(m, y); return { y, m, data: monthData }; })()); }
        }
        const monthsResults = await Promise.all(fetchPromises);
        monthsResults.forEach(res => { 
            res.data.forEach(t => { 
                if (!t || !t.date) return;
                const dParts = t.date.split('/'); 
                if(dParts.length !== 3) return;
                const txDate = new Date(res.y, parseInt(dParts[1], 10) - 1, parseInt(dParts[0], 10)); 
                if (txDate >= startDate && txDate <= endDate) txs.push(t); 
            }); 
        });
                window.apiTxCache[cacheKey] = txs; return txs;
    } catch (e) {
        throw new Error(navigator.onLine ? ('Lỗi tải dữ liệu báo cáo: ' + e.message) : 'Mất kết nối mạng. Kiểm tra Internet rồi thử lại.');
    }
}

// ---------------- ÂM LỊCH (thuật toán Hồ Ngọc Đức, tính offline, múi giờ +7) ----------------
// Chỉ dùng để HIỂN THỊ số ngày âm trên lịch Tab 2. Không đụng dữ liệu chi tiêu.
function lunarJdFromDate(dd, mm, yy) {
    const a = Math.floor((14 - mm) / 12);
    const y = yy + 4800 - a;
    const m = mm + 12 * a - 3;
    let jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
    if (jd < 2299161) jd = dd + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - 32083;
    return jd;
}
function lunarNewMoon(k) {
    const T = k / 1236.85; const T2 = T * T; const T3 = T2 * T; const dr = Math.PI / 180;
    let Jd1 = 2415020.75933 + 29.53058868 * k + 0.0001178 * T2 - 0.000000155 * T3;
    Jd1 = Jd1 + 0.00033 * Math.sin((166.56 + 132.87 * T - 0.009173 * T2) * dr);
    const M = 359.2242 + 29.10535608 * k - 0.0000333 * T2 - 0.00000347 * T3;
    const Mpr = 306.0253 + 385.81691806 * k + 0.0107306 * T2 + 0.00001236 * T3;
    const F = 21.2964 + 390.67050646 * k - 0.0016528 * T2 - 0.00000239 * T3;
    let C1 = (0.1734 - 0.000393 * T) * Math.sin(M * dr) + 0.0021 * Math.sin(2 * dr * M);
    C1 = C1 - 0.4068 * Math.sin(Mpr * dr) + 0.0161 * Math.sin(dr * 2 * Mpr);
    C1 = C1 - 0.0004 * Math.sin(dr * 3 * Mpr);
    C1 = C1 + 0.0104 * Math.sin(dr * 2 * F) - 0.0051 * Math.sin(dr * (M + Mpr));
    C1 = C1 - 0.0074 * Math.sin(dr * (M - Mpr)) + 0.0004 * Math.sin(dr * (2 * F + M));
    C1 = C1 - 0.0004 * Math.sin(dr * (2 * F - M)) - 0.0006 * Math.sin(dr * (2 * F + Mpr));
    C1 = C1 + 0.0010 * Math.sin(dr * (2 * F - Mpr)) + 0.0005 * Math.sin(dr * (2 * Mpr + M));
    let deltat;
    if (T < -11) deltat = 0.001 + 0.000839 * T + 0.0002261 * T2 - 0.00000845 * T3 - 0.000000081 * T * T3;
    else deltat = -0.000278 + 0.000265 * T + 0.000262 * T2;
    const JdNew = Jd1 + C1 - deltat;
    return Math.floor(JdNew + 0.5 + 7 / 24);
}
function lunarSunLongitude(jdn) {
    const T = (jdn - 2451545.5 - 7 / 24) / 36525; const T2 = T * T; const dr = Math.PI / 180;
    const M = 357.52910 + 35999.05030 * T - 0.0001559 * T2 - 0.00000048 * T * T2;
    const L0 = 280.46645 + 36000.76983 * T + 0.0003032 * T2;
    let DL = (1.914600 - 0.004817 * T - 0.000014 * T2) * Math.sin(dr * M);
    DL = DL + (0.019993 - 0.000101 * T) * Math.sin(dr * 2 * M) + 0.000290 * Math.sin(dr * 3 * M);
    let L = L0 + DL; L = L * dr; L = L - Math.PI * 2 * Math.floor(L / (Math.PI * 2));
    return Math.floor(L / Math.PI * 6);
}
function lunarMonth11(yy) {
    const off = lunarJdFromDate(31, 12, yy) - 2415021;
    const k = Math.floor(off / 29.530588853);
    let nm = lunarNewMoon(k);
    if (lunarSunLongitude(nm) >= 9) nm = lunarNewMoon(k - 1);
    return nm;
}
function lunarLeapOffset(a11) {
    const k = Math.floor((a11 - 2415021.076998695) / 29.530588853 + 0.5);
    let last = 0; let i = 1;
    let arc = lunarSunLongitude(lunarNewMoon(k + i));
    do { last = arc; i++; arc = lunarSunLongitude(lunarNewMoon(k + i)); } while (arc != last && i < 14);
    return i - 1;
}
function convertSolar2Lunar(dd, mm, yy) {
    const dayNumber = lunarJdFromDate(dd, mm, yy);
    const k = Math.floor((dayNumber - 2415021.076998695) / 29.530588853);
    let monthStart = lunarNewMoon(k + 1);
    if (monthStart > dayNumber) monthStart = lunarNewMoon(k);
    let a11 = lunarMonth11(yy); let b11 = a11; let lunarYear;
    if (a11 >= monthStart) { lunarYear = yy; a11 = lunarMonth11(yy - 1); }
    else { lunarYear = yy + 1; b11 = lunarMonth11(yy + 1); }
    const lunarDay = dayNumber - monthStart + 1;
    const diff = Math.floor((monthStart - a11) / 29);
    let lunarLeap = 0; let lunarMonth = diff + 11;
    if (b11 - a11 > 365) {
        const leapMonthDiff = lunarLeapOffset(a11);
        if (diff >= leapMonthDiff) { lunarMonth = diff + 10; if (diff == leapMonthDiff) lunarLeap = 1; }
    }
    if (lunarMonth > 12) lunarMonth = lunarMonth - 12;
    if (lunarMonth >= 11 && diff < 4) lunarYear -= 1;
    return { day: lunarDay, month: lunarMonth, year: lunarYear, leap: lunarLeap };
}

function renderCalendar(txs, dateObj, mode) {
    const grid = document.getElementById('calendarGrid');
    const box = document.getElementById('calendarStatbox');

    if (mode !== 'monthly' && mode !== 'weekly') { box.style.display = 'none'; return; }
    box.style.display = 'block'; grid.innerHTML = '';

    // Gom dữ liệu thu/chi theo từng ngày
    const dailyData = {};
    txs.forEach(t => {
        if (!t || !t.date) return;
        const parts = t.date.split('/');
        if (parts.length !== 3) return;
        const tDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10)-1, parseInt(parts[0], 10));
        const dayKey = formatDateToYYYYMMDD(tDate);
        if (!dailyData[dayKey]) dailyData[dayKey] = { inc: 0, exp: 0 };
        if (t.type === 'Thu nhập') dailyData[dayKey].inc += t.amount;
        else dailyData[dayKey].exp += t.amount;
    });

    const header = document.querySelector('.calendar-header');
    const startOfWeek = parseInt(localStorage.getItem('settingStartOfWeek') || '1', 10);
    const todayKey = formatDateToYYYYMMDD(new Date());

    // ============ LỊCH TUẦN ============
    if (mode === 'weekly') {
        if (header) {
            header.style.display = 'grid';
            if (startOfWeek === 1) { header.innerHTML = `<span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>`; }
            else { header.innerHTML = `<span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>`; }
        }
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.borderTop = '1px solid var(--border-color)';
        grid.style.borderRadius = '10px';
        for (let i = 0; i < 7; i++) {
            const d = new Date(dateObj); d.setDate(d.getDate() + i);
            const dayKey = formatDateToYYYYMMDD(d);
            const data = dailyData[dayKey] || { inc: 0, exp: 0 };
            let balHTML = `<span class="calendar-balance neutral">0</span>`;
            if (data.inc > 0 || data.exp > 0) {
                const incObj = data.inc > 0 ? formatCurrencyWithUnit(data.inc) : null;
                const expObj = data.exp > 0 ? formatCurrencyWithUnit(data.exp) : null;
                let incStr = incObj ? `<span class="calendar-balance positive cal-row-amt">${incObj.val}${incObj.unit.trim()==='₫'?'':incObj.unit}</span>` : '';
                let expStr = expObj ? `<span class="calendar-balance negative cal-row-amt">${expObj.val}${expObj.unit.trim()==='₫'?'':expObj.unit}</span>` : '';
                balHTML = `<div class="cal-amt-col">${incStr}${expStr}</div>`;
            }

            const dayDiv = document.createElement('div'); dayDiv.className = 'calendar-day';
            if (dayKey === todayKey) dayDiv.classList.add('today');
            // ÂM LỊCH (PA1): số âm nhỏ ở góc phải trên (đồng bộ với lịch tháng)
            const lunarW = convertSolar2Lunar(d.getDate(), d.getMonth() + 1, d.getFullYear());
            const lunarTextW = (lunarW.day === 1) ? `${lunarW.day}/${lunarW.month}` : String(lunarW.day);
            let lunarClsW = 'calendar-lunar';
            if (lunarW.day === 1 || lunarW.day === 15) lunarClsW += ' lunar-special';
            const lunarHTMLW = `<span class="${lunarClsW}">${lunarTextW}</span>`;
            dayDiv.innerHTML = `<span class="calendar-date">${d.getDate()}</span>${lunarHTMLW}${balHTML}`;

            dayDiv.onclick = () => { triggerHaptic('light'); document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected-day')); dayDiv.classList.add('selected-day'); openDailyDetailView(d.getDate(), d.getMonth() + 1, d.getFullYear(), txs); };
            grid.appendChild(dayDiv);
        }
    } else {
    // ============ LỊCH THÁNG ============
        if (header) {
            header.style.display = 'grid';
            if (startOfWeek === 1) { header.innerHTML = `<span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span><span>CN</span>`; }
            else { header.innerHTML = `<span>CN</span><span>T2</span><span>T3</span><span>T4</span><span>T5</span><span>T6</span><span>T7</span>`; }
        }
        grid.style.gridTemplateColumns = 'repeat(7, 1fr)';
        grid.style.borderTop = 'none';
        grid.style.borderRadius = '0 0 10px 10px';

        const year = dateObj.getFullYear(); const month = dateObj.getMonth();
        let firstDay = new Date(year, month, 1).getDay();
        if (startOfWeek === 1) firstDay = firstDay === 0 ? 6 : firstDay - 1;

        const daysInMonth = new Date(year, month + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) { grid.innerHTML += `<div class="calendar-day empty"></div>`; }

        const today = new Date(); const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;

        // Xác định TUẦN HIỆN TẠI (tuần chứa hôm nay) để tô nền pill khác màu cho cả tuần.
        // diffToStart = số ngày lùi từ hôm nay về đầu tuần (theo cài đặt đầu tuần T2 hoặc CN).
        const todayW = new Date(); todayW.setHours(0,0,0,0);
        const dowW = todayW.getDay();
        const diffToStart = (startOfWeek === 1) ? ((dowW === 0) ? 6 : dowW - 1) : dowW;
        const weekStart = new Date(todayW); weekStart.setDate(todayW.getDate() - diffToStart); weekStart.setHours(0,0,0,0);
        const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6); weekEnd.setHours(0,0,0,0);

        for (let i = 1; i <= daysInMonth; i++) {
            const d = new Date(year, month, i); const dayKey = formatDateToYYYYMMDD(d);
            const data = dailyData[dayKey] || { inc: 0, exp: 0 };
            let balHTML = `<span class="calendar-balance neutral">0</span>`;
            if (data.inc > 0 || data.exp > 0) {
                const incObj2 = data.inc > 0 ? formatCurrencyWithUnit(data.inc) : null;
                const expObj2 = data.exp > 0 ? formatCurrencyWithUnit(data.exp) : null;
                let incStr2 = incObj2 ? `<span class="calendar-balance positive cal-row-amt">${incObj2.val}${incObj2.unit.trim()==='₫'?'':incObj2.unit}</span>` : '';
                let expStr2 = expObj2 ? `<span class="calendar-balance negative cal-row-amt">${expObj2.val}${expObj2.unit.trim()==='₫'?'':expObj2.unit}</span>` : '';
                balHTML = `<div class="cal-amt-col">${incStr2}${expStr2}</div>`;
            }

            let classes = ['calendar-day'];
            if (isCurrentMonth && today.getDate() === i) classes.push('today');
            // Ô ngày nằm trong tuần hiện tại -> gắn class current-week để tô nền pill
            const cellDate = new Date(year, month, i); cellDate.setHours(0,0,0,0);
            if (cellDate >= weekStart && cellDate <= weekEnd) classes.push('current-week');

            // ÂM LỊCH (PA1): số âm nhỏ ở góc phải trên; mùng 1 hiện dạng "1/<tháng>"; tô đỏ mùng 1 & rằm.
            const lunar = convertSolar2Lunar(i, month + 1, year);
            const lunarText = (lunar.day === 1) ? `${lunar.day}/${lunar.month}` : String(lunar.day);
            let lunarCls = 'calendar-lunar';
            if (lunar.day === 1 || lunar.day === 15) lunarCls += ' lunar-special';
            const lunarHTML = `<span class="${lunarCls}">${lunarText}</span>`;

            const dayDiv = document.createElement('div'); dayDiv.className = classes.join(' ');
            dayDiv.innerHTML = `<span class="calendar-date">${i}</span>${lunarHTML}${balHTML}`;

            dayDiv.onclick = () => { triggerHaptic('light'); document.querySelectorAll('.calendar-day').forEach(el => el.classList.remove('selected-day')); dayDiv.classList.add('selected-day'); openDailyDetailView(i, month + 1, year, txs); };
            grid.appendChild(dayDiv);
        }
    }
    // FIX 3b F-07: co cỡ số trong ô cho vừa ô ngay sau khi dựng lịch.
    try { fitCalendarAmounts(); } catch (e) {}
}

// ============================================================================
// FIX 3b F-07: SỐ TRONG Ô LỊCH — CO CHO VỪA Ô thay cho cắt ellipsis.
// Trước đây .cal-row-amt bị ellipsis ở ô ~45px ("25.000.000.000" scrollW 60
// > ô 45 -> mất chữ số cuối). Nay đo scrollWidth/clientWidth thật của từng
// span và thu cỡ dần (bước 0.5px, sàn 6px) tới khi đủ chữ số lọt ô; số bình
// thường không bị đụng (chỉ co khi tràn). Giữ nguyên quy tắc đã chốt: lịch
// KHÔNG mang ₫ (chuỗi chỉ gồm chữ số + dấu chấm). Kỷ luật ẩn số như
// fitStatAmounts: inline font-size phải kèm !important mới thắng rule 9px
// !important của redesign.css, và inline !important lại thắng cả mask
// font-size:0 !important -> khi privacy-on PHẢI gỡ inline (mask "***" thắng);
// updatePrivacyUI (app-core.js) gọi lại hàm này mỗi lần bật/tắt ẩn số.
// ============================================================================
function fitCalendarAmounts() {
  var spans = document.querySelectorAll('#calendarGrid .cal-row-amt');
  if (!spans.length) return;
  if (document.body.classList.contains('privacy-on')) {
    spans.forEach(function (el) { el.style.removeProperty('font-size'); });
    return;
  }
  spans.forEach(function (el) {
    el.style.removeProperty('font-size'); // về cỡ CSS (9px) rồi mới đo/co
    if (!(el.clientWidth > 0)) return;
    var size = parseFloat(window.getComputedStyle(el).fontSize) || 9;
    var guard = 20;
    while (el.scrollWidth > el.clientWidth + 0.5 && size > 6 && guard-- > 0) {
      size = Math.max(6, size - 0.5);
      el.style.setProperty('font-size', size + 'px', 'important');
    }
  });
}
window.fitCalendarAmounts = fitCalendarAmounts;
(function initCalendarFitResize() {
  var t = null;
  window.addEventListener('resize', function () {
    if (t) clearTimeout(t);
    t = setTimeout(function () { try { fitCalendarAmounts(); } catch (e) {} }, 150);
  });
})();

function processReportData(currentTx, prevTx, labels, incs, exps) {
    let tInc = 0, tExp = 0; currentTx.forEach(i => { if(i.type==='Thu nhập') tInc += i.amount; else tExp += i.amount; });
    const tBal = tInc - tExp;
    let pInc = 0, pExp = 0; prevTx.forEach(i => { if(i.type==='Thu nhập') pInc += i.amount; else pExp += i.amount; });
    const pBal = pInc - pExp;
    
    let compareText = currentFilterMode === 'weekly' ? 'so với tuần trước' : (currentFilterMode === 'monthly' ? 'so với tháng trước' : 'so với kỳ trước');
    // (personal-port) panel G6 thay 3 stat-card — giữ nguyên các ID để baseline
    // và wrapper so sánh (app-upgrade.js) vẫn đọc/ghi đúng.
    try { renderG6StatsPanel(tInc, tExp, tBal, pInc, pExp, pBal, compareText); } catch (e) {}
    // FIX R2-3: co cỡ 3 số của panel G6 cho vừa hàng sau mỗi lần render —
    // kể cả khi render lại do ĐỔI ĐỊNH DẠNG TIỀN (settingCurrencyFormat đổi
    // -> fetchTransactions(true) -> vẽ lại panel -> fitter chạy ở đây).
    try { if (typeof window.fitStatAmounts === 'function') window.fitStatAmounts(); } catch (e) {}

    // Khi kỳ báo cáo KHÔNG có giao dịch nào -> ẩn 2 biểu đồ trống (Thu nhập & Chi tiêu +
    // Chi tiêu theo danh mục) và hiện dòng thông báo gọn gàng. Giữ nguyên các thẻ tổng & lịch.
    const chartContainerEl = document.querySelector('#tab2 .chart-container');
    const reportPlaceholderEl = document.getElementById('placeholderTab2');
    if (!currentTx || currentTx.length === 0) {
        if (window.mChart) { window.mChart.destroy(); window.mChart = null; }
        if (window.pChart) { window.pChart.destroy(); window.pChart = null; }
        if (chartContainerEl) chartContainerEl.style.display = 'none';
        if (reportPlaceholderEl) { reportPlaceholderEl.textContent = 'Không có dữ liệu báo cáo'; reportPlaceholderEl.style.display = 'block'; }
        try { renderInsightStrip({ tx: currentTx || [], labels: labels || [] }); } catch (e) {}
        return;
    }
    if (reportPlaceholderEl) reportPlaceholderEl.style.display = 'none';
    if (chartContainerEl) chartContainerEl.style.display = 'block';
    
    const ctx = document.getElementById('monthlyChart').getContext('2d');
    if (window.mChart) window.mChart.destroy();

    const appFont = applyAppFontToCharts();

    // PERSONAL ROUND 3 (W2) — port mẫu L1 (đường) + B1 (cột) Hùng đã duyệt
    // (chart-demos/DEMOS.md), áp cho mọi kỳ (tuần/tháng/năm/tùy chọn):
    //  - Kỳ nào TỔNG THU = 0 -> ẨN HẲN chuỗi Thu nhập (chỉ còn Chi tiêu);
    //    có thu -> hiện cả 2. (App không có chip legend riêng cho biểu đồ này:
    //    Chart.js legend đang tắt, tiêu đề thẻ + tooltip đảm nhiệm chú thích —
    //    nên "ẩn chip" ở đây chính là bỏ hẳn dataset khỏi biểu đồ.)
    //  - Đường L1: mượt tension 0,4, gradient 22% -> trong suốt, không chấm
    //    điểm (chỉ chấm hover), trần trục = max x 1,08, lưới ngang đứt nét.
    //  - Cột B1: màu đặc, bo đầu 4px, dày tối đa 14.
    //  - Trục Y giữ formatCurrencyWithUnit của bản cá nhân (dấu chấm vi-VN +
    //    ₫, tôn trọng cài đặt đầy đủ/rút gọn); bật ẩn số vẫn che '***' ở cả
    //    trục Y lẫn tooltip như trước. layout padding top giữ nguyên để nút
    //    chuyển biểu đồ (đè góc phải trên) không che vùng vẽ.
    const isLineMode = window.currentChartType === 'line';
    const hasIncome = tInc > 0;
    let maxY = 0;
    incs.forEach(v => { if (v > maxY) maxY = v; });
    exps.forEach(v => { if (v > maxY) maxY = v; });

    const lineGradient = (rgb) => (c) => {
        const chartArea = c.chart && c.chart.chartArea;
        if (!chartArea) return `rgba(${rgb},0.22)`;
        const g = c.chart.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
        g.addColorStop(0, `rgba(${rgb},0.22)`); g.addColorStop(1, `rgba(${rgb},0)`);
        return g;
    };
    const lineDs = (label, data, hex, rgb) => ({ label: label, data: data, type: 'line',
        borderColor: hex, borderWidth: 2.5, tension: 0.4, fill: 'origin',
        backgroundColor: lineGradient(rgb),
        pointRadius: 0, pointHoverRadius: 5, pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: hex, pointHoverBorderWidth: 2.5 });
    const barDs = (label, data, hex) => ({ label: label, data: data,
        backgroundColor: hex, borderRadius: 4, borderSkipped: 'start', maxBarThickness: 14 });

    const dsExp = isLineMode ? lineDs('Chi tiêu', exps, '#F43F5E', '244,63,94') : barDs('Chi tiêu', exps, '#F43F5E');
    const dsInc = isLineMode ? lineDs('Thu nhập', incs, '#10B981', '16,185,129') : barDs('Thu nhập', incs, '#10B981');
    const mDatasets = hasIncome ? [dsInc, dsExp] : [dsExp];

    window.mChart = new Chart(ctx, {
        type: window.currentChartType || 'bar',
        data: { labels: labels, datasets: mDatasets },
        options: {
            devicePixelRatio: 4, responsive: true, maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            layout: { padding: { top: 20 } },
            scales: {
                x: { grid: { display: false }, border: { display: false },
                     ticks: { color: '#9AA1B5', font: { size: 11, family: appFont }, maxTicksLimit: 11, autoSkip: true },
                     ...(isLineMode ? {} : { categoryPercentage: 0.8, barPercentage: 0.75 }) },
                y: { beginAtZero: true, suggestedMax: Math.round(maxY * 1.08),
                     grid: { color: '#EEF0F4', drawTicks: false, borderDash: [5, 5] },
                     border: { display: false },
                     ticks: { color: '#9AA1B5', font: { size: 10.5, family: appFont }, maxTicksLimit: 7, padding: 6, callback: v => {
                         if (isPrivacyActive) return '***';
                         const vObj = formatCurrencyWithUnit(v); return vObj.val + vObj.unit;
                     } } }
            },
            plugins: { legend: { display: false }, tooltip: {
                backgroundColor: '#fff', titleColor: '#14161F', bodyColor: '#4B5563',
                borderColor: '#EDEEF2', borderWidth: 1, padding: 12, cornerRadius: 12,
                boxWidth: 8, boxHeight: 8, boxPadding: 4, usePointStyle: true, displayColors: true,
                titleFont: { size: 12, weight: '700', family: appFont }, bodyFont: { size: 12, family: appFont },
                callbacks: {
                    title: items => {
                        if (!items || !items.length) return '';
                        const lb = String(items[0].label);
                        return /^\d+$/.test(lb) ? ('Ngày ' + lb) : lb;
                    },
                    label: c => {
                        if (isPrivacyActive) return ' ' + c.dataset.label + ': ***';
                        const cObj = formatCurrencyWithUnit(c.raw);
                        return ' ' + c.dataset.label + ': ' + cObj.val + cObj.unit;
                    }
                } } }
        }
    });

    const catMap = {}; currentTx.forEach(t => { if(t.type==='Chi tiêu') catMap[t.category] = (catMap[t.category]||0)+t.amount; });
    drawMonthlyPieChart(Object.keys(catMap).map(k => ({category: k, amount: catMap[k]})));
    // (personal-port) thẻ insight dưới panel
    try { renderInsightStrip({ tx: currentTx || [], labels: labels || [] }); } catch (e) {}
}

/* ============================================================================
   PERSONAL ROUND 2 — MỘT THÔNG SỐ DONUT DÙNG CHUNG cho mọi biểu đồ tròn danh
   mục (Tab2 + modal chi tiết ngày), đồng bộ với họ donut G6 của app:
   - vòng dày ~13% đường kính (cutout 73% -> (1-.73)/2 = 13.5%)
   - khe trắng giữa các lát (spacing: 3) + đầu lát bo tròn (borderRadius: 8)
   - màu theo TÊN danh mục (getCategoryColor) — cùng danh mục, cùng màu ở mọi
     biểu đồ; tâm luôn là 'Tổng chi' + tổng (formatCurrencyWithUnit, dấu chấm).
   ============================================================================ */
function doughnutSpec() {
  return { cutout: '73%', spacing: 3, borderRadius: 8, borderWidth: 0, hoverOffset: 4 };
}
function doughnutDataset(amts, colors) {
  const s = doughnutSpec();
  return { data: amts, backgroundColor: colors, borderWidth: s.borderWidth, hoverOffset: s.hoverOffset, spacing: s.spacing, borderRadius: s.borderRadius };
}

function drawMonthlyPieChart(data) {
  const appFont = applyAppFontToCharts();
  const ctx = document.getElementById('monthlyPieChart').getContext('2d');
  if(window.pChart) window.pChart.destroy();
  data.sort((a,b) => b.amount - a.amount);
  const amts = data.map(i=>i.amount); const lbls = data.map(i=>i.category); const bg = data.map(i=>getCategoryColor(i.category));
  const total = amts.reduce((a,b)=>a+b,0);

  window.pChart = new Chart(ctx, { type: 'doughnut', data: { labels:lbls, datasets: [doughnutDataset(amts, bg)] }, options: { devicePixelRatio: 4, cutout: doughnutSpec().cutout, layout: {padding: 8}, plugins: { legend: {display:false}, tooltip: { enabled: false } }, onClick: (event, activeEls) => { if (activeEls && activeEls.length > 0) { const activeIdx = activeEls[0].index; const catName = lbls[activeIdx]; showCategoryDetail(catName); } } }, plugins: [{ id:'cText', afterDraw(c) { const {ctx} = c; ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; const activeEls = c.getActiveElements(); if (activeEls && activeEls.length > 0) { const activeIdx = activeEls[0].index; const catName = c.data.labels[activeIdx]; const catAmt = c.data.datasets[0].data[activeIdx]; const color = getCategoryTextColor(catName); const pct = total > 0 ? ((catAmt/total)*100).toFixed(1) : 0; let shortName = catName.length > 14 ? catName.substring(0, 14) + '...' : catName; ctx.fillStyle = '#94A3B8'; ctx.font = `600 9px ${appFont}`; ctx.fillText(shortName, c.width/2, c.height/2 - 12); ctx.fillStyle = color; ctx.font = `800 12px ${appFont}`; 
  const catObj = formatCurrencyWithUnit(catAmt);
  const displayAmt = isPrivacyActive ? '***' : catObj.val + catObj.unit;
  // FIX 3b F-10 (quét %): dòng % dưới số tiền ở tâm donut cũng phải che "***"
  // khi ẩn số — trước đây chỉ số tiền được che, % tỉ trọng vẫn lộ số thật.
  ctx.fillText(displayAmt, c.width/2, c.height/2 + 4); ctx.fillStyle = '#94A3B8'; ctx.font = `500 9px ${appFont}`; ctx.fillText(isPrivacyActive ? '***' : `(${pct}%)`, c.width/2, c.height/2 + 16); } else { ctx.fillStyle='#94A3B8'; ctx.font=`500 10px ${appFont}`; ctx.fillText('Tổng chi', c.width/2, c.height/2 - 10); ctx.fillStyle='#F43F5E'; ctx.font=`800 13px ${appFont}`; 
  const totalObj = formatCurrencyWithUnit(total);
  const displayTotal = isPrivacyActive ? '***' : totalObj.val + totalObj.unit;
  ctx.fillText(displayTotal, c.width/2, c.height/2 + 8); } ctx.restore(); } }] });

  const leg = document.getElementById('monthlyCustomLegend'); if(leg) leg.innerHTML = '';
  const progList = document.getElementById('monthlyCategoryProgressList'); if(progList) progList.innerHTML = '';

  data.forEach((i, idx) => {
    const pct = total>0 ? ((i.amount/total)*100).toFixed(1) : 0; const c = bg[idx];
    const tc = getCategoryTextColor(i.category); // ROUND 3f: c và tc là MỘT màu chuẩn duy nhất (getCategoryColor === getCategoryTextColor) — lát/thanh/icon/số/% đồng bộ tuyệt đối
    const catIconHTML = getCategoryIcon(i.category);

    if (leg) { 
        const divLeg = document.createElement('div'); divLeg.className = 'legend-item'; 
        divLeg.innerHTML = `<div class="legend-item-left"><span style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; color:${tc}; font-size:13px; margin-right: 8px;">${catIconHTML}</span><span class="legend-name" title="${escapeHTML(i.category)}">${escapeHTML(i.category)}</span></div><div class="legend-value-col"><span class="legend-pct" style="color:${tc};">${pct}%</span></div>`; 
        divLeg.onclick = () => { triggerHaptic('light'); showCategoryDetail(i.category); }; 
        leg.appendChild(divLeg); 
    }
    
    if (progList) { 
        const iAmtObj = formatCurrencyWithUnit(i.amount);
        const divProg = document.createElement('div'); divProg.className = 'cat-progress-card'; 
        divProg.innerHTML = `<div class="cat-progress-header"><div class="cat-progress-info"><div class="cat-progress-icon" style="background:${c}22; color:${tc};">${catIconHTML}</div><span class="cat-progress-title">${escapeHTML(i.category)}</span></div><div style="display:flex; flex-direction:column; align-items:flex-end; gap:3px;"><span class="cat-progress-amt" style="color:${tc}">${iAmtObj.val}<span>${iAmtObj.unit}</span></span><span class="cat-progress-pct" style="font-size: 0.65rem; color:${tc}; font-weight: 600;">${pct}%</span></div></div><div class="cat-progress-bar-bg"><div class="cat-progress-bar-fill" style="width:${pct}%; background:${c}"></div></div>`; 
        divProg.onclick = () => { triggerHaptic('light'); showCategoryDetail(i.category); }; 
        progList.appendChild(divProg); 
    }
  });
}

function showCategoryDetail(cat) {
  const detailModal = document.getElementById('detailModal');
  document.getElementById('modalOverlay').classList.add('show');
  setTimeout(() => detailModal.classList.add('show'), 10);
  
  document.getElementById('detailModalTitle').textContent = cat.toUpperCase(); 
  document.getElementById('detailModalTitle').style.color = 'var(--primary)';

  // Sort theo logic thời gian (giống tuần/tháng): mới nhất -> cũ nhất dựa trên date,
  // nếu trùng ngày thì ưu tiên id mới hơn.
  const parseTxDate = (t) => {
    if (!t || !t.date) return null;
    const parts = String(t.date).split('/');
    if (parts.length !== 3) return null;
    const dd = parseInt(parts[0], 10);
    const mm = parseInt(parts[1], 10) - 1;
    const yy = parseInt(parts[2], 10);
    if (Number.isNaN(dd) || Number.isNaN(mm) || Number.isNaN(yy)) return null;
    return new Date(yy, mm, dd);
  };
  
  const txs = cachedChartData.txs
    .filter(t => t.category === cat)
    .sort((a, b) => {
      const da = parseTxDate(a);
      const db = parseTxDate(b);
      const ta = da ? da.getTime() : 0;
      const tb = db ? db.getTime() : 0;
      if (tb !== ta) return tb - ta; // ngày mới -> cũ
      // cùng ngày: id mới -> cũ
      return String(b.id || '').localeCompare(String(a.id || ''));
    });

  let totalInc = 0, totalExp = 0;
  txs.forEach(t => { if(t.type === 'Thu nhập') totalInc += t.amount; else totalExp += t.amount; });
  
  const incObj = formatCurrencyWithUnit(totalInc);
  // FIX 3b F-09: tổng bằng 0 hiển thị "0 ₫" KHÔNG kèm dấu +/− (trước đây vô
  // điều kiện gắn dấu -> "+0 ₫" / "−0 ₫" ở ngày chỉ có một phía).
  document.getElementById('detailTotalIncome').innerHTML = `${totalInc > 0 ? '<span>+</span>' : ''}${incObj.val}<span>${incObj.unit}</span>`;
  const expObj = formatCurrencyWithUnit(totalExp);
  document.getElementById('detailTotalExpense').innerHTML = `${totalExp > 0 ? '<span>−</span>' : ''}${expObj.val}<span>${expObj.unit}</span>`;

  const chartContainer = document.getElementById('detailChartContainer');
  if(chartContainer) chartContainer.style.display = 'none';
  const pieContainer = document.getElementById('dailyPieChartContainer');
  if(pieContainer) pieContainer.style.display = 'none';
  
  document.getElementById('detailListTitle').textContent = 'Giao dịch chi tiết';
  currentPageCategory = 1;
  displayDetailTransactionsList(txs);
}

function openDailyDetailView(d, m, y, allTxs) {
    const dNum = parseInt(d, 10); const mNum = parseInt(m, 10); const yNum = parseInt(y, 10);
    
    const dayTxs = allTxs.filter(t => { 
    if (!t || !t.date) return false; 
    const parts = t.date.split('/'); 
    if (parts.length !== 3) return false; 
    return parseInt(parts[0], 10) === dNum && parseInt(parts[1], 10) === mNum && parseInt(parts[2], 10) === yNum; 
}).sort((a, b) => b.id.localeCompare(a.id)); // mới nhất → cũ nhất

    const detailModal = document.getElementById('detailModal');
    document.getElementById('modalOverlay').classList.add('show');
    setTimeout(() => detailModal.classList.add('show'), 10);

    document.getElementById('detailModalTitle').textContent = `NGÀY ${String(dNum).padStart(2,'0')}/${String(mNum).padStart(2,'0')}/${yNum}`; 
    document.getElementById('detailModalTitle').style.color = 'var(--text-1)';
    
    let totalExp = 0, totalInc = 0;
    dayTxs.forEach(t => { if(t.type === 'Chi tiêu') totalExp += t.amount; else totalInc += t.amount; });

    const incObj = formatCurrencyWithUnit(totalInc);
    // FIX 3b F-09: như showCategoryDetail — 0 thì không gắn dấu +/−.
    document.getElementById('detailTotalIncome').innerHTML = `${totalInc > 0 ? '<span>+</span>' : ''}${incObj.val}<span>${incObj.unit}</span>`;
    const expObj = formatCurrencyWithUnit(totalExp);
    document.getElementById('detailTotalExpense').innerHTML = `${totalExp > 0 ? '<span>−</span>' : ''}${expObj.val}<span>${expObj.unit}</span>`;

    const chartContainer = document.getElementById('detailChartContainer');
    if(chartContainer) chartContainer.style.display = 'none';

    const pieContainer = document.getElementById('dailyPieChartContainer');
    let dayCategories = [];
    if (totalExp > 0 && pieContainer) {
        pieContainer.style.display = 'flex'; const catMap = {};
        dayTxs.forEach(t => { if(t.type==='Chi tiêu') catMap[t.category] = (catMap[t.category]||0)+t.amount; });
        const data = Object.keys(catMap).map(k => ({category: k, amount: catMap[k]})).sort((a,b) => b.amount - a.amount);
        dayCategories = data.map(i => i.category);
        drawDailyPieChart(data, totalExp);
    } else if (pieContainer) { pieContainer.style.display = 'none'; }

    // PERSONAL ROUND 2 (WORK 3): trạng thái lọc danh mục của modal ngày —
    // mới mở luôn không lọc; chú thích tương tác đổi ở toggleDailyFilter().
    window.__dailyView = { txs: dayTxs, totalExp: totalExp, filter: null, categories: dayCategories };
    renderDailyList();
}

function renderDailyList() {
    const st = window.__dailyView;
    const all = (st && st.txs) ? st.txs : [];
    const f = st ? st.filter : null;
    const list = f ? all.filter(t => t.type === 'Chi tiêu' && t.category === f) : all;
    document.getElementById('detailListTitle').textContent = 'Giao dịch chi tiết (Tổng: ' + list.length + ')';
    currentPageCategory = 1;
    displayDetailTransactionsList(list);
    document.querySelectorAll('#dailyCustomLegend .legend-item').forEach(el => {
      el.classList.toggle('selected', !!f && el.getAttribute('data-cat') === f);
    });
}

function toggleDailyFilter(cat) {
    const st = window.__dailyView; if (!st) return;
    triggerHaptic('light');
    st.filter = (st.filter === cat) ? null : cat;
    renderDailyList();
}

function drawDailyPieChart(data, totalExp) {
    const ctx = document.getElementById('dailyPieChart').getContext('2d');
    if(window.dChart) window.dChart.destroy();
    const amts = data.map(i=>i.amount); const lbls = data.map(i=>i.category); const bg = data.map(i=>getCategoryColor(i.category));

    const appFont = applyAppFontToCharts();
    window.dChart = new Chart(ctx, {
        type: 'doughnut', data: { labels:lbls, datasets: [doughnutDataset(amts, bg)] },
        options: { devicePixelRatio: 4, cutout: doughnutSpec().cutout, layout: {padding: 8}, plugins: { legend: {display:false}, tooltip: { enabled: false } },
          onClick: (event, activeEls) => {
            if (activeEls && activeEls.length > 0) toggleDailyFilter(lbls[activeEls[0].index]);
            else if (window.__dailyView && window.__dailyView.filter) toggleDailyFilter(window.__dailyView.filter); // chạm tâm -> bỏ lọc
          } },
        plugins: [{ id:'cText2', afterDraw(c) { const {ctx} = c; ctx.save(); ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillStyle='#94A3B8'; ctx.font=`500 9px ${appFont}`; ctx.fillText('Tổng chi', c.width/2, c.height/2 - 8); ctx.fillStyle='#F43F5E'; ctx.font=`800 11px ${appFont}`;
        const tObj = formatCurrencyWithUnit(totalExp);
        const displayTotal = isPrivacyActive ? '***' : tObj.val + tObj.unit;
        ctx.fillText(displayTotal, c.width/2, c.height/2 + 6); ctx.restore(); } }]
    });

    const leg = document.getElementById('dailyCustomLegend'); if(leg) leg.innerHTML = '';
    data.forEach((i, idx) => {
      const pct = totalExp>0 ? ((i.amount/totalExp)*100).toFixed(1) : 0; const c = bg[idx]; const tc = getCategoryTextColor(i.category); const catIconHTML = getCategoryIcon(i.category);
      const divLeg = document.createElement('div'); divLeg.className = 'legend-item'; divLeg.setAttribute('data-cat', i.category);
      divLeg.innerHTML = `<div class="legend-item-left"><span style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; flex-shrink:0; color:${tc}; font-size:13px; margin-right: 8px;">${catIconHTML}</span><span class="legend-name" title="${escapeHTML(i.category)}">${escapeHTML(i.category)}</span></div><div class="legend-value-col"><span class="legend-pct" style="color:${tc};">${pct}%</span></div>`;
      divLeg.onclick = function() { toggleDailyFilter(i.category); };
      leg.appendChild(divLeg);
    });
}

function displayDetailTransactionsList(txs) {
  const list = document.getElementById('detailTransactionsContainer'); list.innerHTML = '';
  if(txs.length === 0) { list.innerHTML = '<div class="empty-state">Không có giao dịch nào</div>'; document.getElementById('paginationDetail').style.display = 'none'; return; }
  document.getElementById('paginationDetail').style.display = 'flex';
  const tPages = Math.ceil(txs.length / itemsPerPage); const pData = txs.slice((currentPageCategory - 1) * itemsPerPage, currentPageCategory * itemsPerPage);
  pData.forEach((item, index) => { 
    const tCls = item.type === 'Thu nhập' ? 'income' : 'expense'; const stt = (currentPageCategory - 1) * itemsPerPage + index + 1; 
    const card = document.createElement('div'); card.className = `tx-card ${tCls}`; 
    card.innerHTML = renderTxCard(item, stt); list.appendChild(card); 
  });
  document.getElementById('pageInfoDetail').textContent = `${currentPageCategory} / ${tPages}`; document.getElementById('prevPageDetail').disabled = currentPageCategory === 1; document.getElementById('nextPageDetail').disabled = currentPageCategory === tPages; document.getElementById('prevPageDetail').onclick = () => { triggerHaptic('light'); if(currentPageCategory > 1) { currentPageCategory--; displayDetailTransactionsList(txs); scrollPager('paginationDetail'); } }; document.getElementById('nextPageDetail').onclick = () => { triggerHaptic('light'); if(currentPageCategory < tPages) { currentPageCategory++; displayDetailTransactionsList(txs); scrollPager('paginationDetail'); } };
  document.querySelectorAll('#detailTransactionsContainer .edit-btn').forEach(btn => btn.onclick = () => { closeDetailModal(); setTimeout(() => openEditForm(txs.find(i => String(i.id) === btn.getAttribute('data-id'))), 350); }); 
  document.querySelectorAll('#detailTransactionsContainer .delete-btn').forEach(btn => btn.onclick = () => { closeDetailModal(); setTimeout(() => deleteTransaction(btn.getAttribute('data-id')), 350); });
}

window.closeDetailModal = function() {
    triggerHaptic('light'); document.querySelectorAll('.calendar-day.selected-day').forEach(el => el.classList.remove('selected-day')); document.getElementById('detailModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300);
};

// ----- BÁO CÁO TUẦN -----
async function loadWeeklyReport(weekStr) {
  showLoading(true, 'tab2');
  document.querySelector('#tab2 .chart-container').style.display='none';
  document.getElementById('placeholderTab2').style.display='none';
  try {
    const startDate = getDateFromWeekString(weekStr);
    if (!startDate) throw new Error("Dữ liệu tuần không hợp lệ");
    const endDate = new Date(startDate); endDate.setDate(endDate.getDate() + 6);
    const prevStartDate = new Date(startDate); prevStartDate.setDate(prevStartDate.getDate() - 7);
    const prevEndDate = new Date(endDate); prevEndDate.setDate(prevEndDate.getDate() - 7);
    const [currentTx, prevTx] = await Promise.all([
      getTransactionsInRange(startDate, endDate),
      getTransactionsInRange(prevStartDate, prevEndDate)
    ]);
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
    renderCalendar(currentTx, startDate, 'weekly');
    processReportData(currentTx, prevTx, labels, incs, exps);
    cachedChartData = { mode: 'weekly', txs: currentTx, periodStr: weekStr };
  } catch(e) { showToast(e.message, 'error'); }
  finally { showLoading(false, 'tab2'); }
}

// ----- BÁO CÁO THÁNG -----
async function loadMonthlyReport(monthStr) {
  showLoading(true, 'tab2');
  document.querySelector('#tab2 .chart-container').style.display='none';
  document.getElementById('placeholderTab2').style.display='none';
  try {
    const [year, month] = monthStr.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);
    let prevM = month - 1; let prevY = year;
    if(prevM === 0) { prevM = 12; prevY = year - 1; }
    const prevStartDate = new Date(prevY, prevM - 1, 1);
    const prevEndDate = new Date(prevY, prevM, 0);
    const [currentTx, prevTx] = await Promise.all([
      getTransactionsInRange(startDate, endDate),
      getTransactionsInRange(prevStartDate, prevEndDate)
    ]);
    document.getElementById('chartTitleTab2').textContent = `Thu nhập & Chi tiêu (Tháng ${month}/${year})`;
    // (personal-port) biểu đồ tháng vẽ theo TỪNG NGÀY (port production R14)
    const __mcd = buildMonthlyChartData(currentTx, year, month);
    const labels = __mcd.labels, incs = __mcd.incs, exps = __mcd.exps;
    renderCalendar(currentTx, startDate, 'monthly');
    processReportData(currentTx, prevTx, labels, incs, exps);
    cachedChartData = { mode: 'monthly', txs: currentTx, periodStr: monthStr };
  } catch(e) { showToast(e.message, 'error'); }
  finally { showLoading(false, 'tab2'); }
}
async function loadCustomReport(startMonth, endMonth, year) { showLoading(true, 'tab2'); document.querySelector('#tab2 .chart-container').style.display='none'; document.getElementById('placeholderTab2').style.display='none'; try { const startDate = new Date(year, startMonth - 1, 1); const endDate = new Date(year, endMonth, 0); const __isFullYear = (startMonth === 1 && endMonth === 12);
    let prevStartDate, prevEndDate;
    if (__isFullYear) { prevStartDate = new Date(year - 1, 0, 1); prevEndDate = new Date(year - 1, 11, 31); }
    else { const __lenDays = Math.max(1, Math.round((endDate - startDate) / 86400000) + 1);
      prevEndDate = new Date(startDate); prevEndDate.setDate(prevEndDate.getDate() - 1);
      prevStartDate = new Date(prevEndDate); prevStartDate.setDate(prevStartDate.getDate() - __lenDays + 1); } const [currentTx, prevTx] = await Promise.all([ getTransactionsInRange(startDate, endDate), getTransactionsInRange(prevStartDate, prevEndDate) ]); document.getElementById('chartTitleTab2').textContent = (startMonth === 1 && endMonth === 12) ? `Thu nhập & Chi tiêu ${year}` : `Thu nhập & Chi tiêu (T${startMonth} - T${endMonth} / ${year})`; const labels = [], incs = [], exps = []; for(let m=startMonth; m<=endMonth; m++) { labels.push(`Tháng ${m}`); const mTx = currentTx.filter(t => parseInt(t.date.split('/')[1]) === m && parseInt(t.date.split('/')[2]) === year); let inc=0, exp=0; mTx.forEach(t => { if(t.type==='Thu nhập') inc+=t.amount; else exp+=t.amount; }); incs.push(inc); exps.push(exp); } document.getElementById('calendarStatbox').style.display = 'none'; processReportData(currentTx, prevTx, labels, incs, exps); cachedChartData = { mode: 'custom', txs: currentTx, periodStr: `${startMonth}-${endMonth}-${year}` }; } catch(e) { showToast(e.message, 'error'); } finally { showLoading(false, 'tab2'); } }

function updateTimeNavUI() {
   const label = document.getElementById('currentPeriodLabel'); const weekP = document.getElementById('weekPicker'); const monthP = document.getElementById('monthPicker'); const timeNav = document.getElementById('timeNavContainer'); const customNav = document.getElementById('customFilterContainer');
   if (currentFilterMode === 'weekly') { timeNav.style.display = 'flex'; customNav.style.display = 'none'; weekP.style.display = 'block'; monthP.style.display = 'none'; const wStr = formatWeekInput(activePeriodDate); weekP.value = wStr; label.textContent = `Tuần ${getWeekNumber(activePeriodDate)}, ${activePeriodDate.getFullYear()}`; loadWeeklyReport(wStr); } 
   else if (currentFilterMode === 'monthly') { timeNav.style.display = 'flex'; customNav.style.display = 'none'; weekP.style.display = 'none'; monthP.style.display = 'block'; const mStr = `${activePeriodDate.getFullYear()}-${String(activePeriodDate.getMonth()+1).padStart(2,'0')}`; monthP.value = mStr; label.textContent = `Tháng ${activePeriodDate.getMonth()+1}/${activePeriodDate.getFullYear()}`; loadMonthlyReport(mStr); } 
   else if (currentFilterMode === 'yearly') { timeNav.style.display = 'none'; customNav.style.display = 'none'; loadCustomReport(1, 12, new Date().getFullYear()); } 
   else if (currentFilterMode === 'custom') { timeNav.style.display = 'none'; customNav.style.display = 'flex'; const curM = new Date().getMonth() + 1; document.getElementById('startMonth').value = '1'; document.getElementById('endMonth').value = curM.toString(); }
}

// ---------------- TÌM KIẾM MODAL ----------------
window.openSearchModal = function() { triggerHaptic('light'); document.getElementById('modalOverlay').classList.add('show'); setTimeout(() => document.getElementById('searchModal').classList.add('show'), 10); };
window.closeSearchModal = function() { triggerHaptic('light'); document.getElementById('searchModal').classList.remove('show'); setTimeout(() => document.getElementById('modalOverlay').classList.remove('show'), 300); // PERSONAL ROUND 2 (như production R20-2): đóng modal Tìm kiếm -> nav highlight quay về tab đang hiển thị
  try { if (typeof window.__syncNavToActiveTab === 'function') window.__syncNavToActiveTab(); } catch (e) {} };

function displaySearchResults() {
    const list = document.getElementById('searchResultsContainer'); list.innerHTML=''; const data = cachedSearchResults;
    if(!data || data.length === 0) { document.getElementById('placeholderSearch').style.display = 'block'; document.getElementById('paginationSearch').style.display = 'none'; return; }
    document.getElementById('placeholderSearch').style.display = 'none'; document.getElementById('paginationSearch').style.display = 'flex';
    const tPages = Math.ceil(data.length / itemsPerPage); const pData = data.slice((currentPageSearch - 1) * itemsPerPage, currentPageSearch * itemsPerPage);
    pData.forEach((item, index) => { 
        const tCls = item.type==='Thu nhập'?'income':'expense'; const stt = (currentPageSearch - 1) * itemsPerPage + index + 1; 
        const card = document.createElement('div'); card.className = `tx-card ${tCls}`; 
        card.innerHTML = renderTxCard(item, stt); list.appendChild(card); 
    });
    document.getElementById('pageInfoSearch').textContent = `${currentPageSearch} / ${tPages}`; document.getElementById('prevPageSearch').disabled = currentPageSearch === 1; document.getElementById('nextPageSearch').disabled = currentPageSearch === tPages; document.getElementById('prevPageSearch').onclick = () => { triggerHaptic('light'); if(currentPageSearch > 1) { currentPageSearch--; displaySearchResults(); scrollPager('paginationSearch'); } }; document.getElementById('nextPageSearch').onclick = () => { triggerHaptic('light'); if(currentPageSearch < tPages) { currentPageSearch++; displaySearchResults(); scrollPager('paginationSearch'); } };
    document.querySelectorAll('#searchResultsContainer .edit-btn').forEach(btn => btn.onclick = () => { closeSearchModal(); setTimeout(() => openEditForm(data.find(i => String(i.id) === btn.getAttribute('data-id'))), 350); }); 
    document.querySelectorAll('#searchResultsContainer .delete-btn').forEach(btn => btn.onclick = () => deleteTransaction(btn.getAttribute('data-id'), { fromSearch: true }));
}
// ============================================================================
// (personal-port) G6 DONUT PANEL + INSIGHT STRIP — port từ production.
// Thích ứng: định dạng tiền qua currency.js của bản cá nhân (dấu chấm vi-VN /
// chế độ rút gọn), % tỉ trọng dùng dấu phẩy thập phân.
// ============================================================================
// (personal-port) PANEL THỐNG KÊ G6 THAY 3 STAT-CARD (Tab2) — port từ production R21/R23.
// Giữ nguyên ID: tab2Income/tab2Expense/tab2Balance + tab2*Compare (baseline đọc các ID này).
// Vòng donut trái (nét dày, khe trắng, đầu bo tròn; xanh lá=thu, hồng=chi) +
// 3 hàng chú thích phải (icon tím app thật + nhãn + số tiền + so sánh 2 tầng).
// Giữa vòng = % tỉ trọng chi tiêu (zero-flow: "0 ₫"/"Chưa phát sinh").
// So sánh render 2 tầng qua formatG6CompareCell; một MutationObserver giữ
// định dạng sống sót sau khi app-upgrade.js (wrapper ngoài cùng) ghi đè
// innerHTML các ô so sánh bằng HTML thô của getCompareHTML.
// ============================================================================
var G6_GREEN = '#10B981', G6_ROSE = '#F43F5E', G6_TRACK = '#E9EBF1', G6_PAD = 9;

function buildDonutSVG(inc, exp) {
  // R23: vòng 140px, nét 19 (tỉ lệ từ mẫu G7/G8 đã duyệt).
  var size = 140, sw = 19, r = (size - sw) / 2, cx = size / 2;
  var total = inc + exp;
  function pt(deg) { var a = (deg - 90) * Math.PI / 180; return [cx + r * Math.cos(a), cx + r * Math.sin(a)]; }
  function arc(a0, a1) {
    var p0 = pt(a0), p1 = pt(a1);
    var large = (a1 - a0) > 180 ? 1 : 0;
    return 'M ' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A ' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + large + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  var segs = '<circle cx="' + cx + '" cy="' + cx + '" r="' + r.toFixed(2) + '" fill="none" stroke="' + G6_TRACK + '" stroke-width="' + sw + '"/>';
  if (total > 0) {
    var expDeg = exp / total * 360, incDeg = 360 - expDeg;
    if (inc > 0) {
      if (incDeg >= 359.9) segs += '<circle cx="' + cx + '" cy="' + cx + '" r="' + r.toFixed(2) + '" fill="none" stroke="' + G6_GREEN + '" stroke-width="' + sw + '"/>';
      else segs += '<path d="' + arc(expDeg + G6_PAD, 360 - G6_PAD) + '" fill="none" stroke="' + G6_GREEN + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
    }
    if (exp > 0) {
      if (expDeg >= 359.9) segs += '<path d="' + arc(G6_PAD, 360 - G6_PAD) + '" fill="none" stroke="' + G6_ROSE + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
      else if (expDeg - 2 * G6_PAD < 3) {
        var bp = pt(Math.max(2.5, expDeg / 2));
        segs += '<circle cx="' + bp[0].toFixed(2) + '" cy="' + bp[1].toFixed(2) + '" r="' + (sw / 2).toFixed(1) + '" fill="' + G6_ROSE + '"/>';
      } else segs += '<path d="' + arc(G6_PAD, expDeg - G6_PAD) + '" fill="none" stroke="' + G6_ROSE + '" stroke-width="' + sw + '" stroke-linecap="round"/>';
    }
  }
  return '<svg class="g6-donut" viewBox="0 0 ' + size + ' ' + size + '">' + segs + '</svg>';
}

function g6CenterContent(inc, exp) {
  var total = inc + exp;
  if (total <= 0) return { pct: '0 ₫', lbl: 'Chưa phát sinh', zero: true };
  if (exp <= 0) return { pct: '0%', lbl: 'chưa có chi tiêu', zero: false };
  return { pct: Math.round(exp / total * 100) + '%', lbl: 'là chi tiêu', zero: false };
}

// Định dạng ô so sánh thành 2 tầng (lũy thừa, không phụ thuộc ai gọi sau):
// tầng 1 = nội dung tới trước "so với" (giữ màu ngữ nghĩa production),
// tầng 2 = "so với <kỳ>" xám. Số + ₫ giữ nguyên span nowrap.
function formatG6CompareCell(el) {
  if (!el || el.querySelector(':scope > .g6-cmpline')) return;
  var span = el.firstElementChild;
  if (!span) return;
  var color = '';
  try { color = span.style.color || ''; } catch (e) {}
  var l1 = document.createElement('span'); l1.className = 'g6-cmpline';
  if (color) l1.style.color = color;
  var l2 = document.createElement('span'); l2.className = 'g6-cmpline2';
  var hit = false;
  Array.prototype.slice.call(span.childNodes).forEach(function (n) {
    if (!hit && n.nodeType === 3 && n.textContent.indexOf('so với') >= 0) {
      var idx = n.textContent.indexOf('so với');
      var a = document.createTextNode(n.textContent.slice(0, idx));
      var b = document.createTextNode(n.textContent.slice(idx));
      if (a.textContent.trim()) l1.appendChild(a);
      l2.appendChild(b); hit = true;
    } else if (!hit) { l1.appendChild(n); } else { l2.appendChild(n); }
  });
  el.innerHTML = ''; el.appendChild(l1);
  if (hit) el.appendChild(l2);
}

function installG6CompareObserver() {
  if (window.__g6ObsInstalled) return; window.__g6ObsInstalled = true;
  var box = document.getElementById('monthlyStatsContainer');
  if (!box || !('MutationObserver' in window)) return;
  var obs = new MutationObserver(function () {
    ['tab2IncomeCompare', 'tab2ExpenseCompare', 'tab2BalanceCompare'].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) formatG6CompareCell(el);
    });
  });
  obs.observe(box, { childList: true, subtree: true, characterData: true });
}

function renderG6StatsPanel(tInc, tExp, tBal, pInc, pExp, pBal, compareText) {
  var box = document.getElementById('monthlyStatsContainer');
  if (!box) return;
  var tIncObj = formatCurrencyWithUnit(tInc);
  var tExpObj = formatCurrencyWithUnit(tExp);
  var tBalObj = formatCurrencyWithUnit(Math.abs(tBal));
  var sign = tBal > 0 ? '+ ' : (tBal < 0 ? '− ' : '');
  var eyeCls = (typeof isPrivacyActive !== 'undefined' && isPrivacyActive) ? 'fa-eye-slash' : 'fa-eye';
  // R23: mắt privacy KHÔNG còn nằm trong hàng số — về góc dưới-phải thẻ (G8-E).
  // PERSONAL ROUND 3d (Hùng: số tiền panel đen + icon một màu tím trầm):
  // số tiền + icon từng hàng mang màu ngữ nghĩa TƯƠI riêng — Thu nhập xanh
  // lá (số + icon CÙNG #10B981 từ vòng 3k — trước 3k số #098D5D; vòng 3e đổi từ
  // chàm theo yêu cầu của Hùng), Chi tiêu hồng SEM_EXP, Số dư tím SEM_BAL
  // (định trong app-core).
  // Màu đi qua class hàng .g6-inc/.g6-exp/.g6-bal (CSS ở personal-compat,
  // thắng rule #tab2 .stat-num !important của redesign) — KHÔNG dùng inline
  // color: inline không thắng được !important stylesheet, còn inline
  // !important thì phá vỡ mask privacy (inline thắng mọi stylesheet).
  // fitter chỉ đặt font-size inline nên không chỏi.
  function amtHTML(inner, id) {
    return '<div class="g6-amt stat-num" id="' + id + '">' + inner + '</div>';
  }
  var rows = [
    { icon: 'fa-hand-holding-dollar', label: 'Thu nhập', rowCls: 'g6-inc',
      amt: amtHTML(tIncObj.val + '<span>' + tIncObj.unit + '</span>', 'tab2Income'),
      cmp: getCompareHTML(tInc, pInc, 'income', compareText), cmpId: 'tab2IncomeCompare' },
    { icon: 'fa-money-bill-transfer', label: 'Chi tiêu', rowCls: 'g6-exp',
      amt: amtHTML(tExpObj.val + '<span>' + tExpObj.unit + '</span>', 'tab2Expense'),
      cmp: getCompareHTML(tExp, pExp, 'expense', compareText), cmpId: 'tab2ExpenseCompare' },
    { icon: 'fa-wallet', label: 'Số dư', rowCls: tBal < 0 ? 'g6-bal g6-balneg' : 'g6-bal',
      amt: amtHTML('<span>' + sign + '</span>' + tBalObj.val + '<span>' + tBalObj.unit + '</span>', 'tab2Balance'),
      cmp: getCompareHTML(tBal, pBal, 'balance', compareText), cmpId: 'tab2BalanceCompare' }
  ];
  var ctr = g6CenterContent(tInc, tExp);
  var html = '<div class="g6-panel">' +
    '<div class="g6-donutwrap">' + buildDonutSVG(tInc, tExp) +
    '<div class="g6-center' + (ctr.zero ? ' zero' : '') + '"><b class="g6-centerpct">' + ctr.pct + '</b><span>' + ctr.lbl + '</span></div></div>' +
    '<div class="g6-legend">' + rows.map(function (r) {
      // R23: icon CÙNG hàng flex với nhãn (.g6-lft) — thẳng tâm icon với tâm chữ nhãn;
      // so sánh thụt vào thẳng dưới nhãn (margin-left 28px trong CSS).
      return '<div class="g6-row ' + r.rowCls + '"><div class="g6-line1">' +
        '<span class="g6-lft"><span class="g6-ic"><i class="fas ' + r.icon + '"></i></span>' +
        '<span class="g6-tag">' + r.label + '</span></span>' + r.amt + '</div>' +
        '<div class="g6-cmp" id="' + r.cmpId + '">' + r.cmp + '</div></div>';
    }).join('') + '</div>' +
    // R23: mắt góc dưới-phải thẻ — vẫn là nút privacy-toggle-btn nên
    // togglePrivacy() lật eye/eye-slash qua updatePrivacyUI như cũ.
    '<i class="fas ' + eyeCls + ' privacy-toggle-btn g6-eyecorner" onclick="togglePrivacy()"></i></div>';
  box.innerHTML = html;
  ['tab2IncomeCompare', 'tab2ExpenseCompare', 'tab2BalanceCompare'].forEach(function (id) {
    formatG6CompareCell(document.getElementById(id));
  });
  installG6CompareObserver();
  try { if (typeof window.fitG6Center === 'function') window.fitG6Center(); } catch (e) {}
}

// Co chữ % giữa vòng tới khi vừa lọt lòng vòng (không dùng !important inline
// để CSS mask font-size:0 !important thắng khi privacy-on).
window.fitG6Center = function () {
  if (document.body.classList.contains('privacy-on')) return;
  var b = document.querySelector('#monthlyStatsContainer .g6-centerpct');
  var wrap = document.querySelector('#monthlyStatsContainer .g6-donutwrap');
  if (!b || !wrap) return;
  b.style.removeProperty('font-size');
  var fs = parseFloat(window.getComputedStyle(b).fontSize) || 24;
  var avail = wrap.clientWidth - 52;
  var guard = 40;
  while (b.scrollWidth > avail + 0.5 && fs > 12 && guard-- > 0) { fs -= 1; b.style.setProperty('font-size', fs + 'px'); }
};
(function initG6CenterResize() {
  var t = null;
  window.addEventListener('resize', function () {
    if (t) clearTimeout(t);
    t = setTimeout(function () { try { if (typeof window.fitG6Center === 'function') window.fitG6Center(); } catch (e) {} }, 150);
  });
})();

// ============================================================================
// FIX ROUND 29 (UX gói 3): THẺ INSIGHT BÁO CÁO (Tab2).
// Nằm dưới panel G6, trên nút xuất (markup #insightStrip trong index.html).
// Nội dung suy từ CÙNG dữ liệu kỳ đang render (currentTx) — KHÔNG chạm vào
// đường so sánh R27/R28 (app-upgrade.js giữ nguyên).
// - Có chi tiêu: dòng 1 = danh mục chi nhiều nhất + tỉ trọng; dòng 2 = ngày /
//   tháng chi cao nhất (+ trung bình ngày khi còn vừa ngân sách 2 dòng).
// - Không chi tiêu: 1 dòng "Chưa phát sinh chi tiêu trong kỳ này."
// - Privacy: mọi số tiền + % tỉ trọng -> "***"; vẽ lại khi bật/tắt ẩn số qua
//   window.refreshInsightStrip() (hook trong updatePrivacyUI, app-core.js).
// ============================================================================
function renderInsightStrip(ctx) {
  var strip = document.getElementById('insightStrip');
  if (!strip) return;
  var priv = (typeof isPrivacyActive !== 'undefined' && isPrivacyActive);
  var money = function (n) { if (priv) return '***'; var o = formatCurrencyWithUnit(Math.round(n)); return o.val + o.unit; };
  var pctT = function (p) { return priv ? '***' : (p + '%'); };
  // ROUND 3q: các dòng insight mang markup <strong> CHỈ quanh GIÁ TRỊ
  // (nhãn giữ thường 400 — chốt cuối của Hùng); mọi phép đo NGÂN SÁCH 2 DÒNG
  // phải đo độ dài HIỂN THỊ (bóc thẻ) để hành vi cắt dòng giữ nguyên như
  // trước khi có markup.
  var visLen = function (s) { return String(s).replace(/<[^>]*>/g, '').length; };
  var txs = (ctx && ctx.tx) || [];
  var labels = (ctx && ctx.labels) || [];
  var expTxs = txs.filter(function (t) { return t.type === 'Chi tiêu'; });
  var lines = [];
  if (!expTxs.length) {
    lines.push('Chưa phát sinh chi tiêu trong kỳ này.');
  } else {
    var catMap = {}, dayMap = {}, tExp = 0;
    expTxs.forEach(function (t) {
      tExp += t.amount;
      catMap[t.category] = (catMap[t.category] || 0) + t.amount;
      dayMap[t.date] = (dayMap[t.date] || 0) + t.amount;
    });
    var topCat = null, topAmt = 0;
    Object.keys(catMap).forEach(function (c) { if (catMap[c] > topAmt) { topAmt = catMap[c]; topCat = c; } });
    var share = tExp > 0 ? (topAmt / tExp * 100).toFixed(1).replace('.', ',') : '0,0';
    // ROUND 3q: thêm ":" sau "cho"; NHÃN "Chi nhiều nhất cho:" giữ THƯỜNG,
    // chỉ GIÁ TRỊ "<danh mục> — <số tiền>" in ĐẬM 700 qua <strong>; đoạn
    // "(…% tổng chi)" cũng thường. Privacy: money()/pctT() vẫn trả "***"
    // trong <strong> như cũ.
    lines.push('Chi nhiều nhất cho: <strong>' + escapeHTML(topCat) + ' — ' + money(topAmt) + '</strong> (' + pctT(share) + ' tổng chi)');
    var mode = (typeof currentFilterMode !== 'undefined') ? currentFilterMode : 'monthly';
    var wholeYear = (mode === 'yearly') || (mode === 'custom' && labels.length === 12 && labels[0] === 'Tháng 1');
    var line2 = '';
    if (wholeYear) {
      var mMap = {};
      expTxs.forEach(function (t) { var p = String(t.date || '').split('/'); if (p.length === 3) { var k = p[1] + '/' + p[2]; mMap[k] = (mMap[k] || 0) + t.amount; } });
      var bk = null, bv = 0;
      Object.keys(mMap).forEach(function (k) { if (mMap[k] > bv) { bv = mMap[k]; bk = k; } });
      if (bk) { var mp = bk.split('/'); line2 = 'Tháng chi cao nhất: <strong>Tháng ' + parseInt(mp[0], 10) + '/' + mp[1] + ' — ' + money(bv) + '</strong>'; }
    } else {
      var bd = null, bdv = 0;
      Object.keys(dayMap).forEach(function (k) { if (dayMap[k] > bdv) { bdv = dayMap[k]; bd = k; } });
      // ROUND 3q: đồng bộ biến thể ngày — nhãn thường, chỉ giá trị
      // "<ngày> — <số tiền>" đậm; hậu tố " · TB …/ngày" nối sau giữ thường.
      if (bd) { var dp = bd.split('/'); line2 = 'Ngày chi cao nhất: <strong>' + dp[0] + '/' + dp[1] + ' — ' + money(bdv) + '</strong>'; }
      var avg = dailyAverageForMode(mode, tExp, labels, expTxs);
      if (avg > 0 && (visLen(line2) + 20) <= 56) line2 += ' · TB ' + money(Math.round(avg)) + '/ngày';
    }
    if (line2) lines.push(line2);
  }
  var paintInsight = function () {
    strip.innerHTML = '<span class="insight-ic"><i class="fas fa-lightbulb"></i></span><span class="insight-lines">' +
      lines.map(function (l) { return '<span class="insight-line">' + l + '</span>'; }).join('') + '</span>';
  };
  paintInsight();
  strip.style.display = 'flex';
  // FIX 3b F-05: áp NGÂN SÁCH 2 DÒNG NỘI DUNG cho cả thẻ (production mới chỉ
  // áp cho đoạn trung bình ngày qua ước lượng (line2.length + 20) <= 56).
  // Ca biên của audit: danh mục chi nhiều nhất tên 34 ký tự + số 1,5 tỷ ->
  // dòng 1 dài 88 ký tự, thẻ cao 86px ở máy 360 trong khi khung chuẩn 2 dòng
  // là ~66px. Vượt ngân sách khi: dòng 1 > 72 ký tự HOẶC tổng nội dung
  // > 118 ký tự (ca thường: dòng 1 ~54, tổng ~108 -> không đụng). Khi vượt,
  // cắt dần chi tiết theo đúng thứ tự: (1) bỏ đoạn trung bình ngày
  // "· TB .../ngày", (2) bỏ hẳn dòng 2, (3) rút gọn tên danh mục ở dòng 1
  // bằng "…" — kết quả đo lại trên fixture audit: thẻ về đúng chiều cao
  // chuẩn 2 dòng, số tiền cao nhất vẫn còn nguyên.
  if (expTxs.length && lines.length) {
    var insightOver = function () {
      var t = 0;
      lines.forEach(function (l) { t += visLen(l); });
      return visLen(lines[0]) > 72 || t > 118;
    };
    if (insightOver()) {
      var line1I = lines[0];
      var line2I = lines.length > 1 ? lines[1] : '';
      var tbAt = line2I.indexOf(' · TB ');
      var line2NoAvg = tbAt >= 0 ? line2I.slice(0, tbAt) : line2I;
      var candI = [];
      if (line2I && line2NoAvg !== line2I) candI.push([line1I, line2NoAvg]);
      if (line2I) candI.push([line1I]);
      if (topCat && topCat.length > 20) candI.push(['Chi nhiều nhất cho ' + escapeHTML(topCat.slice(0, 20) + '…') + ' — ' + money(topAmt) + ' (' + pctT(share) + ' tổng chi)']);
      for (var ciI = 0; ciI < candI.length; ciI++) {
        lines = candI[ciI]; paintInsight();
        if (!insightOver()) break;
      }
    }
  }
  strip.style.display = 'flex';
  window.__insightCtx = ctx || null;
}

// Trung bình chi/ngày theo chế độ. Trả về 0 khi không tính được.
function dailyAverageForMode(mode, tExp, labels, expTxs) {
  try {
    if (mode === 'weekly') return tExp / 7;
    if (mode === 'monthly') {
      var apd = (typeof activePeriodDate !== 'undefined') ? activePeriodDate : new Date();
      var dim = new Date(apd.getFullYear(), apd.getMonth() + 1, 0).getDate();
      return dim > 0 ? tExp / dim : 0;
    }
    if (mode === 'custom') {
      var y = 0, months = [];
      (labels || []).forEach(function (l) { var m = /^Tháng (\d{1,2})$/.exec(l); if (m) months.push(parseInt(m[1], 10)); });
      (expTxs || []).forEach(function (t) { var p = String(t.date || '').split('/'); if (p.length === 3) y = parseInt(p[2], 10); });
      if (y && months.length) {
        var days = 0;
        months.forEach(function (mm) { days += new Date(y, mm, 0).getDate(); });
        return days > 0 ? tExp / days : 0;
      }
    }
  } catch (e) {}
  return 0;
}

// Vẽ lại thẻ insight khi bật/tắt ẩn số (giữ đúng kỳ đang xem).
window.refreshInsightStrip = function () {
  var strip = document.getElementById('insightStrip');
  if (!strip || strip.style.display === 'none') return;
  renderInsightStrip(window.__insightCtx);
};

// (personal-port) biểu đồ tháng theo từng ngày — port production R14
function buildMonthlyChartData(currentTx, year, month) {
    const daysInMonth = new Date(year, month, 0).getDate();
    const labels = [], incs = new Array(daysInMonth).fill(0), exps = new Array(daysInMonth).fill(0);
    for (let d = 1; d <= daysInMonth; d++) labels.push(String(d));
    (currentTx || []).forEach(t => {
        const day = parseInt(String(t.date || '').split('/')[0], 10);
        if (Number.isNaN(day) || day < 1 || day > daysInMonth) return;
        if (t.type === 'Thu nhập') incs[day - 1] += t.amount; else exps[day - 1] += t.amount;
    });
    return { labels, incs, exps };
}

// (personal-port) nút "Thêm giao dịch" ở trạng thái rỗng Tab1 — mở form thêm
// với ngày = ngày đang xem (port production R28).
window.emptyAddTxPrefill = async function () {
  try { await window.openAddForm(); } catch (e) {}
  try {
    var v = document.getElementById('transactionDate');
    var addDate = document.getElementById('addDate');
    if (v && v.value && addDate) {
      addDate.value = v.value;
      if (typeof window.__syncDateDisplay === 'function') window.__syncDateDisplay('addDate', 'addDateDisplay');
    }
  } catch (e) {}
  triggerHaptic('light');
};
