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

// ==== (personal-port) ROUND 3g: mở FULLSCREEN trong Telegram + safe-area ====
// Main Mini App mở từ BotFather mặc định hiện full màn hình, còn app mở từ
// nút trong khung chat thì không — phải tự xin qua requestFullscreen()
// (Bot API 8.0+). Xin đúng 1 LẦN khi khởi động; người dùng tự thoát
// fullscreen thì tôn trọng, KHÔNG xin lại. Client cũ / ngoài Telegram:
// no-op hoàn toàn (mọi API đều kiểm tra tồn tại trước khi gọi).
// Khi fullscreen, Telegram chèn nút nổi (đóng ⋯) ở mép trên màn hình: cộng
// safeAreaInset.top + contentSafeAreaInset.top vào biến CSS --hmh-sat để
// personal-compat.css §21 chừa khoảng trống trên cùng cho app.
// ROUND 3l: inset lấy ĐÚNG số Telegram báo ở mọi trạng thái — kể cả trạng
// thái CHỜ fullscreen (nút nổi đã phủ lên nội dung dù isFullscreen còn
// false). Telegram báo 0 -> --hmh-sat = 0px -> bố cục y hệt như trước.
(function hmhFullscreenSetup() {
    try {
        var tg = (window.Telegram && window.Telegram.WebApp) || null;
        if (!tg) return;
        // ROUND 3n (bổ sung theo ảnh desktop của Hùng): đánh dấu client
        // DESKTOP bằng body.hmh-desktop để Cách A (thu hẹp cụm ngày khi
        // màn hẹp — personal-compat.css §27 + nhãn gọn trong
        // app-reports.js) KHÔNG áp dụng trên máy tính: ở đó cụm ngày
        // luôn nguyên cỡ kèm caret ▾ ở mọi bề rộng cửa sổ. tdesktop/
        // macos là client desktop thật; weba/webk chạy trên desktop
        // được §27 chặn thêm bằng điều kiện (pointer: coarse), còn
        // weba/webk trên điện thoại vẫn là điện thoại (cảm ứng là
        // pointer chính) nên Cách A giữ nguyên ở đó.
        try {
            var hmhPlat = String(tg.platform || '');
            var markHmhDesktop = function () {
                if (document.body) document.body.classList.toggle('hmh-desktop', hmhPlat === 'tdesktop' || hmhPlat === 'macos');
            };
            if (document.body) markHmhDesktop();
            else document.addEventListener('DOMContentLoaded', markHmhDesktop);
        } catch (e) {}
        function applySafeArea() {
            var sat = 0;
            try {
                // ROUND 3l (như production R33): KHÔNG cổng isFullscreen —
                // Telegram báo contentSafeAreaInset.top > 0 ngay từ trạng
                // thái CHỜ fullscreen, cổng cũ ép sat = 0 suốt cửa sổ chờ
                // -> dải/đệm mất, vết cắt quay lại cho tới khi được cấp
                // fullscreen. Nay inset là đúng số Telegram báo ở MỌI
                // trạng thái (chờ / fullscreen / chuyển đổi).
                var sa = tg.safeAreaInset || {}, ca = tg.contentSafeAreaInset || {};
                sat = (Number(sa.top) || 0) + (Number(ca.top) || 0);
            } catch (e) {}
            document.documentElement.style.setProperty('--hmh-sat', sat + 'px');
            // ROUND 3h + 3l: body.hmh-fs nghĩa là "DẢI ĐANG HOẠT ĐỘNG"
            // (sat > 0, ở bất kỳ trạng thái nào) — personal-compat.css §22
            // dùng nó để dựng dải tím phủ vùng status/nút nổi (Cách B) +
            // áp đệm trên cho mọi trang. sat = 0 (Telegram báo không có
            // inset) thì không lớp, không dải, bố cục y hệt như trước.
            try {
                if (document.body) document.body.classList.toggle('hmh-fs', sat > 0);
            } catch (e) {}
        }
        if (typeof tg.onEvent === 'function') {
            tg.onEvent('safeAreaChanged', applySafeArea);
            tg.onEvent('contentSafeAreaChanged', applySafeArea);
            tg.onEvent('fullscreenChanged', applySafeArea);
            // Xin fullscreen thất bại (thiết bị không hỗ trợ): giữ nguyên
            // chế độ expand, im lặng — không báo lỗi, không thử lại.
            tg.onEvent('fullscreenFailed', function () {});
        }
        // Màu thanh header Telegram = tím hero để vùng trên cùng liền mạch
        if (typeof tg.setHeaderColor === 'function') {
            try { tg.setHeaderColor('#7C3AED'); } catch (e) {}
        }
        applySafeArea();
        // ROUND 3l (như production R33-B, Hùng chốt 20/10): chỉ tự xin
        // fullscreen trên iOS/Android. Nền desktop (tdesktop/macos/weba/
        // webk/...) KHÔNG xin — Telegram Desktop/Web mở app trong cửa sổ
        // thường của nó (như cửa sổ BotFather), không ép toàn màn hình.
        var canFullscreen = (tg.platform === 'ios' || tg.platform === 'android') &&
            typeof tg.requestFullscreen === 'function' &&
            (typeof tg.isVersionAtLeast !== 'function' || tg.isVersionAtLeast('8.0'));
        if (canFullscreen && !window.__hmhFsRequested) {
            window.__hmhFsRequested = true;
            tg.requestFullscreen();
        }
    } catch (e) { /* lỗi phía Telegram không được làm hỏng khởi động app */ }
})();

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

