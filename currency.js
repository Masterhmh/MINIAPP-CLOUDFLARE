/*
 * currency.js — Module xử lý & hiển thị tiền tệ (chuẩn quốc tế, locale vi-VN).
 *
 * Nạp NGAY SAU app-core.js trong index.html và là module tiền tệ DUY NHẤT của
 * app. Định nghĩa parseNumber & formatCurrencyWithUnit rồi gán vào window.* để
 * mọi module khác (app-core, app-reports, app-crud...) dùng chung.
 * (script.js cũ chỉ còn là bản backup, KHÔNG được nạp trong index.html.)
 *
 * Đảm nhận:
 *   - parseNumber(value): phân tích chuỗi nhập -> số nguyên VND, trả null nếu sai.
 *   - formatCurrencyWithUnit(value): định dạng hiển thị (đầy đủ / rút gọn).
 *   - Chặn lưu giao dịch khi số tiền không hợp lệ (form Thêm / Sửa).
 */
(function () {
  'use strict';

  // 't' xếp vào nhóm TRIỆU (theo yêu cầu); 'b'/'ty'/'ti' = tỷ.
  var CURRENCY_UNITS = {
    trieu: 1e6, nghin: 1e3, ngan: 1e3,
    tr: 1e6, ng: 1e3, ty: 1e9, ti: 1e9,
    k: 1e3, m: 1e6, t: 1e6, b: 1e9
  };
  var UNIT_PATTERN = 'trieu|nghin|ngan|tr|ng|ty|ti|k|m|t|b';

  // Chỉ chấp nhận: số thuần (50000), số có nhóm (50.000), hoặc số + đơn vị
  // (50k, 1tr5, 2ty...). Mọi định dạng khác -> trả null (không hợp lệ).
  function parseNumber(value) {
    if (value == null) return null;
    var str = value.toString().trim().toLowerCase();
    if (!str) return null;
    str = str.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); // bỏ dấu tiếng Việt
    str = str.replace(/đ|₫|vnd|\s/g, '');                       // bỏ ký hiệu tiền
    if (!str) return null;
    var negative = str.charAt(0) === '-';
    if (negative) str = str.slice(1);
    if (!str) return null;
    var m = str.match(new RegExp('^(\\d+([.,]\\d+)?)(' + UNIT_PATTERN + ')(\\d{0,3})$'));
    if (m) {
      var base = parseFloat(m[1].replace(',', '.'));
      var unit = CURRENCY_UNITS[m[3]];
      var fracDigits = m[4] || '';
      var frac = fracDigits ? parseFloat('0.' + fracDigits) : 0;
      var result = Math.round((base + frac) * unit);
      return negative ? -result : result;
    }
    if (/^\d+$/.test(str) || /^\d{1,3}([.,]\d{3})+$/.test(str)) {
      var n = parseInt(str.replace(/[.,]/g, ''), 10);
      return negative ? -n : n;
    }
    return null;
  }

  // Đầy đủ: 1.250.000 ₫  |  Rút gọn (chuẩn QT, 2 số lẻ): 1,25 M / 125 K / 2 B
  function formatCurrencyWithUnit(value) {
    var format = localStorage.getItem('settingCurrencyFormat') || 'full';
    var num = parseInt(value.toString().replace(/[^0-9-]/g, ''), 10) || 0;
    if (format !== 'short') return { val: num.toLocaleString('vi-VN'), unit: ' ₫' };
    var sign = num < 0 ? '-' : '';
    var abs = Math.abs(num);
    if (abs < 1000) return { val: sign + abs.toString(), unit: ' ₫' };
    var tier;
    if (abs >= 1e9) tier = { div: 1e9, suffix: 'B' };
    else if (abs >= 1e6) tier = { div: 1e6, suffix: 'M' };
    else tier = { div: 1e3, suffix: 'K' };
    var mantissa = Math.round((abs / tier.div) * 100) / 100;
    if (mantissa >= 1000) { // xử lý làm tròn vượt mốc (999.999.999 -> 1 B)
      if (tier.suffix === 'K') tier = { div: 1e6, suffix: 'M' };
      else if (tier.suffix === 'M') tier = { div: 1e9, suffix: 'B' };
      mantissa = Math.round((abs / tier.div) * 100) / 100;
    }
    var valStr = mantissa.toString().replace('.', ',');
    return { val: sign + valStr, unit: ' ' + tier.suffix };
  }

  // Gán vào window.* để mọi module (app-core, app-reports, app-crud...) dùng chung.
  window.parseNumber = parseNumber;
  window.formatCurrencyWithUnit = formatCurrencyWithUnit;

  // Chặn lưu khi số tiền không hợp lệ — capture phase chạy TRƯỚC handler gốc.
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form || (form.id !== 'addForm' && form.id !== 'editForm')) return;
    var input = document.getElementById(form.id === 'addForm' ? 'addAmount' : 'editAmount');
    if (!input) return;
    var parsed = parseNumber(input.value);
    if (parsed === null || parsed <= 0) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (typeof triggerHapticNotification === 'function') triggerHapticNotification('error');
      if (typeof showToast === 'function')
        showToast('Số tiền không hợp lệ! Chỉ nhập số (vd 50000) hoặc dạng K/M/Tỷ (vd 50k, 1tr5, 2ty).', 'error');
      try { input.focus(); } catch (err) {}
    }
  }, true);
})();
