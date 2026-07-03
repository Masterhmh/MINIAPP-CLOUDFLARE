// ============================================================================
// app-core.js — NỀN TẢNG & TIỆN ÍCH CHUNG
// ----------------------------------------------------------------------------
// Vai trò: khởi tạo Telegram WebApp, đọc tham số URL (api/sheetId/botUrl),
//   kết nối Firebase, khai báo biến trạng thái toàn cục, bản đồ icon
//   (emoji <-> Font Awesome), các tiện ích dùng chung (haptic, privacy/ẩn số
//   dư, toast, loading, định dạng ngày & số, màu, icon danh mục, chuyển tab,
//   renderTxCard dựng thẻ giao dịch dùng chung) và fetchMonthData().
// Thứ tự nạp: ĐẦU TIÊN (trước currency.js và các module khác).
// Lưu ý: định dạng & bóc tách số tiền (formatCurrencyWithUnit, parseNumber)
//   đã tách riêng sang currency.js — xem chú thích bên dưới.
// ============================================================================

// Báo cho Telegram biết App đã sẵn sàng để hiển thị ngay lập tức
if (window.Telegram && window.Telegram.WebApp) {
    Telegram.WebApp.ready();
    Telegram.WebApp.expand();
}

// Flag đánh dấu tab 2 cần reload khi có thay đổi giao dịch
let tab2NeedsReload = false;

const urlParams = new URLSearchParams(window.location.search);
const apiUrl = urlParams.get('api');
const sheetId = urlParams.get('sheetId');
const proxyUrl = '/api/proxy?url=';
const botUrl = urlParams.get('botUrl');

async function notifyTelegram(methodStr, tx) {
    const chatId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || localStorage.getItem('settingChatId');
    if (!botUrl || !chatId) return;
    try {
        await fetch(botUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'notifyApp', chatId: chatId, tx: tx, method: methodStr }) });
    } catch(e) { console.log('Lỗi gửi thông báo Telegram:', e); }
}

// KẾT NỐI TRỰC TIẾP FIREBASE
const FIREBASE_URL = 'https://quanlychitieu-hmh-default-rtdb.firebaseio.com/';

if (!apiUrl || !sheetId) showToast("Thiếu thông tin API hoặc Sheet ID!", "error");

// Quản lý trạng thái
let cachedTransactions = null, cachedChartData = null; 
let cachedSearchResults = [], cachedKeywords = []; 
window.categoryIconMap = {}; 
window.customCategoryIcons = {}; 
window.currentChartType = 'bar'; // Mặc định biểu đồ cột

let toastQueue = [], isShowingToast = false, currentEditKeyword = null;
let currentToastEl = null, currentToastMsg = null, currentToastTimer = null;

const itemsPerPage = 10;
let currentPageTab1 = 1, currentPageCategory = 1, currentPageSearch = 1;
window.apiTxCache = {}; 
window.monthDataCache = {}; // Cache dữ liệu theo năm_tháng (vd "2026_1") — gộp/tránh gọi Firebase lặp khi chuyển tab; xóa khi thêm/sửa/xóa hoặc refresh cưỡng bức
let currentFilterMode = 'weekly', activePeriodDate = new Date();

let isPrivacyActive = localStorage.getItem('settingPrivacyMode') === 'true';