// ==== secureFetch: cổng truy cập Firebase an toàn (bản cá nhân) ====
// Thay cho việc gọi thẳng FIREBASE_URL. Mọi đọc/ghi Firebase đi qua đây.
// Ví dụ path: `/transactions/2026/month_07.json`
async function secureFetch(path, method = 'GET', data = null) {
    const initData = (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData) || '';
    const opts = {
        method,
        headers: {
            'Authorization': initData,      // gửi initData để server xác thực
            'Content-Type': 'application/json'
        }
    };
    if (data !== null && (method === 'PUT' || method === 'PATCH' || method === 'POST')) {
        opts.body = JSON.stringify(data);
    }
    const res = await fetch('/api/secure_firebase?path=' + encodeURIComponent(path), opts);
    if (!res.ok) throw new Error('secureFetch ' + method + ' ' + path + ' -> ' + res.status);
    const text = await res.text();
    if (!text || text === 'null') return null;
    try { return JSON.parse(text); } catch (e) { return text; }
}
window.secureFetch = secureFetch;

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

// ---------------- BỘ TỪ ĐIỂN DẪCH EMOJI SANG ICON VECTOR (VÀ NGƯỢC LẠI) ----------------
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
// (personal-port) Rung chọn khi chuyển tab/pill — cổng gọi chung hmhHaptic
function triggerHapticSelection() {
    if (localStorage.getItem('settingHaptic') === 'false') return;
    try {
        var hf = (window.Telegram && Telegram.WebApp && Telegram.WebApp.HapticFeedback) || null;
        if (hf && typeof hf.selectionChanged === 'function') hf.selectionChanged();
    } catch (e) {}
}
window.hmhHaptic = function (kind, arg) {
    if (kind === 'selection') triggerHapticSelection();
    else if (kind === 'notification') triggerHapticNotification(arg || 'success');
    else triggerHaptic(arg || 'light');
};

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
    // (personal-port) vẽ lại thẻ insight báo cáo theo trạng thái ẩn số
    try { if (typeof window.refreshInsightStrip === 'function') window.refreshInsightStrip(); } catch (e) {}
    // FIX R2-3 (bản cá nhân): bật/tắt ẩn số đổi hiển thị -> co cỡ số lại cho
    // vừa hàng (và gỡ inline-size khi masked để lớp mask "***" thắng).
    try { if (typeof window.fitStatAmounts === 'function') window.fitStatAmounts(); } catch (e) {}
    // FIX 3b F-07: số trong ô lịch dùng inline font-size !important khi co cho
    // vừa ô -> phải đồng bộ theo ẩn số (bật: gỡ inline để mask "***" thắng;
    // tắt: co lại) — cùng kỷ luật với fitStatAmounts ở trên.
    try { if (typeof window.fitCalendarAmounts === 'function') window.fitCalendarAmounts(); } catch (e) {}
}

// ============================================================================
// FIX ROUND 20 (port từ production) + FIX R2-3: CO CỠ SỐ STAT CHO VỪA HÀNG.
// Bản cá nhân CHƯA từng có fitter này -> số dài bị overflow:hidden + clip
// cắt mất đuôi (ký tự ₫) — Hùng chụp được ở chế độ năm: Số dư
// "− 229.740.842 ₫" bị cụt "₫" ở mép phải panel.
// Cơ chế (như production): đo bề rộng GLYPH thật bằng Range (scrollWidth mù
// khi flex + overflow:hidden), thu nhỏ từng số tới khi vừa bề rộng khả dụng,
// rồi áp CỠ CHUNG NHỎ NHẤT cho cả nhóm hàng (các số cùng cỡ, mép phải thẳng
// hàng Δ=0). Sàn 12.8px (≈0.8rem), CSS dùng !important nên setProperty phải
// kèm 'important'. Privacy-on: GỠ inline font-size để lớp CSS mask
// (font-size:0 !important + "***"::after) thắng — không bao giờ để số thật lộ.
// FIX R2-3 — DỰ TRỮ MẮT: mắt privacy nằm absolute ở góc dưới-phải panel
// (bottom:4/right:4, hộp 32px) và TRÙNG dải ngang với đuôi số hàng Số dư
// (đo thực tế: overlap ngang 24px, hở dọc chỉ ~8px theo số liệu sandbox —
// trên máy thật, glyph SF rộng hơn ~25% + lệch vài px là mắt đè lên ký tự
// ₫, đúng như ảnh Hùng chụp). Cơ chế dự trữ KHÔNG nằm trong fitter (chữ căn
// phải nên thu nhỏ cỡ không dời được mép phải) mà nằm ở CSS:
// personal-compat.css §15 cho .g6-amt padding-right:40px ở CẢ 3 HÀNG ->
// mép phải glyph của cả 3 số lùi đều 40px (vẫn thẳng hàng Δ=0), vùng mắt
// luôn trống; fitter dưới đây trừ padding khi tính avail như production.
// ============================================================================
function fitAmountRow(ids) {
  var FLOOR = 12.8; // ≈0.8rem (như production R20)
  function textW(el) {
    var kids = [];
    Array.prototype.forEach.call(el.childNodes, function (nd) {
      if (nd.nodeType === 1 && window.getComputedStyle(nd).position === 'absolute') return;
      kids.push(nd);
    });
    if (!kids.length) return el.scrollWidth;
    try {
      var r = document.createRange();
      r.setStartBefore(kids[0]);
      r.setEndAfter(kids[kids.length - 1]);
      return r.getBoundingClientRect().width;
    } catch (e) { return el.scrollWidth; }
  }
  var fitted = [];
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (!el) return;
    el.style.removeProperty('font-size'); // về cỡ CSS của viewport hiện tại
    var cs = window.getComputedStyle(el);
    var avail = el.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0);
    if (!(avail > 0)) return;
    var size = parseFloat(cs.fontSize) || 16;
    if (size < 8) return; // đang bị mask (privacy-on) — bỏ qua hàng này
    var guard = 60;
    while (textW(el) > avail + 0.5 && size > FLOOR && guard-- > 0) {
      size = Math.max(FLOOR, size - 1);
      el.style.setProperty('font-size', size + 'px', 'important');
    }
    fitted.push(size);
  });
  if (!fitted.length) return;
  var shared = Math.min.apply(null, fitted);
  ids.forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.style.setProperty('font-size', shared + 'px', 'important');
  });
}

