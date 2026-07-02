// ============================================================================
// app-export.js — XUẤT BÁO CÁO PDF & CSV
// ----------------------------------------------------------------------------
// Vai trò: Kết xuất báo cáo tài chính ra PDF (tự dựng bằng html2canvas + jsPDF,
//   có ngắt trang an toàn + lặp header bảng) và xuất dữ liệu giao dịch ra CSV.
//   Đơn vị tiền trong PDF dùng ký hiệu " ₫" (chuẩn quốc tế, có khoảng trắng).
// Phụ thuộc: app-core.js (showToast, triggerHaptic, formatDate*, getColorByIndex,
//   getCategoryIcon...) và app-reports.js (cachedChartData, mChart, pChart).
//   Thư viện ngoài: html2canvas, jsPDF (window.jspdf).
// Thứ tự nạp: sau app-crud.js.
// ============================================================================

// ==========================================
// XUẤT BÁO CÁO PDF (BẢN FIX CHUẨN: TẮT OVERFLOW ĐỂ CHỐNG CẮT XÉN + CHỐNG RỚT DÒNG)
// ==========================================
window.exportToPDF = function() {
    if (isPrivacyActive) {
        return showToast("Số tiền đang bị ẩn! Vui lòng bấm vào biểu tượng con mắt để hiển thị số dư trước khi xuất báo cáo PDF.", "warning");
    }

    const isTab2 = document.getElementById('tab2').classList.contains('active');
    const data = isTab2 ? (cachedChartData?.txs || []) : (cachedTransactions?.data || []);
    
    if (data.length === 0) {
        return showToast("Không có dữ liệu giao dịch để tạo file PDF!", "warning");
    }
    if (typeof html2canvas === 'undefined' || typeof window.jspdf === 'undefined') {
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
    // Để overflow visible để nội dung bung hết cỡ
    element.style.overflow = 'visible'; 
    
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
    const hasIncome = data.some(t => t.type === 'Thu nhập');
    const hasExpense = data.some(t => t.type === 'Chi tiêu');

    // [FIX] STT chạy liên tục xuyên suốt toàn bộ báo cáo (không reset theo từng tháng/nhóm)
    let globalSTT = 0;

    sortedKeys.forEach(key => {
        let monthRows = '';
        let monthInc = 0, monthExp = 0;
        
        groupedData[key].forEach((t) => {
            globalSTT++;
            const isInc = t.type === 'Thu nhập';
            if (isInc) { totalIncome += t.amount; monthInc += t.amount; }
            else { totalExpense += t.amount; monthExp += t.amount; }
            
            const catColor = categoryColorMap[t.category] || (isInc ? '#10B981' : '#64748B');
            const catIconHTML = getCategoryIcon(t.category);
            
            let tdAmountHTML = '';
            
            // [GIẢI QUYẾT LỖI RỚT CHỮ đ] -> Sử dụng white-space: nowrap
            if (hasIncome && hasExpense) {
                tdAmountHTML = `
                    <td style="padding: 12px 6px; font-size: 11px; font-weight: 800; color: #00D26A; text-align: right; white-space: nowrap;">${isInc ? '+' + t.amount.toLocaleString('vi-VN') + ' ₫' : ''}</td>
                    <td style="padding: 12px 14px 12px 6px; font-size: 11px; font-weight: 800; color: #FF4444; text-align: right; white-space: nowrap;">${!isInc ? '-' + t.amount.toLocaleString('vi-VN') + ' ₫' : ''}</td>
                `;
            } else {
                tdAmountHTML = `<td style="padding: 12px 14px 12px 6px; font-size: 11px; font-weight: 800; color: ${isInc ? '#00D26A' : '#FF4444'}; text-align: right; white-space: nowrap;">
                    ${isInc ? '+' : '-'}${t.amount.toLocaleString('vi-VN')} ₫
                </td>`;
            }

            monthRows += `
                <tr style="border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
                    <td style="padding: 12px 6px; font-size: 11px; text-align: center; font-weight: 700;">${globalSTT}</td>
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

        let thAmountHTML = '';
        if (hasIncome && hasExpense) {
            thAmountHTML = `
                <th style="padding: 12px 6px; width: 14%; text-align: right;">Thu nhập</th>
                <th style="padding: 12px 14px 12px 6px; width: 14%; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">Chi tiêu</th>
            `;
        } else {
            // [FIX] Khi chỉ có 1 loại (chỉ thu hoặc chỉ chi), ghi rõ tên loại đó
            // thay vì ghi chung chung "Số tiền"
            const singleColLabel = hasIncome ? 'Thu nhập' : 'Chi tiêu';
            thAmountHTML = `<th style="padding: 12px 14px 12px 6px; width: 28%; text-align: right; border-top-right-radius: 6px; border-bottom-right-radius: 6px;">${singleColLabel}</th>`;
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
                            THU NHẬP: <span style="color: #00D26A; font-weight: 800;">+${monthInc.toLocaleString('vi-VN')} ₫</span> 
                            <span style="margin: 0 6px; color: #CBD5E1;">|</span> 
                            CHI TIÊU: <span style="color: #FF4444; font-weight: 800;">-${monthExp.toLocaleString('vi-VN')} ₫</span>
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
            <div data-pdf-atomic="true" style="margin-top: 20px; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
                <h3 style="font-size: 13px; color: #0891B2; text-transform: uppercase; border-bottom: 1px solid #E2E8F0; padding-bottom: 6px;">1. Biểu đồ Thu & Chi</h3>
                <div style="text-align: center; margin-top: 10px;">
                    <img src="${barChartImg}" style="max-width: 100%; height: auto; max-height: 250px; object-fit: contain; display: block; margin: 0 auto;" />
                </div>
            </div>
            <div data-pdf-atomic="true" style="margin-top: 20px; page-break-inside: avoid; display: flex; align-items: stretch; gap: 20px; width: 100%; box-sizing: border-box;">
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
        <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
        <style>
            * { box-sizing: border-box; font-family: 'Plus Jakarta Sans', sans-serif; }
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
        
        <div data-pdf-atomic="true" style="display: flex; gap: 12px; margin-bottom: 12px; background: #F8FAFC; padding: 14px; border-radius: 10px; border: 1px solid #E2E8F0; page-break-inside: avoid; width: 100%; box-sizing: border-box;">
            <div style="flex: 1; min-width: 0;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Tổng thu nhập</span>
                <div style="font-size: 15px; font-weight: 800; color: #00D26A; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">+${totalIncome.toLocaleString('vi-VN')} ₫</div>
            </div>
            <div style="flex: 1; min-width: 0; border-left: 1px solid #E2E8F0; padding-left: 14px;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Tổng chi tiêu</span>
                <div style="font-size: 15px; font-weight: 800; color: #FF4444; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">-${totalExpense.toLocaleString('vi-VN')} ₫</div>
            </div>
            <div style="flex: 1; min-width: 0; border-left: 1px solid #E2E8F0; padding-left: 14px;">
                <span style="font-size: 10px; color: #64748B; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px;">Số dư thuần</span>
                <div style="font-size: 15px; font-weight: 800; color: ${(totalIncome - totalExpense) >= 0 ? '#00D26A' : '#FF4444'}; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    ${(totalIncome - totalExpense) >= 0 ? '+' : ''}${(totalIncome - totalExpense).toLocaleString('vi-VN')} ₫
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
    
    // Hiển thị bản Preview (Khối code này giữ nguyên)
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
    
    // =====================================
    // HÀM CLICK XUẤT PDF - TỰ DỰNG PDF BẰNG html2canvas + jsPDF TRỰC TIẾP
    // (Không dùng html2pdf().from() nữa vì lớp "overlay" tự động của thư viện
    // này dùng position:fixed + left:-100000px rất dễ bị lệch/cắt nội dung
    // tuỳ trạng thái cuộn trang, đã gây lỗi qua nhiều lần test trước đó)
    // =====================================
    document.getElementById('sharePdfBtn').onclick = async () => {
        triggerHaptic('medium');
        showToast("Đang kết xuất file PDF chuẩn...", "info");

        // Xac dinh nen tang de xu ly tai file phu hop tung moi truong.
        const platform = window.Telegram?.WebApp?.platform || 'unknown';
        const platformLower = platform.toLowerCase();
        const isMobile = ['android', 'android_x', 'ios'].includes(platformLower);
        const isWeb = ['weba', 'webk', 'web'].includes(platformLower);

        // Đợi một chút để Font Google và CSS tải hoàn thiện
        await new Promise(resolve => setTimeout(resolve, 400));

        // Gắn element vào DOM bằng position:fixed (neo theo viewport, KHÔNG
        // phụ thuộc vào vị trí cuộn của trang hay overflow của body/html).
        element.style.position = 'fixed';
        element.style.top = '0';
        element.style.left = '0';
        element.style.margin = '0';
        element.style.zIndex = '-1';
        document.body.appendChild(element);

        try {
            // [FIX] ĐO TRƯỚC VỊ TRÍ CÁC PHẦN TỪ "KHÔNG ĐƯỢC CẮT NGANG"
            const containerRect = element.getBoundingClientRect();
            const elementHeightPx = element.offsetHeight;

            const breakCandidatesPx = [];
            element.querySelectorAll('table.pdf-table tbody tr').forEach(tr => {
                breakCandidatesPx.push(tr.getBoundingClientRect().bottom - containerRect.top);
            });
            element.querySelectorAll('[data-pdf-atomic]').forEach(el => {
                breakCandidatesPx.push(el.getBoundingClientRect().bottom - containerRect.top);
            });

            const sampleThead = element.querySelector('table.pdf-table thead');
            let theadTopPxCss = null, theadHeightPxCss = 0;
            if (sampleThead) {
                const r = sampleThead.getBoundingClientRect();
                theadTopPxCss = r.top - containerRect.top;
                theadHeightPxCss = r.height;
            }

            const tableRangesPxCss = [];
            element.querySelectorAll('table.pdf-table').forEach(tbl => {
                const r = tbl.getBoundingClientRect();
                tableRangesPxCss.push({ top: r.top - containerRect.top, bottom: r.bottom - containerRect.top });
            });

            const canvas = await html2canvas(element, {
                scale: 2,
                useCORS: true,
                letterRendering: true,
                backgroundColor: '#FFFFFF'
            });

            if (document.body.contains(element)) document.body.removeChild(element);

            const { jsPDF } = window.jspdf;
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

            const margin = 10; // mm
            const pageWidth = pdf.internal.pageSize.getWidth();
            const pageHeight = pdf.internal.pageSize.getHeight();
            const contentWidthMM = pageWidth - margin * 2;
            const contentHeightMM = pageHeight - margin * 2;

            const imgWidthMM = contentWidthMM;
            const imgHeightMM = (canvas.height * imgWidthMM) / canvas.width;
            const pxPerMm = canvas.height / imgHeightMM;
            const pxScale = canvas.height / elementHeightPx;

            let breakPointsPx = breakCandidatesPx
                .map(v => v * pxScale)
                .concat([canvas.height])
                .map(v => Math.round(v));
            breakPointsPx = [...new Set(breakPointsPx)].sort((a, b) => a - b);

            const headerHeightPx = theadHeightPxCss * pxScale;
            const headerHeightMM = headerHeightPx / pxPerMm;
            const theadTopPx = theadTopPxCss !== null ? theadTopPxCss * pxScale : 0;

            const tableRangesPx = tableRangesPxCss.map(t => ({
                top: t.top * pxScale,
                bottom: t.bottom * pxScale
            }));

            const contentHeightPx = contentHeightMM * pxPerMm;

            function cropSlice(sy, sh) {
                sy = Math.max(0, Math.round(sy));
                sh = Math.max(1, Math.round(sh));
                const sub = document.createElement('canvas');
                sub.width = canvas.width;
                sub.height = sh;
                const ctx = sub.getContext('2d');
                ctx.fillStyle = '#FFFFFF';
                ctx.fillRect(0, 0, sub.width, sub.height);
                ctx.drawImage(canvas, 0, sy, canvas.width, sh, 0, 0, canvas.width, sh);
                return sub.toDataURL('image/jpeg', 1.0);
            }

            let currentTopPx = 0;
            let firstPage = true;

            while (currentTopPx < canvas.height - 1) {
                if (!firstPage) pdf.addPage();
                firstPage = false;

                const continuingTable = tableRangesPx.find(t => t.top < currentTopPx - 1 && t.bottom > currentTopPx + 1);
                const needsHeaderRepeat = !!continuingTable && headerHeightPx > 0;

                const availablePx = needsHeaderRepeat ? (contentHeightPx - headerHeightPx) : contentHeightPx;
                const idealBottomPx = currentTopPx + availablePx;

                let sliceBottomPx;
                if (idealBottomPx >= canvas.height - 1) {
                    sliceBottomPx = canvas.height;
                } else {
                    const validBreaks = breakPointsPx.filter(p => p > currentTopPx + 1 && p <= idealBottomPx);
                    sliceBottomPx = validBreaks.length > 0 ? validBreaks[validBreaks.length - 1] : Math.round(idealBottomPx);
                }

                let yMM = margin;
                if (needsHeaderRepeat) {
                    const headerImg = cropSlice(theadTopPx, headerHeightPx);
                    pdf.addImage(headerImg, 'JPEG', margin, yMM, imgWidthMM, headerHeightMM);
                    yMM += headerHeightMM;
                }

                const sliceHeightPx = sliceBottomPx - currentTopPx;
                const sliceHeightMM = sliceHeightPx / pxPerMm;
                const contentImg = cropSlice(currentTopPx, sliceHeightPx);
                pdf.addImage(contentImg, 'JPEG', margin, yMM, imgWidthMM, sliceHeightMM);

                currentTopPx = sliceBottomPx;
            }

            const blob = pdf.output('blob');

            triggerHapticNotification('success');
            const file = new File([blob], fileName, { type: 'application/pdf' });
            const pdfUrl = URL.createObjectURL(blob);

            if (isMobile && navigator.canShare && navigator.canShare({ files: [file] })) {
                try {
                    await navigator.share({ files: [file], title: fileName });
                    triggerHapticNotification('success');
                } catch (error) {}
                URL.revokeObjectURL(pdfUrl);
            } else if (isWeb) {
                // TELEGRAM WEB: mini app nam trong <iframe> sandbox KHONG co
                // 'allow-downloads' (chan <a download>), va mo tab moi thi hay bi
                // tien ich chan quang cao chan (ERR_BLOCKED_BY_CLIENT). Giai phap
                // an toan nhat: nhung file PDF vao KHUNG XEM TRUOC ngay trong app
                // bang 1 <iframe> noi bo, roi de nguoi dung dung thanh cong cu cua
                // trinh xem PDF (nut tai / in) de luu ve may. Khong mo tab, khong
                // download tu dong nen khong bi chan.
                try { window.removeEventListener('resize', adjustPreviewSize); } catch (e) {}
                const pc = document.getElementById('pdfPreviewContainer');
                if (pc) {
                    pc.innerHTML = '';
                    pc.style.overflow = 'auto';
                    const note = document.createElement('div');
                    note.style.cssText = 'padding:10px 12px;font-size:12px;line-height:1.5;color:#334155;background:#F1F5F9;border:1px solid #E2E8F0;border-radius:10px;margin-bottom:10px';
                    note.innerHTML = '<b>Đã tạo xong PDF.</b><br>Dùng nút tải (⬇) hoặc in trên thanh công cụ của trình xem bên dưới để lưu về máy. Nếu nút tải bị chặn, nhấn <b>Ctrl+P</b> rồi chọn “Lưu dưới dạng PDF”.';
                    pc.appendChild(note);
                    const frame = document.createElement('iframe');
                    frame.src = pdfUrl;
                    frame.title = fileName;
                    frame.style.cssText = 'width:100%;height:72vh;min-height:420px;border:none;border-radius:10px;background:#fff;box-shadow:0 2px 10px rgba(0,0,0,0.12)';
                    pc.appendChild(frame);
                }
                showToast("Đã tạo PDF! Xem ngay bên dưới và dùng nút tải của trình xem để lưu.", "success");
                setTimeout(() => URL.revokeObjectURL(pdfUrl), 300000);
            } else {
                // Máy tính (Telegram Desktop / trình duyệt thường): tải thẳng xuống Downloads.
                const a = document.createElement('a');
                a.href = pdfUrl;
                a.download = fileName;
                a.rel = 'noopener';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                setTimeout(() => { if (a.parentNode) a.parentNode.removeChild(a); URL.revokeObjectURL(pdfUrl); }, 10000);
                showToast("Đã xuất PDF! File được lưu trong thư mục Tải xuống (Downloads) của thiết bị.", "success");
            }
        } catch (err) {
            if (document.body.contains(element)) document.body.removeChild(element);
            showToast("Lỗi tạo PDF: " + err.message, "error");
        }
    };
};
window.exportToCSV = async function() {
    if (isPrivacyActive) {
        return showToast("Số tiền đang bị ẩn! Vui lòng bấm vào biểu tượng con mắt để hiển thị số dư trước khi xuất dữ liệu CSV.", "warning");
    }

    const isTab2 = document.getElementById('tab2').classList.contains('active'); const dataToExport = isTab2 ? (cachedChartData?.txs || []) : (cachedTransactions?.data || []);
    if (dataToExport.length === 0) return showToast("Không có dữ liệu giao dịch để xuất!", "warning");
    triggerHaptic('light'); let csvContent = "\uFEFFMã GD,Ngày,Phân loại,Danh mục,Số tiền,Nội dung,Ghi chú\n";
    dataToExport.forEach(t => { let content = t.content ? t.content.replace(/,/g, " ") : ""; let note = t.note ? t.note.replace(/,/g, " ") : ""; csvContent += `${t.id},${t.date},${t.type},${t.category},${t.amount},${content},${note}\n`; });
    const reportName = isTab2 ? (cachedChartData?.periodStr || "Bao_Cao") : formatDateToYYYYMMDD(new Date()); const fileName = `Giao_Dich_${reportName}.csv`; const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
    const platform = window.Telegram?.WebApp?.platform || 'unknown'; const isMobile = ['android', 'android_x', 'ios'].includes(platform.toLowerCase());
    if (isMobile && navigator.canShare) { try { const file = new File([blob], fileName, { type: 'text/csv' }); if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: fileName }); triggerHapticNotification('success'); return; } } catch (error) {} } 
    const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = fileName; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 10000); triggerHapticNotification('success'); showToast("Đã tải file CSV!", "success");
};