// ---------------- BỘ TỪ ĐIỂN DỊCH EMOJI SANG ICON VECTOR (VÀ NGƯỢC LẠI) ----------------
const EMOJI_TO_FA_MAP = {
    '🍔': 'fa-burger', '🍽️': 'fa-utensils', '🍜': 'fa-bowl-food', '☕': 'fa-mug-hot', '🍺': 'fa-beer-mug-empty', '🍕': 'fa-pizza-slice',
    '🚗': 'fa-car', '🛵': 'fa-motorcycle', '🚕': 'fa-taxi', '🚌': 'fa-bus', '✈️': 'fa-plane', '⛽': 'fa-gas-pump', '🚆': 'fa-train',
    '🏠': 'fa-house', '🏢': 'fa-building', '🛒': 'fa-cart-shopping', '🛍️': 'fa-bag-shopping', '👕': 'fa-shirt', '👗': 'fa-shirt', '👟': 'fa-shoe-prints', '👓': 'fa-glasses',
    '💻': 'fa-laptop', '📱': 'fa-mobile-screen', '🎮': 'fa-gamepad', '🎧': 'fa-headphones', '📺': 'fa-tv',
    '💡': 'fa-bolt', '💧': 'fa-droplet', '🔥': 'fa-fire', '📶': 'fa-wifi',
    '💊': 'fa-pills', '🩺': 'fa-stethoscope', '🏥': 'fa-house-medical', '💪': 'fa-dumbbell', '🦷': 'fa-tooth', '💓': 'fa-heart-pulse',
    '🎓': 'fa-graduation-cap', '📚': 'fa-book', '💼': 'fa-briefcase', '🖊️': 'fa-pen',
    '📈': 'fa-chart-line', '💰': 'fa-money-bill-wave', '🏦': 'fa-building-columns', '💳': 'fa-credit-card', '🐷': 'fa-piggy-bank', '🪙': 'fa-coins', '👛': 'fa-wallet',
    '🎁': 'fa-gift', '🎂': 'fa-cake-candles', '🐶': 'fa-paw', '🐱': 'fa-cat', '👶': 'fa-baby', '🧒': 'fa-child', '👥': 'fa-user-group',
    '🎬': 'fa-film', '🎵': 'fa-music', '⚽': 'fa-futbol', '🎫': 'fa-ticket', '🥂': 'fa-champagne-glasses',
    '🛡️': 'fa-shield-halved', '🧾': 'fa-file-invoice-dollar', '💅': 'fa-spa', '🔧': 'fa-wrench', '🔨': 'fa-hammer', '✂️': 'fa-scissors',
    '💬': 'fa-comments', '📦': 'fa-box', '🏷️': 'fa-tag', '✨': 'fa-star'
};

const FA_TO_EMOJI_MAP = {};
for (let emoji in EMOJI_TO_FA_MAP) {
    FA_TO_EMOJI_MAP[EMOJI_TO_FA_MAP[emoji]] = emoji;
}

// ---------------- UTILITIES & LẮNG NGHE MẮT THẦN ----------------
function triggerHaptic(style = 'light') { 
    if (localStorage.getItem('settingHaptic') === 'false') return;
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.impactOccurred(style); 
}
function triggerHapticNotification(type = 'success') { 
    if (localStorage.getItem('settingHaptic') === 'false') return;
    if (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) Telegram.WebApp.HapticFeedback.notificationOccurred(type); 
}

// Chạm vào mắt ngoài màn hình -> Chỉ đổi tạm thời cho phiên làm việc hiện tại
window.togglePrivacy = function() {
    triggerHaptic('light');
    isPrivacyActive = !isPrivacyActive;
    updatePrivacyUI(false); 
};

function updatePrivacyUI(syncSettings = false) {
    if (syncSettings) {
        const settingCheckbox = document.getElementById('settingPrivacyMode');
        if (settingCheckbox) settingCheckbox.checked = isPrivacyActive;
    }
    if (isPrivacyActive) {
        document.body.classList.add('privacy-on');
        document.querySelectorAll('.privacy-toggle-btn').forEach(btn => {
            btn.classList.remove('fa-eye');
            btn.classList.add('fa-eye-slash');
        });
    } else {
        document.body.classList.remove('privacy-on');
        document.querySelectorAll('.privacy-toggle-btn').forEach(btn => {
            btn.classList.remove('fa-eye-slash');
            btn.classList.add('fa-eye');
        });
    }
    // Bắt buộc vẽ lại các biểu đồ Canvas để ẩn/hiện số tiền bên trong
    if (window.mChart) window.mChart.update();
    if (window.pChart) window.pChart.update();
    if (window.dChart) window.dChart.update();
}