window.fitStatAmounts = function () {
  var ids = ['tab2Income', 'tab2Expense', 'tab2Balance', 'heroIncome', 'heroBalanceSub', 'heroExpenseMain'];
  if (document.body.classList.contains('privacy-on')) {
    // mask thắng: gỡ inline font-size để CSS font-size:0 !important có hiệu lực
    // (inline !important thắng stylesheet !important -> số không bị che)
    ids.forEach(function (id) { var el = document.getElementById(id); if (el) el.style.removeProperty('font-size'); });
    return; // "***" luôn vừa
  }
  fitAmountRow(['tab2Income', 'tab2Expense', 'tab2Balance']);
  fitAmountRow(['heroIncome', 'heroBalanceSub']);
  // FIX 3b F-06: số chi chính của hero (cố định 45px, nowrap) trước đây KHÔNG
  // được fit ở cả hai bản -> ngày chi >= ~1.000 tỷ ₫ sẽ tràn hero ở máy 360.
  // Fit riêng một nhóm (không dùng chung cỡ với heroIncome/heroBalanceSub vốn
  // nhỏ hơn nhiều); fitAmountRow chỉ thu nhỏ khi glyph thật vượt bề rộng khả
  // dụng nên số thường giữ nguyên cỡ thiết kế.
  fitAmountRow(['heroExpenseMain']);
};

(function initStatAmountResize() {
  var t = null;
  window.addEventListener('resize', function () {
    if (t) clearTimeout(t);
    t = setTimeout(function () { try { window.fitStatAmounts(); } catch (e) {} }, 150);
  });
})();

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
  const key = `loading${tabId.charAt(0).toUpperCase() + tabId.slice(1)}`;
  const el = document.getElementById(key);
  if (!el) return;
  // (personal-port) skeleton chỉ thay spinner khi tải quá 300ms; giữ nguyên
  // hành vi display block/none của bản gốc.
  if (show) {
    el.classList.remove('skel-on');
    el.style.display = 'block';
    clearTimeout(window.__skelTimers && window.__skelTimers[key]);
    if (!window.__skelTimers) window.__skelTimers = {};
    window.__skelTimers[key] = setTimeout(() => {
      const e2 = document.getElementById(key);
      if (e2 && e2.style.display === 'block') e2.classList.add('skel-on');
    }, 300);
  } else {
    if (window.__skelTimers) clearTimeout(window.__skelTimers[key]);
    el.classList.remove('skel-on');
    el.style.display = 'none';
  }
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
/* PERSONAL ROUND 3 (W1) — bảng màu danh mục THIẾT KẾ LẠI theo yêu cầu của
   Hùng (bảng vòng 27 quá nhiều tím/hồng cạnh nhau, có cả trùng màu thật:
   "Bảo hiểm" và "Công nghệ" cùng #A855F7). Nguyên tắc:
   - 14 màu giãn ĐỀU trên vòng hue, bước 360/14 ≈ 25,7° → mọi cặp màu cách
     nhau ≥ 25,4° hue (đo trên hex cuối) → không còn cặp nào "na ná" nhau.
   - Màu vẫn gán theo TÊN danh mục (băm ổn định) — cùng một danh mục ở mọi
     biểu đồ/chú thích/thẻ/PDF luôn cùng một màu. Băm = h*31 + finalizer
     xor-shift 13, seed 266571: seed được chọn bằng tìm kiếm tự động vì 2 lý
     do: (1) băm cũ (kể cả mọi cỡ bảng 12–21) đều làm trùng màu trong 12 danh
     mục thật của Hùng; (2) "Gia đình"/"Bảo hiểm" có độ dài bằng nhau nên băm
     h*31 thuần luôn khóa chúng ở 2 ô kề nhau (25,7°) — finalizer phá khóa đó.
     Với seed đã chọn: 12 danh mục thật của Hùng rơi vào 12 ô KHÁC NHAU, mọi
     cặp kề nhau trên donut tháng 10 của anh cách nhau ≥ 102,9° hue.

   PERSONAL ROUND 3c — Hùng chê bảng vòng 3 "xỉn": vòng 3 đã sẫm hóa mọi màu
   để đạt tương phản chữ ≥ 4,5:1 (chàm đậm, đỏ gạch, olive, nâu — đục). Nay
   TÁCH mỗi màu thành 2 biến thể CÙNG HUE (gán hue/ô giữ nguyên tuyệt đối,
   lệch hue fill↔text ≤ 0,2°):
   - FILL (CATEGORY_PALETTE, getCategoryColor): lát donut, thanh tiến trình,
     chip icon, tô PDF — TƯƠI như họ màu biểu đồ cột/đường của app
     (#F43F5E L60/S89 · #6366F1 L67/S84): HSL L 52,9–63,1%, S 83,7–88,4%
     (kiểm chứng bằng script: mọi fill nằm trong dải L 52–65 / S ≥ 80).
   - TEXT (CATEGORY_TEXT_PALETTE, getCategoryTextColor): chữ % chú thích,
     số tiền thẻ danh mục, %/chữ xuất PDF — chính là hex vòng 3, tương phản
     trên nền trắng ≥ 5,03:1 (chuẩn ≥ 4,5:1).
   Ánh xạ 12 danh mục thật (fill / text):
     Gia đình #5550F2 / #3933E6 · Bảo hiểm #EC4722 / #A32E14 ·
     Y tế #9341F1 / #761BDE · Ăn uống #8FEC22 / #497B0F ·
     Công nghệ #4086F2 / #1654B3 · Đi lại #F19E1E / #986413 ·
     Mua sắm #DC32F1 / #BB1ACF · Cà phê #E6EE20 / #585B0B ·
     Giáo dục #20EE63 / #107F34 · Sức khỏe #20EEBB / #0C644E ·
     Nhà cửa #27CEF1 / #12798F · Giải trí #F23665 / #D81B4A.

   PERSONAL ROUND 3d — Hùng xem ảnh thật: "Màu số tiền, icon… tổng thể phải
   tươi lên". Vòng 3c mới làm tươi phần TÔ; số tiền/icon/chip vẫn dùng bản
   TEXT trầm của vòng 3 → tổng thể vẫn xỉn. Vòng này thay TEXT bằng
   TEXT-VIVID: CÙNG hue + ô với fill, bão hòa >= 85%, độ sáng = MỨC CAO
   NHẤT còn đạt tương phản >= 4,2:1 trên nền trắng (tính bằng script từng
   màu; hue sáng như chàm/tím lên tới L 63–68, hue vàng/xanh lá — vốn mang
   luminance cao — dừng ở L 27–36 nhưng bão hòa 85%+ nên vẫn rực hơn bản
   cũ hẳn). Mọi CHỮ mang màu danh mục dùng bản này: % chú thích 2 donut,
   số tiền thẻ danh mục, số tiền tâm donut khi chạm lát, chữ/% xuất PDF.
   Bản TEXT vòng 3 bị thay thế hoàn toàn (không còn consumer nào dùng).
   Ánh xạ 12 danh mục thật (fill / text-vivid):
     Gia đình #5550F2 / #6E69F4 · Bảo hiểm #EC4722 / #E53913 ·
     Y tế #9341F1 / #9D53F2 · Ăn uống #8FEC22 / #4F890B ·
     Công nghệ #4086F2 / #2877F0 · Đi lại #F19E1E / #AD6D0B ·
     Mua sắm #DC32F1 / #D010E8 · Cà phê #E6EE20 / #7B800A ·
     Giáo dục #20EE63 / #0B8E36 · Sức khỏe #20EEBB / #0B8C6C ·
     Nhà cửa #27CEF1 / #0A86A0 · Giải trí #F23665 / #F01B51.

   PERSONAL ROUND 3f — Hùng khoanh ảnh thật: "Từ icon, đến thanh trượt đến
   số tiền của từng danh mục phải ĐỒNG BỘ màu với nhau chứ". Việc tách 2
   biến thể FILL/TEXT-VIVID khiến CÙNG một danh mục hiện 2 màu khác nhau
   rõ rệt trên cùng một thẻ (đo thật: Ăn uống — icon/số/% #4F890B olive sẫm
   trong khi thanh tiến trình + lát donut #8FEC22 lime neon). Nay HỢP NHẤT
   về MỘT màu chuẩn duy nhất = bảng TEXT-VIVID (giữ nguyên hue/ô, S >= 85%,
   tương phản chữ >= 4,2:1): CATEGORY_PALETTE chép đúng các hex TEXT-VIVID
   nên getCategoryColor() === getCategoryTextColor() ở mọi danh mục — lát
   donut (Tab2 + chi tiết ngày), thanh tiến trình, icon, số tiền, %, nền
   chip (chuẩn ở ~14% alpha) và điểm nhấn PDF đều dùng đúng 1 hex. Bảng
   FILL tươi của 3c bị thay thế hoàn toàn.

   PERSONAL ROUND 3h — Hùng vẫn chê màu chuẩn 3f "xỉn" trên máy thật và
   đã CHỌT demo "bậc tươi-large" (demo-fs-color/DEMO.md): giữ nguyên
   hue/ô của bảng 3f, ép bão hòa S = 88%, độ sáng L = mức CAO NHẤT còn
   đạt tương phản >= 3,1:1 trên trắng (ngưỡng chữ lớn/đậm — số tiền thẻ
   danh mục là chữ đậm ~16,5px). 12 danh mục thật lấy đúng hex đã duyệt
   ở DEMO.md; 2 ô không thuộc danh mục thật của Hùng (#198E0B hue 113,6°
   và #E70EA1 hue 319,4°) tính bằng cùng quy tắc -> #1CA90B / #F450BF.
   Nguyên tắc MỘT hex/danh mục của 3f giữ nguyên tuyệt đối:
   CATEGORY_PALETTE === CATEGORY_TEXT_PALETTE; màu ngữ nghĩa Thu/Chi/Dư
   không đụng. */