// Đổi theme mà KHÔNG ghi đè các class trạng thái khác trên <body> (đặc biệt là
// 'privacy-on'). Trước đây gán thẳng body.className = `theme-...` khiến chế độ
// ẩn số dư bị mất mỗi khi tải app hoặc đổi theme -> nay dùng classList.
function setBodyTheme(theme) {
    const body = document.body;
    body.classList.remove('theme-auto', 'theme-light', 'theme-dark');
    body.classList.add(`theme-${theme}`);
    if (isPrivacyActive) body.classList.add('privacy-on');
}
window.setBodyTheme = setBodyTheme;

function initSettings() {
    // Áp dụng lại theme đã lưu (giữ nguyên trạng thái ẩn số dư)
    const theme = localStorage.getItem('settingTheme') || 'dark';
    setBodyTheme(theme);

    // Đổ giá trị đã lưu vào các ô cài đặt
    const setVal = (id, val) => { const el = document.getElementById(id); if (el && val != null) el.value = val; };
    setVal('settingTheme', theme);
    setVal('settingDefaultTab', localStorage.getItem('settingDefaultTab'));
    setVal('settingStartOfWeek', localStorage.getItem('settingStartOfWeek'));
    setVal('settingCurrencyFormat', localStorage.getItem('settingCurrencyFormat'));
    setVal('settingChatId', localStorage.getItem('settingChatId'));

    const hap = document.getElementById('settingHaptic');
    if (hap) hap.checked = localStorage.getItem('settingHaptic') !== 'false';
}
function applyPrivacyMode() {
    isPrivacyActive = localStorage.getItem('settingPrivacyMode') === 'true';
    updatePrivacyUI(true);
}

// ============================================================================
// [ĐÃ TÁCH MODULE] formatCurrencyWithUnit(value)
// Hàm định dạng tiền (đầy đủ / rút gọn chuẩn quốc tế K/M/B) được định nghĩa
// trong currency.js — module tiền tệ duy nhất của app. currency.js nạp NGAY
// SAU app-core.js và gán window.formatCurrencyWithUnit, nên mọi lời gọi
// formatCurrencyWithUnit(...) ở các file khác vẫn hoạt động bình thường.
// ============================================================================
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

window.showCustomConfirm = function(title, messageHtml, confirmText, onConfirm) {
    let overlay = document.getElementById('customConfirmOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'customConfirmOverlay';
        overlay.className = 'custom-confirm-overlay';
        document.body.appendChild(overlay);
    }
    const modal = document.createElement('div');
    modal.className = 'custom-confirm-modal';
    modal.innerHTML = `<div style="padding:24px 20px 20px; text-align:center;"><div class="custom-confirm-icon"><i class="fas fa-trash-alt"></i></div><h3 class="custom-confirm-title">${title}</h3><p class="custom-confirm-message">${messageHtml}</p></div><div class="custom-confirm-actions"><button id="customConfirmCancel" class="custom-confirm-cancel">Hủy</button><button id="customConfirmOk" class="custom-confirm-ok">${confirmText}</button></div>`;
    overlay.innerHTML = ''; overlay.appendChild(modal); overlay.style.display = 'flex';
    void overlay.offsetWidth; overlay.style.opacity = '1'; modal.style.transform = 'scale(1)'; modal.style.opacity = '1';
    const closeModal = () => { overlay.style.opacity = '0'; modal.style.transform = 'scale(0.9)'; modal.style.opacity = '0'; setTimeout(() => { overlay.style.display = 'none'; }, 200); };
    document.getElementById('customConfirmCancel').onclick = () => { triggerHaptic('light'); closeModal(); };
    document.getElementById('customConfirmOk').onclick = () => { triggerHaptic('medium'); closeModal(); onConfirm(); };
};