const CATEGORY_PALETTE = ['#F55C83', '#F36545', '#CD810D', '#92980A', '#5DA30A', '#1CA90B', '#0BA93F', '#0BA57F', '#0C9FBD', '#5191F4', '#8985F7', '#B175F6', '#E252F4', '#F450BF'];
const CATEGORY_TEXT_PALETTE = ['#F55C83', '#F36545', '#CD810D', '#92980A', '#5DA30A', '#1CA90B', '#0BA93F', '#0BA57F', '#0C9FBD', '#5191F4', '#8985F7', '#B175F6', '#E252F4', '#F450BF'];
/* PERSONAL ROUND 3d — màu NGỮ NGHĨA tươi cho số tiền + icon (tương phản
   trên trắng đo bằng script: #6366F1 = 4,47 · #E11D48 = 4,70 ·
   #7C3AED = 5,70 · #098D5D = 4,22; riêng statbox Tab1 nền #F4F4F8 nên
   chàm lùi 1 nấc #6062F2 = 4,23 trên nền đó — vẫn cùng họ #6366F1).
   SEM_EXP/SEM_EARN cũng là màu số tiền thẻ giao dịch (.tx-amount, trong
   redesign.css) và thẻ tổng modal chi tiết ngày (index.html).

   PERSONAL ROUND 3e — Hùng chốt: "Thu nhập phải màu xanh lá" (bản 3d để
   Thu = chàm #6366F1). MỌI rendition Thu nhập chuyển sang họ emerald:
   - SEM_INC (số tiền Thu panel G6, nền trắng): #098D5D = 4,22:1.
   - SEM_INC_STAT (số tiền Thu statbox Tab1, nền thẻ #F4F4F8): #0B855D
     = 4,23:1 trên nền đó (chính là --income của redesign.css; #098D5D
     trên nền thẻ chỉ đạt 3,84 nên không dùng chung được).
   - SEM_INC_VIVID (icon Thu panel/statbox, lát Thu donut G6, dataset
     Thu biểu đồ cột/đường): #10B981 tươi (H160 S84% L39%) — phần TÔ/icon
     không phải chữ nên được dùng bản tươi nhất của họ.
   Chi tiêu hồng SEM_EXP và Số dư tím SEM_BAL giữ nguyên.

   PERSONAL ROUND 3k — Hùng chốt: "Màu số tiền thu nhập phải cùng màu
   với icon của thu nhập". MỌI số tiền Thu -> #10B981 (= SEM_INC_VIVID,
   trùng hex icon): panel G6 + statbox Tab1 (CSS personal-compat §18),
   .tx-amount.income (redesign.css), tổng Thu modal chi tiết ngày
   (index.html, cả nhãn+icon lẫn số). SEM_INC #098D5D từ vòng này CHỈ
   còn nuôi dòng so sánh "chiều tốt" của getCompareHTML (ngoài phạm vi
   3k, giữ nguyên); SEM_INC_STAT/SEM_EARN là hằng legacy không còn
   consumer trong code. */
const SEM_INC = '#098D5D', SEM_INC_STAT = '#0B855D', SEM_INC_VIVID = '#10B981', SEM_EXP = '#E11D48', SEM_BAL = '#7C3AED', SEM_EARN = '#098D5D';
function categoryPaletteIndex(name) {
  const s = String(name || '');
  let h = 266571;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.codePointAt(i)) >>> 0;
  h = (h ^ (h >>> 13)) >>> 0;
  return h % CATEGORY_PALETTE.length;
}
function getCategoryColor(name) {
  return CATEGORY_PALETTE[categoryPaletteIndex(name)];
}
function getCategoryTextColor(name) {
  return CATEGORY_TEXT_PALETTE[categoryPaletteIndex(name)];
}

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

// ---------------- THẼ GIAO DỊCH DÙNG CHUNG ----------------
// Trước đây HTML thẻ giao dịch bị lặp ở 3 nơi (Tab 1, chi tiết, tìm kiếm).
// Gộp về 1 hàm để dễ đọc & bảo trì; các nút .edit-btn/.delete-btn giữ data-id
// nên mọi chỗ vẫn gắn sự kiện như cũ.
function renderTxCard(item, stt) {
    const isInc = item.type === 'Thu nhập';
    const tCls = isInc ? 'income' : 'expense';
    const icon = getCategoryIcon(item.category);
    // PERSONAL ROUND 3d (Hùng: chip mọi danh mục đều hồng nhạt giống nhau):
    // chip icon + pill tên danh mục mang màu RIÊNG từng danh mục —
    // nền = màu chuẩn ở 14% alpha, icon/pill chữ = đúng màu chuẩn đó
    // (ROUND 3f: chỉ còn MỘT màu chuẩn duy nhất cho mỗi danh mục).
    // class .cat-tint để CSS đọc qua biến --cat-bg/--cat-fg (cần !important
    // vì .tx-badge.income/.expense của redesign có !important sẵn).
    const catFill = getCategoryColor(item.category), catText = getCategoryTextColor(item.category);
    const tint = ` style="--cat-bg:${catFill}24; --cat-fg:${catText}"`;
    const amtObj = formatCurrencyWithUnit(item.amount);
    return `<div class="tx-icon-wrap ${tCls} cat-tint"${tint}>${icon}</div>`
        + `<div class="tx-body">`
        +   `<div class="tx-title">${escapeHTML(item.content)}</div>`
        +   `<div class="tx-meta-row">`
        +     `<span class="tx-date">${escapeHTML(formatDate(item.date))}</span>`
        +     `<span class="tx-badge tx-badge-neutral">${escapeHTML(item.type)}</span>`
        +     `<span class="tx-badge ${tCls} cat-tint"${tint}>${escapeHTML(item.category)}</span>`
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

// ============================================================================
// (personal-port, theo production fix-round30) Giao diện mới ẩn nút sửa/xóa
// trên từng dòng cho thoáng; tính năng CRUD giữ nguyên 100%: bấm vào thẻ kích
// hoạt đúng handler của nút .edit-btn tương ứng (đã được gán trong các hàm
// render từng vùng: tab1/day list, detail modal, search modal).
// Xóa vẫn có trong form sửa (nút Xóa của editModal).
// ============================================================================
(function initTxCardTapToEdit() {
  document.addEventListener('click', function (e) {
    const card = e.target && e.target.closest ? e.target.closest('.tx-card') : null;
    if (!card) return;
    // Bỏ qua khi bấm đúng vào cụm nút hành động (nếu có) hoặc link bên trong thẻ.
    if (e.target.closest('.tx-actions, .tx-btn, a, button')) return;
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn && typeof editBtn.onclick === 'function') {
      try { editBtn.onclick.call(editBtn, e); } catch (err) {}
    }
  });
})();

function getCompareHTML(current, prev, type, text = 'so với kỳ trước') {
    let zeroObj = formatCurrencyWithUnit(0);
    if (prev === 0 && current === 0) return `<span style="color: var(--text-2); font-weight: 500;">− ${zeroObj.val}${zeroObj.unit} ${escapeHTML(text)}</span>`;
    let diff = current - prev;
    if (diff === 0) return `<span style="color: var(--text-2); font-weight: 500;">− Bằng ${escapeHTML(text)}</span>`;
    let isUp = diff > 0;
    let icon = isUp ? '<i class="fas fa-arrow-up"></i>' : '<i class="fas fa-arrow-down"></i>';
    let arrowText = isUp ? (type === 'balance' ? 'Dư' : 'Tăng') : (type === 'balance' ? 'Âm' : 'Giảm');
    // PERSONAL ROUND 3f (chẩn đoán từ ảnh Hùng khoanh): dòng so sánh trông
    // "xỉn" vì dùng var(--income)/var(--expense) — redesign.css đã định
    // nghĩa lại 2 biến này thành bảng trầm của production (#0B855D xanh sẫm
    // L28% / #D73752 đỏ S67%), LỆCH hẳn hệ SEM tươi của 3d/3e. Nay dùng
    // thẳng hex SEM: chiều tốt = SEM_INC #098D5D (4,22:1), chiều xấu =
    // SEM_EXP #E11D48 (4,70:1) — đạt >= 4,2:1 ở cỡ 10px của .g6-cmpline,
    // opacity luôn 1 (đo thật: không lớp nào giảm opacity). Trường hợp
    // phẳng/0 giữ xám trung tính var(--text-2) như quy ước cũ (không có
    // chiều tăng/giảm để tô màu ngữ nghĩa). Pill hero Tab1 không đổi:
    // redesign ép color #fff !important lên span của #heroExpenseCompare.
    let colorVar = type === 'expense' ? (isUp ? SEM_EXP : SEM_INC) : (isUp ? SEM_INC : SEM_EXP);
    let diffObj = formatCurrencyWithUnit(Math.abs(diff));
    return `<span style="color: ${colorVar}; font-weight: 600;">${icon} ${arrowText} ${diffObj.val}${diffObj.unit} ${escapeHTML(text)}</span>`;
}

window.openTab = function(tabId) {
  triggerHapticSelection();
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
  document.getElementById(tabId).classList.add('active');
  // ROUND 3j: personal-compat.css §24 keys the fullscreen seam fix off
  // this class — mọi đường chuyển tab (nav click, vuốt qua btn.click(),
  // FAB) đều chạy qua openTab nên lớp luôn đồng bộ với .tab-content.active.
  document.body.classList.toggle('hmh-on-tab1', tabId === 'tab1');
  const btn = document.querySelector(`.nav-btn[data-tab="${tabId}"]`);
  if(btn) btn.classList.add('active');
};

// fetchMonthData(month, year, forceRefresh)
// Tải toàn bộ giao dịch của 1 tháng thuộc 1 NĂM cụ thể qua secureFetch,
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
    const data = await secureFetch(`/transactions/${yKey}/month_${mKey}.json`);
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