// showToast(message, type, duration, showProgress)
// - showProgress KHÔNG truyền -> mặc định tắt thanh tiến trình (toast tức thời),
//   nhưng TỰ BẬT cho toast lỗi (type === 'error') để có đủ thời gian đọc.
// - Truyền true/false để override thủ công khi cần.
function showToast(message, type = "info", duration, showProgress) {
  if (duration == null) duration = type === 'error' ? 4000 : (type === 'success' ? 2200 : 1500);
  if (showProgress == null) showProgress = (type === 'error');
  // Chống dồn: toast mới trùng nội dung với toast đang hiện -> chỉ reset đồng hồ
  if (isShowingToast && currentToastEl && currentToastMsg === message) { armToastTimer(currentToastEl, duration); return; }
  toastQueue.push({ message, type, duration, showProgress });
  if (!isShowingToast) processToastQueue();
}
function armToastTimer(toast, duration) {
  if (currentToastTimer) clearTimeout(currentToastTimer);
  const bar = toast.querySelector('.toast-progress');
  if (bar) { bar.style.animation = 'none'; void bar.offsetWidth; bar.style.animation = `premiumToastProgress ${duration}ms linear forwards`; }
  currentToastTimer = setTimeout(dismissCurrentToast, duration);
}
function dismissCurrentToast() {
  if (!currentToastEl) return;
  if (currentToastTimer) { clearTimeout(currentToastTimer); currentToastTimer = null; }
  const el = currentToastEl; currentToastEl = null; currentToastMsg = null;
  el.classList.remove('show');
  setTimeout(() => { el.remove(); processToastQueue(); }, 400);
}
function processToastQueue() {
  if (toastQueue.length === 0) { isShowingToast = false; return; }
  isShowingToast = true; const { message, type, duration, showProgress } = toastQueue.shift();
  const toast = document.createElement('div'); toast.className = `premium-toast toast-${type}`;
  let icon = type === 'success' ? 'fa-check-circle' : (type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle');
  const progressHTML = (showProgress && duration > 0) ? `<div class="toast-progress" style="animation-duration:${duration}ms"></div>` : '';
  toast.innerHTML = `<i class="fas ${icon} toast-icon"></i><span class="toast-message">${escapeHTML(message)}</span>${progressHTML}`;
  toast.addEventListener('click', dismissCurrentToast);
  document.body.appendChild(toast); void toast.offsetWidth; toast.classList.add('show');
  currentToastEl = toast; currentToastMsg = message;
  currentToastTimer = setTimeout(dismissCurrentToast, duration);
}

function showLoading(show, tabId) {
  const el = document.getElementById(`loading${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`);
  if (el) el.style.display = show ? 'block' : 'none';
}

function formatDate(dateStr) { const parts = dateStr.split('/'); if (parts.length !== 3) return dateStr; return `${parts[0].padStart(2, '0')}/${parts[1].padStart(2, '0')}/${parts[2]}`; }
function formatDateToYYYYMMDD(date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`; }
function formatDateToDDMMYYYY(date) { return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth() + 1).padStart(2,'0')}/${date.getFullYear()}`; }
// ============================================================================
// [ĐÃ TÁCH MODULE] parseNumber(value)
// Hàm bóc tách số tiền người dùng nhập (hỗ trợ k / m / tr / tỉ..., trả về null
// nếu chuỗi không hợp lệ để chặn lưu nhầm) được định nghĩa trong currency.js.
// currency.js nạp ngay sau app-core.js và gán window.parseNumber.
// ============================================================================
function formatNumberWithCommas(value) {
    if (!value) return '';
    let val = value.toString().replace(/[^0-9]/g, '');
    if (!val) return '';
    return parseInt(val, 10).toLocaleString('vi-VN');
}
function getColorByIndex(i) { const c = ['#6366F1', '#F43F5E', '#10B981', '#F59E0B', '#06B6D4', '#EC4899', '#84CC16', '#8B5CF6', '#F97316', '#14B8A6', '#EAB308', '#D946EF', '#22C55E', '#0EA5E9', '#A855F7', '#EF4444', '#64748B', '#059669', '#DC2626', '#4F46E5', '#C026D3']; return c[i % c.length]; }

function getRawFaIconName(catName) {
    if (!catName) return null;
    const categoryName = catName.trim(); let iconVal = null;
    if (window.customCategoryIcons && window.customCategoryIcons[categoryName]) { iconVal = window.customCategoryIcons[categoryName].trim(); } 
    else if (window.categoryIconMap && window.categoryIconMap[categoryName]) { iconVal = window.categoryIconMap[categoryName].trim(); }
    if (iconVal) {
        const firstChar = Array.from(iconVal)[0];
        if (EMOJI_TO_FA_MAP[firstChar]) return EMOJI_TO_FA_MAP[firstChar];
        if (EMOJI_TO_FA_MAP[iconVal]) return EMOJI_TO_FA_MAP[iconVal];
        if (!/[^\x00-\x7F]/.test(iconVal)) return iconVal;
    }
    const faMapFallback = { 'ăn uống': 'fa-utensils', 'bảo hiểm': 'fa-shield-halved', 'công nghệ': 'fa-laptop', 'công việc': 'fa-briefcase', 'giặt ủi': 'fa-shirt', 'sửa chữa': 'fa-screwdriver-wrench', 'đi lại': 'fa-car-side', 'giải trí': 'fa-clapperboard', 'giáo dục': 'fa-graduation-cap', 'gia đình': 'fa-house-user', 'hóa đơn': 'fa-file-invoice-dollar', 'chăm sóc': 'fa-spa', 'làm đẹp': 'fa-spa', 'mua sắm': 'fa-bag-shopping', 'quà tặng': 'fa-gift', 'sức khỏe': 'fa-dumbbell', 'tiết kiệm': 'fa-chart-line', 'đầu tư': 'fa-chart-line', 'y tế': 'fa-pills', 'nhà cửa': 'fa-house', 'xăng': 'fa-gas-pump', 'lương': 'fa-money-bill-wave', 'thưởng': 'fa-gift', 'khác': 'fa-layer-group' };
    for (let key in faMapFallback) { if (categoryName.toLowerCase().includes(key)) return faMapFallback[key]; }
    return null;
}

function getCategoryIcon(cat) {
    if (!cat) return '<i class="fas fa-box-open"></i>';
    const rawFaIcon = getRawFaIconName(cat);
    if (rawFaIcon) {
        let finalIcon = rawFaIcon;
        if (!finalIcon.includes('fa-')) finalIcon = `fa-${finalIcon}`;
        if (!finalIcon.includes('fas ')) finalIcon = `fas ${finalIcon}`;
        return `<i class="${finalIcon}"></i>`;
    }
    const firstLetter = Array.from(cat.trim())[0].toUpperCase();
    return `<span style="font-weight: 900; font-family: 'Plus Jakarta Sans', sans-serif; font-size: 0.9em; line-height: 1;">${firstLetter}</span>`;
}

// ---------------- THẺ GIAO DỊCH DÙNG CHUNG ----------------
// Trước đây HTML thẻ giao dịch bị lặp ở 3 nơi (Tab 1, chi tiết, tìm kiếm).
// Gộp về 1 hàm để dễ đọc & bảo trì; các nút .edit-btn/.delete-btn giữ data-id
// nên mọi chỗ vẫn gắn sự kiện như cũ.
function renderTxCard(item, stt) {
    const isInc = item.type === 'Thu nhập';
    const tCls = isInc ? 'income' : 'expense';
    const icon = getCategoryIcon(item.category);
    const amtObj = formatCurrencyWithUnit(item.amount);
    return `<div class="tx-icon-wrap ${tCls}">${icon}</div>`
        + `<div class="tx-body">`
        +   `<div class="tx-title">${escapeHTML(item.content)}</div>`
        +   `<div class="tx-meta-row">`
        +     `<span class="tx-date">${escapeHTML(formatDate(item.date))}</span>`
        +     `<span class="tx-badge tx-badge-neutral">${escapeHTML(item.type)}</span>`
        +     `<span class="tx-badge ${tCls}">${escapeHTML(item.category)}</span>`
        +   `</div>`
        +   (item.note ? `<div class="tx-note"><i class="fas fa-tag tx-note-icon"></i>${escapeHTML(item.note)}</div>` : '')
        +   `<div class="tx-id-row"><span>STT: ${stt}</span> • <span>#${escapeHTML(item.id)}</span></div>`
        + `</div>`
        + `<div class="tx-right-col">`
        +   `<div class="tx-amount ${tCls}"><span>${isInc ? '+' : '−'}</span>${amtObj.val}<span>${amtObj.unit}</span></div>`
        +   `<div class="tx-actions">`
        +     `<button class="tx-btn edit-btn" data-id="${escapeHTML(item.id)}" title="Sửa"><i class="fas fa-pen"></i></button>`
        +     `<button class="tx-btn delete-btn" data-id="${escapeHTML(item.id)}" title="Xóa"><i class="fas fa-trash"></i></button>`
        +   `</div>`
        + `</div>`;
}
window.renderTxCard = renderTxCard;

function getCompareHTML(current, prev, type, text = 'so với kỳ trước') {
    let zeroObj = formatCurrencyWithUnit(0);
    if (prev === 0 && current === 0) return `<span style="color: var(--text-2); font-weight: 500;">− ${zeroObj.val}${zeroObj.unit} ${escapeHTML(text)}</span>`;
    let diff = current - prev;
    if (diff === 0) return `<span style="color: var(--text-2); font-weight: 500;">− Bằng ${escapeHTML(text)}</span>`;
    let isUp = diff > 0;
    let icon = isUp ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    let arrowText = isUp ? (type === 'balance' ? 'Dư' : 'Tăng') : (type === 'balance' ? 'Âm' : 'Giảm');
    let colorVar = type === 'expense' ? (isUp ? 'var(--expense)' : 'var(--income)') : (isUp ? 'var(--income)' : 'var(--expense)');
    let diffObj = formatCurrencyWithUnit(Math.abs(diff));
    return `<span style="color: ${colorVar}; font-weight: 600;">${icon} ${arrowText} ${diffObj.val}${diffObj.unit} ${escapeHTML(text)}</span>`;
}

window.openTab = function(tabId) {
  triggerHaptic('light');
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(btn) btn.classList.add('active');
};

// fetchMonthData(month, year, forceRefresh)
// Tải toàn bộ giao dịch của 1 tháng thuộc 1 NĂM cụ thể TRỰC TIẾP từ Firebase,
// theo cấu trúc mới: /transactions/{năm}/month_{tháng}. Nhờ tách theo năm nên
// dữ liệu các năm được giữ lại vĩnh viễn để so sánh, không bị ghi đè lẫn nhau.
// Có cache theo "năm_tháng" (window.monthDataCache) để gộp/tránh gọi lặp khi
// chuyển tab, tìm kiếm, hay dựng lại phạm vi điều hướng. Truyền forceRefresh =
// true để bỏ qua cache (khi vừa thêm/sửa/xóa hoặc người dùng kéo làm mới).
async function fetchMonthData(month, year, forceRefresh = false) {
    const mKey = parseInt(month, 10);
    const yKey = parseInt(year, 10) || new Date().getFullYear();
    const cacheKey = `${yKey}_${mKey}`;
    if (!forceRefresh && window.monthDataCache && window.monthDataCache[cacheKey]) {
        return window.monthDataCache[cacheKey];
    }
    const res = await fetch(`${FIREBASE_URL}/transactions/${yKey}/month_${mKey}.json`);
    if (!res.ok) throw new Error(`Máy chủ trả lỗi ${res.status} khi tải tháng ${mKey}/${yKey}`);
    const data = await res.json();
    let result = [];
    if (data) {
        result = Object.values(data).filter(item => item !== null).map(item => {
            if (item && item.date) {
                const p = item.date.split('/');
                if (p.length === 3) item.date = `${String(parseInt(p[0], 10)).padStart(2, '0')}/${String(parseInt(p[1], 10)).padStart(2, '0')}/${p[2]}`;
            }
            return item;
        });
    }
    if (window.monthDataCache) window.monthDataCache[cacheKey] = result;
    return result;
}