// ============================================================================
// (personal-port) AVATAR trên thẻ tím Tab1 + CROP EDITOR — port từ production
// (fix-round16/18/19), thích ứng: node đồng bộ /profile/avatar.json (đơn người
// dùng, không phân hoạch users/<chatId>); key localStorage 'hmh_hero_avatar'.
// ============================================================================
// FIX ROUND 16 (19/10/2026): avatar trên thẻ tím (Tab1) + CROP EDITOR (nâng cấp R13).
// - Vòng tròn 46px ở góc trái thẻ tím: mặc định icon người (fa-user), có ảnh
//   thì img phủ kín (object-fit: cover). BỎ HOÀN TOÀN badge ✕ của R13.
// - Bấm avatar: chưa có ảnh -> mở picker chọn ảnh; đã có ảnh -> mở action
//   sheet (Đổi ảnh / Xóa ảnh / Hủy).
// - Sau khi chọn file -> mở CROP EDITOR (modal-sheet): stage vuông
//   min(78vw,320px), vòng tròn guide trắng + vùng ngoài vòng mờ tối, kéo để
//   pan (pointer events: chuột + touch), thanh trượt zoom 1x–3x, ảnh luôn
//   cover vòng tròn (clamp pan). "Lưu ảnh": render vùng tròn về canvas
//   192x192 JPEG 0.85 -> localStorage 'hmh_hero_avatar'. "Hủy": bỏ thay đổi.
// - Toán pan: ảnh vẽ ở scale = baseZoom * zoom (baseZoom = cover-fit);
//   tâm ảnh đặt tại (S/2 + tx, S/2 + ty); cover -> |tx| <= (imgW - S)/2
//   (tương tự ty). Save: góc trái-trên ảnh trong hệ stage = (S/2+tx-imgW/2),
//   vùng vuông nội tiếp = ((0-x0)/sc, (0-y0)/sc, S/sc) trong tọa độ ảnh gốc.
// - Hết quota -> thử 128px/0.8, vẫn lỗi thì giữ ảnh cho phiên hiện tại.
// ============================================================================
(function initHeroAvatar() {
  var KEY = 'hmh_hero_avatar';
  var btn, img, input, ph;
  var sheet, cropModal, cropStage, cropImg, cropZoom, cropSave;
  var savedUrl = null;
  var crop = { imgEl: null, iw: 0, ih: 0, S: 0, zoom: 1, tx: 0, ty: 0 };

  function els() {
    btn = document.getElementById('heroAvatar');
    img = document.getElementById('heroAvatarImg');
    input = document.getElementById('heroAvatarInput');
    ph = btn ? btn.querySelector('.hero-avatar-ph') : null;
    sheet = document.getElementById('avatarSheet');
    cropModal = document.getElementById('avatarCropModal');
    cropStage = document.getElementById('avatarCropStage');
    cropImg = document.getElementById('avatarCropImg');
    cropZoom = document.getElementById('avatarCropZoom');
    cropSave = document.getElementById('avatarCropSave');
    return !!(btn && img && input);
  }

  function render(url) {
    savedUrl = url || null;
    if (url) {
      img.src = url; img.style.display = 'block';
      if (ph) ph.style.display = 'none';
    } else {
      img.removeAttribute('src'); img.style.display = 'none';
      if (ph) ph.style.display = 'flex';
    }
  }

  function store(dataUrl) {
    try { localStorage.setItem(KEY, dataUrl); return true; }
    catch (e) { return false; }
  }

  function overlayShow(on) {
    var ov = document.getElementById('modalOverlay');
    if (ov) ov.classList.toggle('show', !!on);
  }

  /* ---------------- action sheet ---------------- */
  function openAvatarSheet() {
    if (sheet) sheet.classList.add('show');
    overlayShow(true);
  }
  function closeAvatarSheet() {
    if (sheet) sheet.classList.remove('show');
    if (!cropModal || !cropModal.classList.contains('show')) overlayShow(false);
  }
  window.closeAvatarSheet = function () { closeAvatarSheet(); };

  /* ---------------- crop editor ---------------- */
  function coverScale() {
    if (!crop.iw || !crop.ih || !crop.S) return 1;
    return Math.max(crop.S / crop.iw, crop.S / crop.ih);
  }
  function clampPan() {
    var sc = coverScale() * crop.zoom;
    var mx = Math.max(0, (crop.iw * sc - crop.S) / 2);
    var my = Math.max(0, (crop.ih * sc - crop.S) / 2);
    crop.tx = Math.max(-mx, Math.min(mx, crop.tx));
    crop.ty = Math.max(-my, Math.min(my, crop.ty));
  }
  function applyTransform() {
    clampPan();
    var sc = coverScale() * crop.zoom;
    var w = crop.iw * sc, h = crop.ih * sc;
    cropImg.style.width = w + 'px';
    cropImg.style.height = h + 'px';
    // đặt tâm ảnh tại (S/2 + tx, S/2 + ty)
    cropImg.style.transform = 'translate(' + (crop.S / 2 + crop.tx - w / 2) + 'px,' +
      (crop.S / 2 + crop.ty - h / 2) + 'px)';
  }

  function openCrop(dataUrl) {
    closeAvatarSheet();
    var im = new Image();
    im.onload = function () {
      crop.iw = im.naturalWidth || im.width || 0;
      crop.ih = im.naturalHeight || im.height || 0;
      if (!crop.iw || !crop.ih) return;
      crop.S = (cropStage && cropStage.clientWidth) || Math.min(window.innerWidth * 0.78, 320);
      crop.zoom = 1; crop.tx = 0; crop.ty = 0;
      if (cropZoom) cropZoom.value = 1;
      cropImg.src = dataUrl;
      crop.imgEl = im;
      applyTransform();
      if (cropModal) cropModal.classList.add('show');
      overlayShow(true);
    };
    im.src = dataUrl;
  }

  function closeCrop() {
    if (cropModal) cropModal.classList.remove('show');
    overlayShow(false);
  }
  window.closeAvatarCrop = function (/* cancel */) { closeCrop(); };

  function saveCrop() {
    var im = crop.imgEl; if (!im) return;
    var sc = coverScale() * crop.zoom;
    var x0 = crop.S / 2 + crop.tx - (crop.iw * sc) / 2; // góc trái ảnh (px stage)
    var y0 = crop.S / 2 + crop.ty - (crop.ih * sc) / 2; // góc trên ảnh (px stage)
    // vùng vuông nội tiếp vòng tròn -> tọa độ trong ảnh gốc
    var sx = (0 - x0) / sc, sy = (0 - y0) / sc, sw = crop.S / sc;
    var attempts = [{ s: 192, q: 0.85 }, { s: 128, q: 0.8 }];
    for (var i = 0; i < attempts.length; i++) {
      var cv = document.createElement('canvas');
      cv.width = attempts[i].s; cv.height = attempts[i].s;
      var cx = cv.getContext('2d');
      cx.drawImage(im, sx, sy, sw, sw, 0, 0, attempts[i].s, attempts[i].s);
      var u = cv.toDataURL('image/jpeg', attempts[i].q);
      render(u);
      if (store(u)) break; // lưu được -> thoát vòng, đóng editor bên dưới
      // hết quota: vòng sau thử size nhỏ hơn; vòng cuối vẫn lỗi -> giữ ảnh phiên này
    }
    window.closeAvatarCrop(false);
    pushAvatarServer(lastSavedUrl());
  }

  // (personal-port) đồng bộ avatar lên máy chủ — bản cá nhân là đơn người dùng
  // nên node nằm ở /profile/avatar.json (không có phân hoạch users/<chatId>).
  // Dùng đúng kênh secureFetch đã có (/api/secure_firebase).
  // - Lưu local trước rồi mới đẩy lên server (fire-and-forget); không có mạng →
  //   vẫn giữ local, lần mở sau sẽ đẩy lại qua pull.
  // - Xung đột: server thắng khi mở app; khi ghi, lần ghi sau cùng thắng.
  function avatarServerPath() { return '/profile/avatar.json'; }
  function serverSyncOK() {
    return (typeof window.secureFetch === 'function');
  }
  function lastSavedUrl() { return savedUrl; }
  function pushAvatarServer(dataUrl) {
    if (!serverSyncOK()) return;
    try {
      var p = window.secureFetch(avatarServerPath(), 'PUT', { avatar: dataUrl, updatedAt: Date.now() });
      if (p && p.catch) p.catch(function () {});
    } catch (e) {}
  }
  function pullAvatarServer() {
    if (!serverSyncOK()) return;
    try {
      var p = window.secureFetch(avatarServerPath(), 'GET');
      Promise.resolve(p).then(function (obj) {
        if (!obj || typeof obj !== 'object' || !('avatar' in obj)) {
          // migration — server chưa có node avatar, đẩy ảnh local hiện có lên.
          // Chỉ khi node KHÔNG tồn tại; tombstone avatar:null (key có mặt) vẫn đi
          // nhánh dưới để xóa local, tuyệt đối không đẩy lại ở đây.
          var local = null;
          try { local = localStorage.getItem(KEY); } catch (e) {}
          if (local) pushAvatarServer(local);
          return;
        }
        var sv = obj.avatar; // string | null
        var cur = null;
        try { cur = localStorage.getItem(KEY); } catch (e) {}
        if (sv === cur) return;
        if (typeof sv === 'string' && sv) {
          try { localStorage.setItem(KEY, sv); } catch (e) {}
          render(sv);
        } else {
          try { localStorage.removeItem(KEY); } catch (e) {}
          render(null);
        }
      }).catch(function () {});
    } catch (e) {}
  }

  function handleFile(file) {
    if (!file || !/^image\//.test(file.type)) return;
    var reader = new FileReader();
    reader.onload = function () { openCrop(reader.result); };
    reader.readAsDataURL(file);
  }

  function bind() {
    btn.addEventListener('click', function () {
      if (savedUrl) openAvatarSheet();
      else input.click();
    });
    input.addEventListener('change', function () {
      if (input.files && input.files[0]) handleFile(input.files[0]);
      input.value = '';
    });

    var chg = document.getElementById('avatarSheetChange');
    var rem = document.getElementById('avatarSheetRemove');
    var can = document.getElementById('avatarSheetCancel');
    if (chg) chg.addEventListener('click', function () { closeAvatarSheet(); input.click(); });
    if (rem) rem.addEventListener('click', function () {
      try { localStorage.removeItem(KEY); } catch (e) {}
      render(null); closeAvatarSheet();
      pushAvatarServer(null); // R18-3: xóa trên server
    });
    if (can) can.addEventListener('click', closeAvatarSheet);

    // drag pan: pointer events (chuột + touch); stage có touch-action:none
    var dragging = false, lx = 0, ly = 0;
    if (cropStage) {
      cropStage.addEventListener('pointerdown', function (e) {
        dragging = true; lx = e.clientX; ly = e.clientY;
        try { cropStage.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      });
      cropStage.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        crop.tx += (e.clientX - lx); crop.ty += (e.clientY - ly);
        lx = e.clientX; ly = e.clientY;
        applyTransform();
      });
      var endDrag = function () { dragging = false; };
      cropStage.addEventListener('pointerup', endDrag);
      cropStage.addEventListener('pointercancel', endDrag);
    }
    if (cropZoom) cropZoom.addEventListener('input', function () {
      crop.zoom = parseFloat(cropZoom.value) || 1;
      applyTransform();
    });
    if (cropSave) cropSave.addEventListener('click', saveCrop);

    // expose cho test harness
    window.__heroAvatarTest = {
      openCrop: openCrop, saveCrop: saveCrop, crop: crop, key: KEY,
      render: render, handleFile: handleFile,
      getSaved: function () { return savedUrl; },
      openSheet: openAvatarSheet, closeSheet: closeAvatarSheet,
      isSheetOpen: function () { return !!(sheet && sheet.classList.contains('show')); },
      isCropOpen: function () { return !!(cropModal && cropModal.classList.contains('show')); },
      // R18-3: đồng bộ server (cho test harness)
      pushServer: pushAvatarServer, pullServer: pullAvatarServer,
      serverPath: function () { return avatarServerPath(); }
    };
  }

  function start() {
    if (!els()) return;
    var saved = null;
    try { saved = localStorage.getItem(KEY); } catch (e) {}
    render(saved);
    bind();
    pullAvatarServer(); // R18-3: local hiện ngay, server (nếu khác) cập nhật sau
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
