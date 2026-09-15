// ==UserScript==
// @name         Auto KSK TD
// @namespace    medinet-autofill-m3-m4
// @version      7.77
// @description  Tự Động Điền KSK TD
// @match        https://quanlyskcd.medinet.org.vn/*
// @grant        none
// @run-at       document-idle
// @noframes
// ==/UserScript==

(function () {
    'use strict';

    // =========================================================
    // CẤU HÌNH
    // =========================================================

    const LOG = '[MEDINET AUTO]';

    // M4 hiện đang dùng logic 22 câu giống M3
    const M4_HISTORY_COUNT = 22;

    // Delay rất ngắn để Angular / DevExtreme kịp xử lý
    const FAST_DELAY = 20;


    // =========================================================
    // HÀM CƠ BẢN
    // =========================================================

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    function norm(text) {
        return (text || '')
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
    }

    function log(...args) {
        console.log(LOG, ...args);
    }

    function warn(...args) {
        console.warn(LOG, ...args);
    }


    // =========================================================
    // CLICK NHANH
    //
    // QUAN TRỌNG:
    // KHÔNG scrollIntoView()
    // KHÔNG mousedown
    // KHÔNG mouseup
    //
    // Chỉ click trực tiếp.
    // =========================================================

    function fastClick(el) {

        if (!el) {
            return false;
        }

        try {

            el.click();

            return true;

        } catch (e) {

            warn(
                'Lỗi click:',
                e
            );

            return false;
        }
    }


    // =========================================================
    // TÌM RADIO "KHÔNG"
    // =========================================================

    function isRadioKhong(el) {

        if (!el) {
            return false;
        }

        const content =
            el.querySelector(
                '.dx-item-content'
            );

        if (!content) {
            return false;
        }

        return (
            norm(
                content.textContent
            ) === 'không'
        );
    }


    // =========================================================
    // TÌM CÂU HỎI
    // =========================================================

    function findQuestion(questionText) {

        const target =
            norm(questionText);

        const all = [
            ...document.querySelectorAll(
                'div, span, p, label, b'
            )
        ];

        const matches =
            all.filter(el => {

                const text =
                    norm(el.innerText);

                return (
                    text.includes(target) &&
                    text.length < 500
                );
            });

        if (!matches.length) {
            return null;
        }

        matches.sort(
            (a, b) =>
                norm(a.innerText).length -
                norm(b.innerText).length
        );

        return matches[0];
    }


    // =========================================================
    // TÌM RADIO KHÔNG THEO CÂU HỎI
    // =========================================================

    function findRadioKhong(questionText) {

        const question =
            findQuestion(
                questionText
            );

        if (!question) {

            warn(
                'Không tìm thấy câu hỏi:',
                questionText
            );

            return null;
        }

        let current =
            question;

        // Leo tối đa 12 cấp DOM
        for (
            let level = 0;
            level < 12;
            level++
        ) {

            if (!current) {
                break;
            }

            const radios = [
                ...current.querySelectorAll(
                    '.dx-item.dx-radiobutton'
                )
            ];

            const radio =
                radios.find(
                    isRadioKhong
                );

            if (radio) {
                return radio;
            }

            current =
                current.parentElement;
        }

        warn(
            'Không tìm thấy radio Không:',
            questionText
        );

        return null;
    }


    // =========================================================
    // CHỌN RADIO KHÔNG - FAST
    // =========================================================

    async function selectKhongFast(
        questionText
    ) {

        log(
            'Đang xử lý:',
            questionText
        );

        const radio =
            findRadioKhong(
                questionText
            );

        if (!radio) {
            return false;
        }

        const checked =
            radio.getAttribute(
                'aria-checked'
            );

        if (
            checked === 'true'
        ) {

            log(
                'Đã chọn Không:',
                questionText
            );

            return true;
        }

        fastClick(
            radio
        );

        await sleep(
            FAST_DELAY
        );

        log(
            '✓ Đã chọn Không:',
            questionText
        );

        return true;
    }


    // =========================================================
    // TIỆN ÍCH DÙNG CHUNG: CHỌN TẤT CẢ RADIO CÓ TEXT CHO TRƯỚC
    // (áp dụng khi 1 đáp án lặp lại ở nhiều dòng/bảng, không
    // cần xác định câu hỏi theo mã - giống cách autoM3LoaiITatCa
    // đã làm với "Loại I")
    // =========================================================

    function findAllRadiosByText(answerText) {

        const answerNorm =
            norm(answerText);


        // -----------------------------------------------------
        // CÁCH 1: tìm theo class chuẩn
        // .dx-item.dx-radiobutton[role="radio"]
        // -----------------------------------------------------

        const strictRadios = [
            ...document.querySelectorAll(
                '.dx-item.dx-radiobutton[role="radio"]'
            )
        ].filter(
            r => {

                const content =
                    r.querySelector(
                        '.dx-item-content'
                    );

                if (!content) {
                    return false;
                }

                return (
                    norm(content.textContent) ===
                    answerNorm
                );
            }
        );

        if (
            strictRadios.length
        ) {

            return strictRadios;
        }


        // -----------------------------------------------------
        // CÁCH 2 (dự phòng): tìm theo nội dung .dx-item-content
        // TRƯỚC, rồi leo lên tìm phần tử cha là radio - phòng
        // khi cấu trúc lồng (VD trong dx-radiogroup) khác đôi
        // chút so với dx-radiobutton đơn lẻ
        // -----------------------------------------------------

        const contents = [
            ...document.querySelectorAll(
                '.dx-item-content'
            )
        ].filter(
            c =>
                norm(c.textContent) ===
                answerNorm
        );

        const fallbackRadios =
            [];

        const seen =
            new Set();

        for (
            const content of contents
        ) {

            const radio =
                content.closest(
                    '[role="radio"]'
                ) ||
                content.closest(
                    '.dx-radiobutton'
                ) ||
                content.closest(
                    '.dx-item'
                );

            if (
                radio &&
                !seen.has(radio)
            ) {

                seen.add(
                    radio
                );

                fallbackRadios.push(
                    radio
                );
            }
        }

        if (
            fallbackRadios.length
        ) {

            log(
                `(dùng cách dự phòng, tìm thấy ${fallbackRadios.length} theo nội dung text)`
            );
        }

        return fallbackRadios;
    }


    // Log chẩn đoán: đếm tổng số widget/radio trên trang, giúp
    // phân biệt "trang chưa render xong" với "sai text/selector"
    function debugCountRadioWidgets() {

        const radioGroups =
            document.querySelectorAll(
                '.dx-radiogroup'
            ).length;

        const radioItems =
            document.querySelectorAll(
                '.dx-item.dx-radiobutton'
            ).length;

        const contents =
            document.querySelectorAll(
                '.dx-item-content'
            ).length;

        log(
            `Chẩn đoán trang: ${radioGroups} dx-radiogroup, ` +
            `${radioItems} dx-radiobutton, ` +
            `${contents} dx-item-content`
        );
    }


    async function autoSelectAllRadioByText(
        answerText,
        label
    ) {

        log(
            `Tìm tất cả radio "${answerText}"` +
            (label ? ` (${label})` : '') +
            '...'
        );

        const radios =
            findAllRadiosByText(
                answerText
            );

        log(
            'Tìm thấy',
            radios.length,
            `radio "${answerText}"`
        );

        if (
            !radios.length
        ) {

            warn(
                `Không tìm thấy radio "${answerText}" nào`
            );

            debugCountRadioWidgets();

            return {
                found: 0,
                count: 0,
                skipped: 0
            };
        }

        let count = 0;
        let skipped = 0;

        for (
            const radio of radios
        ) {

            const checked =
                radio.getAttribute(
                    'aria-checked'
                ) === 'true';

            if (checked) {

                skipped++;

                continue;
            }

            // CLICK ĐẦY ĐỦ CHUỖI SỰ KIỆN
            // (dx-radiobutton cần pointerdown/pointerup
            // để cập nhật đúng state nội bộ)
            // KHÔNG SCROLL

            robustClick(
                radio
            );

            count++;

            await sleep(
                FAST_DELAY + 30
            );

            log(
                `✓ Đã chọn "${answerText}" (${count})`
            );
        }

        log(
            `✓ Hoàn tất "${answerText}": tổng ${radios.length}, đã chọn ${count}, đã sẵn ${skipped}`
        );

        return {
            found: radios.length,
            count,
            skipped
        };
    }


    // =========================================================
    // =========================================================
    //                     M2
    // =========================================================
    // =========================================================


    // =========================================================
    // M2 - TIỀN SỬ BỆNH NHÂN DƯỚI 18 TUỔI
    //
    // Trang này gồm: tiền sử bệnh gia đình + bản thân (chọn
    // "Không") và bảng Tiêm chủng (chọn "Không nhớ rõ") - tất
    // cả nằm chung 1 trang/route, h2 không đổi theo mục sidebar.
    // =========================================================

    async function autoM2TienSuDuoi18() {

        log(
            '================================'
        );

        log(
            '🚀 M2 - AUTO TIỀN SỬ BỆNH NHÂN DƯỚI 18 TUỔI'
        );

        log(
            '================================'
        );

        // -----------------------------------------------------
        // 1. Chọn "Không" cho các câu hỏi dạng radio thường
        // (Tiền sử bệnh gia đình, tiền sử bản thân, v.v.)
        // -----------------------------------------------------

        const khongResult =
            await autoSelectAllRadioByText(
                'không',
                'Tiền sử bệnh <18 tuổi'
            );


        // -----------------------------------------------------
        // 2. Chọn "Không nhớ rõ" cho bảng Tiêm chủng
        // (nằm chung trang này, không phải tab riêng)
        // -----------------------------------------------------

        const tiemChungResult =
            await autoSelectAllRadioByText(
                'không nhớ rõ',
                'Tiêm chủng'
            );


        autoAlert(
            '✅ M2 - Đã Auto Fill Tiền sử bệnh nhân dưới 18 tuổi!\n\n' +
            '— Các câu Không —\n' +
            `✓ Tổng tìm thấy: ${khongResult.found}\n` +
            `✓ Đã chọn: ${khongResult.count}\n` +
            `✓ Đã sẵn có: ${khongResult.skipped}\n\n` +
            '— Tiêm chủng (Không nhớ rõ) —\n' +
            `✓ Tổng tìm thấy: ${tiemChungResult.found}\n` +
            `✓ Đã chọn: ${tiemChungResult.count}\n` +
            `✓ Đã sẵn có: ${tiemChungResult.skipped}\n\n` +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
    // M2 - ĐÁNH GIÁ SỨC KHỎE TÂM THẦN
    //
    // Chọn "Không có" cho tất cả câu hỏi sàng lọc (18 câu -
    // Giảm chú ý/tăng động). Dùng chung cơ chế quét toàn trang
    // theo text, không cần biết số câu chính xác.
    // =========================================================

    async function autoM2DanhGiaTamThan() {

        log(
            '================================'
        );

        log(
            '🚀 M2 - AUTO ĐÁNH GIÁ SỨC KHỎE TÂM THẦN'
        );

        log(
            '================================'
        );

        // Tab con "Phổ tự kỷ" và "Giảm chú ý - tăng động" dùng
        // 2 bộ đáp án khác nhau. Vì tab không active thường
        // không render nội dung trong DOM, chỉ cần kiểm tra
        // trang hiện có đáp án nào để biết đang ở tab nào,
        // không cần dò theo tab active/CSS.
        const bodyTextTamThan =
            norm(
                document.body.innerText
            );

        let result;
        let subTabLabel;

        if (
            bodyTextTamThan.includes(
                'hoàn toàn không đồng ý'
            )
        ) {

            subTabLabel =
                'Phổ tự kỷ';

            result =
                await autoSelectAllRadioByText(
                    'hoàn toàn không đồng ý',
                    subTabLabel
                );

        } else {

            subTabLabel =
                'Giảm chú ý - tăng động';

            result =
                await autoSelectAllRadioByText(
                    'không có',
                    subTabLabel
                );
        }

        autoAlert(
            `✅ M2 - Đã Auto Fill Đánh giá tâm thần (${subTabLabel})!\n\n` +
            `✓ Tổng tìm thấy: ${result.found}\n` +
            `✓ Đã chọn: ${result.count}\n` +
            `✓ Đã sẵn có: ${result.skipped}\n\n` +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
// M2 - TÌM VÀ CHỌN TẤT CẢ "LOẠI I"
// =========================================================
//
// SỬA LỖI:
// - Không dùng el.children.length <= 1
// - Không lấy danh sách Loại I chỉ 1 lần
// - Sau khi click "Chưa phát hiện bất thường", DOM có thể
//   render lại / Angular cập nhật lại component
// - Vì vậy phải QUÉT LẠI DOM nhiều vòng
// - Mỗi vòng chỉ click những ô Loại I chưa được chọn
// - Sau cùng VERIFY lại nhiều lần
//
// Giữ nguyên logic M2:
// 1. Chưa phát hiện bất thường
// 2. Chọn tất cả Loại I
//
// KHÔNG SCROLL
// =========================================================


// =========================================================
// TÌM TẤT CẢ PHẦN TỬ TEXT "LOẠI I"
// =========================================================

function findAllM2LoaiITextElements() {

    const result = [];

    const all =
        document.querySelectorAll('*');

    for (const el of all) {

        const text =
            norm(el.textContent);

        if (text !== 'loại i') {
            continue;
        }

        // Không dùng children.length <= 1 nữa
        // vì có thể loại nhầm những cấu trúc DOM hợp lệ
        result.push(el);
    }

    return result;
}


// =========================================================
// TÌM CHECKBOX / RADIO CHA CỦA "LOẠI I"
// =========================================================
//
// Ưu tiên:
// 1. checkbox
// 2. radio
//
// Vì M2 có thể có cấu trúc khác nhau tùy khu vực render.
// =========================================================

function findM2LoaiIControl(textElement) {

    if (!textElement) {
        return null;
    }

    let current =
        textElement;

    // Leo tối đa 15 cấp DOM
    for (
        let level = 0;
        level < 15;
        level++
    ) {

        if (!current) {
            break;
        }


        // -------------------------------------------------
        // CÁCH 1: Tìm checkbox DevExtreme
        // -------------------------------------------------

        const checkbox =
            current.querySelector(
                '.dx-checkbox'
            );

        if (checkbox) {

            return {
                element: checkbox,
                type: 'checkbox'
            };
        }


        // -------------------------------------------------
        // CÁCH 2: Tìm radio DevExtreme
        // -------------------------------------------------

        const radio =
            current.querySelector(
                '.dx-radiobutton'
            ) ||
            current.querySelector(
                '[role="radio"]'
            );

        if (radio) {

            return {
                element: radio,
                type: 'radio'
            };
        }


        // -------------------------------------------------
        // Leo lên cha tiếp theo
        // -------------------------------------------------

        current =
            current.parentElement;
    }


    return null;
}


// =========================================================
// KIỂM TRA CONTROL ĐÃ ĐƯỢC CHỌN CHƯA
// =========================================================

function isM2LoaiISelected(control) {

    if (!control) {
        return false;
    }


    // -----------------------------------------------------
    // Checkbox
    // -----------------------------------------------------

    if (
        control.classList.contains(
            'dx-checkbox-checked'
        )
    ) {

        return true;
    }


    // -----------------------------------------------------
    // aria-checked
    // -----------------------------------------------------

    if (
        control.getAttribute(
            'aria-checked'
        ) === 'true'
    ) {

        return true;
    }


    // -----------------------------------------------------
    // Radio selected
    // -----------------------------------------------------

    if (
        control.classList.contains(
            'dx-radiobutton-checked'
        )
    ) {

        return true;
    }


    // -----------------------------------------------------
    // Một số DevExtreme dùng class selected
    // -----------------------------------------------------

    if (
        control.classList.contains(
            'dx-item-selected'
        )
    ) {

        return true;
    }


    return false;
}


// =========================================================
// CLICK M2 LOẠI I
// =========================================================
//
// Thử click control trước.
// Nếu trạng thái không thay đổi, thử click text.
// Mục tiêu là xử lý cả checkbox và radio.
//
// KHÔNG SCROLL
// =========================================================

async function clickM2LoaiI(
    textElement,
    control
) {

    if (!control) {
        return false;
    }


    if (
        isM2LoaiISelected(
            control
        )
    ) {

        return false;
    }


    // -----------------------------------------------------
    // Lưu trạng thái trước click
    // -----------------------------------------------------

    const before =
        isM2LoaiISelected(
            control
        );


    // -----------------------------------------------------
    // Cách 1: click control
    // -----------------------------------------------------

    fastClick(
        control
    );


    await sleep(
        FAST_DELAY + 40
    );


    // -----------------------------------------------------
    // Kiểm tra lại
    // -----------------------------------------------------

    let after =
        isM2LoaiISelected(
            control
        );


    if (
        !before &&
        after
    ) {

        return true;
    }


    // -----------------------------------------------------
    // Cách 2:
    // Click phần tử chứa text "Loại I"
    //
    // Một số component DevExtreme bắt sự kiện ở item cha
    // thay vì icon checkbox/radio.
    // -----------------------------------------------------

    if (
        !after &&
        textElement
    ) {

        fastClick(
            textElement
        );


        await sleep(
            FAST_DELAY + 40
        );


        after =
            isM2LoaiISelected(
                control
            );

        if (
            !before &&
            after
        ) {

            return true;
        }
    }


    // -----------------------------------------------------
    // Cách 3:
    // Click container gần nhất
    // -----------------------------------------------------

    if (
        !after
    ) {

        const container =
            control.closest(
                '[role="checkbox"]'
            ) ||
            control.closest(
                '[role="radio"]'
            ) ||
            control.closest(
                '.dx-item'
            );


        if (
            container &&
            container !== control
        ) {

            fastClick(
                container
            );


            await sleep(
                FAST_DELAY + 40
            );


            after =
                isM2LoaiISelected(
                    control
                );
        }
    }


    return (
        !before &&
        after
    );
}


// =========================================================
// M2 - QUÉT 1 VÒNG LOẠI I
// =========================================================
//
// Quan trọng:
// Hàm này mỗi lần chạy sẽ tìm lại DOM từ đầu.
//
// Không dùng danh sách cũ.
// =========================================================

async function scanAndSelectM2LoaiI() {

    const textElements =
        findAllM2LoaiITextElements();


    log(
        '🔍 M2: Quét lại DOM - tìm thấy',
        textElements.length,
        'text "Loại I"'
    );


    const seenControls =
        new Set();


    let found = 0;
    let selected = 0;
    let skipped = 0;
    let failed = 0;


    for (
        const textElement of textElements
    ) {

        const controlInfo =
            findM2LoaiIControl(
                textElement
            );


        if (!controlInfo) {
            continue;
        }


        const control =
            controlInfo.element;


        // Tránh trùng cùng một control
        if (
            seenControls.has(
                control
            )
        ) {

            continue;
        }


        seenControls.add(
            control
        );

        found++;


        // -------------------------------------------------
        // Đã chọn rồi
        // -------------------------------------------------

        if (
            isM2LoaiISelected(
                control
            )
        ) {

            skipped++;

            continue;
        }


        // -------------------------------------------------
        // Chưa chọn -> click
        // -------------------------------------------------

        const clicked =
            await clickM2LoaiI(
                textElement,
                control
            );


        if (clicked) {

            selected++;

            log(
                `✓ M2: Đã chọn Loại I #${selected}`
            );

        } else {

            failed++;

            warn(
                '⚠️ M2: Click Loại I nhưng trạng thái chưa đổi'
            );
        }


        // -------------------------------------------------
        // Rất quan trọng:
        // DOM có thể bị Angular/DevExtreme render lại
        // sau mỗi click.
        //
        // Không giữ reference cũ để click tiếp.
        // Vòng scan tiếp theo sẽ lấy DOM mới.
        // -------------------------------------------------

        await sleep(
            FAST_DELAY + 50
        );
    }


    return {
        found,
        selected,
        skipped,
        failed
    };
}


// =========================================================
// M2 - VERIFY LẠI LOẠI I
// =========================================================
//
// Đây là phần quan trọng nhất để sửa lỗi:
//
// M2 click lần đầu -> một số ô chưa điền
// M3 click -> lại điền được
//
// Nguyên nhân có thể do DOM thay đổi sau khi click.
//
// Vì vậy M2 sẽ quét lại nhiều lần.
//
// Nếu còn ô chưa chọn -> tiếp tục click.
// Nếu không còn ô mới -> dừng.
// =========================================================

async function verifyM2LoaiI() {

    log(
        '🔄 M2: Bắt đầu VERIFY Loại I...'
    );


    let totalSelected = 0;
    let totalSkipped = 0;
    let totalFailed = 0;

    // Tối đa 8 vòng
    // Không ảnh hưởng nhiều đến tốc độ vì nếu hoàn tất
    // thì vòng sau sẽ dừng ngay.
    const MAX_ROUNDS = 8;


    for (
        let round = 1;
        round <= MAX_ROUNDS;
        round++
    ) {

        log(
            `🔄 M2 VERIFY vòng ${round}/${MAX_ROUNDS}`
        );


        const result =
            await scanAndSelectM2LoaiI();


        totalSelected +=
            result.selected;


        totalSkipped +=
            result.skipped;


        totalFailed +=
            result.failed;


        log(
            `M2 vòng ${round}: ` +
            `found=${result.found}, ` +
            `selected=${result.selected}, ` +
            `skipped=${result.skipped}, ` +
            `failed=${result.failed}`
        );


        // -------------------------------------------------
        // Không còn click mới
        //
        // Nghĩa là:
        // - Các ô đã chọn hết
        // hoặc
        // - Không còn control nào mới để click
        //
        // Dừng.
        // -------------------------------------------------

        if (
            result.selected === 0
        ) {

            log(
                '✅ M2: Không còn Loại I chưa chọn.'
            );

            break;
        }


        // -------------------------------------------------
        // Chờ Angular render lại DOM
        // -------------------------------------------------

        await sleep(
            150
        );
    }


    // =====================================================
    // FINAL VERIFY
    // =====================================================

    await sleep(
        300
    );


    const finalTexts =
        findAllM2LoaiITextElements();


    const finalControls =
        new Set();


    let finalFound = 0;
    let finalChecked = 0;
    let finalUnchecked = 0;


    for (
        const textElement of finalTexts
    ) {

        const info =
            findM2LoaiIControl(
                textElement
            );


        if (!info) {
            continue;
        }


        const control =
            info.element;


        if (
            finalControls.has(
                control
            )
        ) {

            continue;
        }


        finalControls.add(
            control
        );


        finalFound++;


        if (
            isM2LoaiISelected(
                control
            )
        ) {

            finalChecked++;

        } else {

            finalUnchecked++;
        }
    }


    log(
        '================================'
    );

    log(
        'M2 FINAL VERIFY Loại I'
    );

    log(
        'Tổng tìm thấy:',
        finalFound
    );

    log(
        'Đã chọn:',
        finalChecked
    );

    log(
        'Chưa chọn:',
        finalUnchecked
    );

    log(
        '================================'
    );


    return {
        totalFound: finalFound,
        checked: finalChecked,
        unchecked: finalUnchecked,
        totalSelected,
        totalSkipped,
        totalFailed
    };
}


// =========================================================
// M2 - LOẠI I
// =========================================================

async function autoM2LoaiICheckbox() {

    log(
        '================================'
    );

    log(
        '🚀 M2 - AUTO CHỌN TẤT CẢ LOẠI I'
    );

    log(
        '================================'
    );


    // -----------------------------------------------------
    // Chờ DOM ổn định trước khi quét
    // -----------------------------------------------------

    await sleep(
        150
    );


    // -----------------------------------------------------
    // Quét + click + VERIFY nhiều vòng
    // -----------------------------------------------------

    const result =
        await verifyM2LoaiI();


    // -----------------------------------------------------
    // Cảnh báo nếu vẫn còn ô chưa chọn
    // -----------------------------------------------------

    if (
        result.unchecked > 0
    ) {

        warn(
            `⚠️ M2 vẫn còn ${result.unchecked} Loại I chưa được chọn.`
        );

    } else {

        log(
            '✅ M2: TẤT CẢ Loại I đã được chọn.'
        );
    }


    return {
        found:
            result.totalFound,

        count:
            result.checked,

        skipped:
            result.totalSkipped,

        unchecked:
            result.unchecked,

        failed:
            result.totalFailed
    };
}


// =========================================================
// M2 - KHÁM LÂM SÀNG
// =========================================================
//
// GIỮ NGUYÊN LOGIC M2 CŨ:
//
// 1. Chưa phát hiện bất thường
// 2. Loại I
//
// Điểm sửa:
// Sau khi autoM3ChuaPhatHien() chạy xong,
// chờ DOM render ổn định rồi mới quét Loại I.
//
// Sau đó Loại I được VERIFY nhiều vòng.
// =========================================================

async function autoM2KhamLamSang() {

    log(
        '================================'
    );

    log(
        '🚀 M2 - AUTO KHÁM LÂM SÀNG (dưới 18 tuổi)'
    );

    log(
        '================================'
    );


    // -----------------------------------------------------
    // 1. Chưa phát hiện bất thường
    //
    // Giữ nguyên dùng logic M3
    // -----------------------------------------------------

    await autoM3ChuaPhatHien();


    // -----------------------------------------------------
    // QUAN TRỌNG:
    //
    // Sau khi click "Chưa phát hiện bất thường",
    // Angular/DevExtreme có thể:
    //
    // - render thêm checkbox
    // - thay đổi DOM
    // - cập nhật các khu vực khám
    //
    // Vì vậy không được tìm Loại I ngay lập tức.
    // -----------------------------------------------------

    await sleep(
        300
    );


    // -----------------------------------------------------
    // 2. Chọn Loại I
    //
    // Dùng cơ chế quét nhiều vòng mới
    // -----------------------------------------------------

    const loaiIResult =
        await autoM2LoaiICheckbox();


    // -----------------------------------------------------
    // THÔNG BÁO
    // -----------------------------------------------------

    let message =
        '✅ M2 - Đã Auto Fill Khám lâm sàng!\n\n' +

        '✓ Chưa phát hiện bất thường\n' +

        `✓ Loại I - tìm thấy: ${loaiIResult.found}\n` +

        `✓ Loại I - đã chọn: ${loaiIResult.count}\n` +

        `✓ Loại I - đã sẵn có: ${loaiIResult.skipped}\n`;


    if (
        loaiIResult.unchecked > 0
    ) {

        message +=
            `\n⚠️ Còn ${loaiIResult.unchecked} ô Loại I chưa chọn.\n` +
            'Vui lòng kiểm tra Console (F12).\n';

    } else {

        message +=
            '\n✅ Đã kiểm tra lại: tất cả Loại I đã chọn.\n';
    }


    message +=
        '\nVui Lòng Kiểm Tra Trước Khi Lưu.';


    autoAlert(
        message
    );
}


    // =========================================================
    // XÁC ĐỊNH TAB HIỆN TẠI QUA TIÊU ĐỀ (dùng chung M2/M3/M4)
    // (mỗi tab có <h2 class="hidden-web-title">...</h2> riêng)
    // =========================================================

    function getCurrentTabTitleM2() {

        const titleEl =
            document.querySelector(
                'h2.hidden-web-title'
            ) ||
            document.querySelector(
                '.hidden-web-title'
            );

        if (!titleEl) {
            return '';
        }

        return norm(
            titleEl.innerText
        );
    }


    // =========================================================
    // M2 - NÚT RIÊNG
    // =========================================================

    function createM2Button() {

        if (
            document.getElementById(
                'medinet-auto-m2'
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            'medinet-auto-m2';


        button.innerText =
            '🚀 AUTO M2';


        button.className =
            'medinet-toolbar-btn';


        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '272px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#c62828',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );


        button.addEventListener(
            'click',
            async function () {

                if (
                    button.disabled
                ) {
                    return;
                }


                button.disabled =
                    true;


                button.innerText =
                    '⏳ M2...';

                showStatusBar(
                    'Đang chạy AUTO M2...'
                );


                try {

                    const tabTitle =
                        getCurrentTabTitleM2();

                    // Dự phòng: trang này dùng route khác
                    // (dynamicviewer/tabpanel), có thể không có
                    // h2.hidden-web-title -> dò thêm theo text
                    // toàn trang
                    const bodyTextM2 =
                        norm(
                            document.body.innerText
                        );


                    // Tab "Tiền sử bệnh nhân dưới 18 tuổi"
                    // (gồm cả tiền sử bệnh gia đình, bản thân
                    // và bảng Tiêm chủng - tất cả chung 1 trang,
                    // h2 không đổi theo mục sidebar)
                    if (
                        tabTitle.includes(
                            'tiền sử bệnh nhân dưới 18 tuổi'
                        )
                    ) {

                        await autoM2TienSuDuoi18();

                    } else if (
                        // Tab "Đánh giá sức khỏe tâm thần"
                        tabTitle.includes(
                            'đánh giá sức khỏe tâm thần'
                        ) ||
                        bodyTextM2.includes(
                            'đánh giá sức khỏe tâm thần'
                        )
                    ) {

                        await autoM2DanhGiaTamThan();

                    } else if (
                        // Tab "Thông tin khám" (Khám lâm sàng)
                        tabTitle.includes(
                            'thông tin khám bệnh nhân dưới 18 tuổi'
                        ) ||
                        bodyTextM2.includes(
                            'thông tin khám bệnh nhân dưới 18 tuổi'
                        )
                    ) {

                        await autoM2KhamLamSang();

                    } else {

                        autoAlert(
                            '⚠️ AUTO M2 chưa hỗ trợ tab này.\n\n' +
                            'Tab hiện tại: ' +
                            (tabTitle || '(không xác định)')
                        );
                    }


                } catch (e) {

                    console.error(
                        LOG,
                        e
                    );


                    autoAlert(
                        '❌ Lỗi AUTO M2.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );


                } finally {

                    button.disabled =
                        false;


                    button.innerText =
                        '🚀 AUTO M2';
                }
            }
        );


        document.body.appendChild(
            button
        );
    }


    // =========================================================
    // =========================================================
    //                     M3
    // =========================================================
    // =========================================================


    // =========================================================
    // M3 - TIỀN SỬ
    // =========================================================

    async function autoM3TienSu() {

        log(
            '================================'
        );

        log(
            '🚀 M3 - AUTO TIỀN SỬ'
        );

        log(
            '================================'
        );


        // -----------------------------------------------------
        // 1. 22 CÂU TIỀN SỬ
        // -----------------------------------------------------

        const listItems = [
            ...document.querySelectorAll(
                '.dx-list-item'
            )
        ].filter(el => {

            return (
                norm(
                    el.innerText
                ) === 'không'
            );

        });

        log(
            'Tìm thấy',
            listItems.length,
            'nút Không trong dx-list'
        );


        const targets =
            listItems.slice(
                0,
                22
            );


        if (
            targets.length < 22
        ) {

            warn(
                `Chỉ tìm thấy ${targets.length}/22 câu`
            );
        }


        for (
            let i = 0;
            i < targets.length;
            i++
        ) {

            const item =
                targets[i];


            if (
                item.classList.contains(
                    'dx-list-item-selected'
                )
            ) {

                continue;
            }


            // CLICK NHANH
            // KHÔNG SCROLL

            fastClick(
                item
            );


            await sleep(
                FAST_DELAY
            );


            log(
                `✓ M3 Tiền sử ${i + 1}/${targets.length}`
            );
        }


        // -----------------------------------------------------
        // 2. ĐIỀU TRỊ BỆNH
        // -----------------------------------------------------

        await selectKhongFast(
            'Ông (bà) có đang điều trị bệnh gì không?'
        );


        // -----------------------------------------------------
        // 3. THAI SẢN
        // -----------------------------------------------------

        await selectKhongFast(
            'Tiền sử thai sản'
        );


        autoAlert(
            '✅ M3 - Đã Auto Fill Tiền sử!\n\n' +
            '✓ 22 câu tiền sử\n' +
            '✓ Điều trị bệnh: Không\n' +
            '✓ Thai sản: Không\n\n' +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
    // M3 - TÌM CHECKBOX
    // "CHƯA PHÁT HIỆN BẤT THƯỜNG"
    // =========================================================

    function findChuaPhatHienCheckboxes() {

        const result = [];

        const labels = [
            ...document.querySelectorAll(
                'b'
            )
        ];


        labels.forEach(
            label => {

                const text =
                    norm(
                        label.innerText
                    );


                if (
                    !text.includes(
                        'chưa phát hiện bất thường'
                    )
                ) {

                    return;
                }


                let current =
                    label;


                for (
                    let level = 0;
                    level < 10;
                    level++
                ) {

                    if (!current) {
                        break;
                    }


                    const checkbox =
                        current.querySelector(
                            '.dx-checkbox'
                        );


                    if (checkbox) {

                        if (
                            !result.some(
                                x =>
                                    x.checkbox ===
                                    checkbox
                            )
                        ) {

                            result.push({
                                label,
                                checkbox
                            });
                        }


                        return;
                    }


                    current =
                        current.parentElement;
                }

            }
        );


        return result;
    }


    // =========================================================
    // M3 - CHỌN CHƯA PHÁT HIỆN BẤT THƯỜNG
    // KHÔNG SCROLL
    // =========================================================

    async function autoM3ChuaPhatHien() {

        const items =
            findChuaPhatHienCheckboxes();


        log(
            'Tìm thấy',
            items.length,
            'checkbox Chưa phát hiện bất thường'
        );


        if (
            !items.length
        ) {

            warn(
                'Không tìm thấy checkbox Chưa phát hiện bất thường'
            );

            return false;
        }


        let count = 0;


        for (
            const item of items
        ) {

            const checkbox =
                item.checkbox;


            const isChecked =
                checkbox.classList.contains(
                    'dx-checkbox-checked'
                ) ||
                checkbox.getAttribute(
                    'aria-checked'
                ) === 'true';


            if (
                isChecked
            ) {

                continue;
            }


            // CLICK NHANH
            // KHÔNG SCROLL

            fastClick(
                checkbox
            );


            count++;


            await sleep(
                FAST_DELAY
            );


            log(
                `✓ Chưa phát hiện bất thường ${count}`
            );
        }


        return true;
    }


    // =========================================================
    // M3 - CHỌN LOẠI I CHO TẤT CẢ CÁC KHOA
    //
    // Trước đây chỉ chọn Loại I của riêng khu vực Tuần hoàn.
    // Giờ quét toàn bộ trang, tìm MỌI ô "Loại I" (mỗi khoa
    // khám - Tuần hoàn, Hô hấp, Tiêu hoá, TMH, Mắt, RHM, Da
    // liễu, Thần kinh, Tâm thần, Cơ xương khớp, Nội tiết,
    // v.v... đều có radio Loại I riêng) và chọn tất cả.
    //
    // KHÔNG SCROLL
    // =========================================================

    async function autoM3LoaiITatCa() {

        log(
            'Tìm tất cả ô "Loại I" trên trang...'
        );


        // Tìm mọi text node hiển thị đúng "Loại I"
        // (el.children.length <= 1 để tránh bắt trúng
        // container cha bao nhiều chữ khác)
        const loaiITexts = [
            ...document.querySelectorAll(
                '*'
            )
        ].filter(
            el =>
                norm(
                    el.innerText
                ) === 'loại i' &&
                el.children.length <= 1
        );


        if (
            !loaiITexts.length
        ) {

            warn(
                'Không tìm thấy ô Loại I nào trên trang'
            );

            return false;
        }


        log(
            'Tìm thấy',
            loaiITexts.length,
            'ô "Loại I" (theo từng khoa)'
        );


        // Dedup theo radioContainer, tránh click trùng
        // nếu nhiều text-node cùng trỏ về 1 radio
        const seenRadios =
            new Set();

        let count = 0;
        let skipped = 0;
        let notFound = 0;


        for (
            const textElement of loaiITexts
        ) {

            let current =
                textElement;

            let radioContainer =
                null;


            for (
                let level = 0;
                level < 12;
                level++
            ) {

                if (!current) {
                    break;
                }


                const radioIcon =
                    current.querySelector(
                        '.dx-radiobutton-icon'
                    );


                if (radioIcon) {

                    radioContainer =
                        radioIcon.closest(
                            '[role="radio"]'
                        ) ||
                        radioIcon.closest(
                            '.dx-radiobutton'
                        );


                    break;
                }


                current =
                    current.parentElement;
            }


            if (!radioContainer) {

                notFound++;

                continue;
            }


            if (
                seenRadios.has(
                    radioContainer
                )
            ) {

                continue;
            }


            seenRadios.add(
                radioContainer
            );


            const checked =
                radioContainer.getAttribute(
                    'aria-checked'
                ) === 'true';


            if (checked) {

                skipped++;

                continue;
            }


            // CLICK NHANH
            // KHÔNG SCROLL

            fastClick(
                radioContainer
            );


            count++;


            await sleep(
                FAST_DELAY
            );


            log(
                `✓ Đã chọn Loại I (${count})`
            );
        }


        if (notFound) {

            warn(
                `Không tìm thấy radio cho ${notFound} ô "Loại I"`
            );
        }


        log(
            `✓ Hoàn tất Loại I: đã chọn ${count}, đã sẵn ${skipped}`
        );


        return true;
    }


    // =========================================================
    // M3 - KHÁM LÂM SÀNG
    // =========================================================

    async function autoM3KhamLamSang() {

        log(
            '================================'
        );

        log(
            '🚀 M3 - AUTO KHÁM LÂM SÀNG'
        );

        log(
            '================================'
        );


        // 1. Chưa phát hiện bất thường

        await autoM3ChuaPhatHien();


        await sleep(
            FAST_DELAY
        );


        // 2. Loại I - cho tất cả các khoa

        await autoM3LoaiITatCa();


        autoAlert(
            '✅ M3 - Đã Auto Fill Khám lâm sàng!\n\n' +
            '✓ Chưa phát hiện bất thường\n' +
            '✓ Loại I - tất cả các khoa\n\n' +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
    // M3 - NÚT RIÊNG
    // =========================================================

    function createM3Button() {

        if (
            document.getElementById(
                'medinet-auto-m3'
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            'medinet-auto-m3';


        button.innerText =
            '🚀 AUTO M3';


        button.className =
            'medinet-toolbar-btn';


        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '224px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#1976d2',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );


        button.addEventListener(
            'click',
            async function () {

                if (
                    button.disabled
                ) {
                    return;
                }


                button.disabled =
                    true;


                button.innerText =
                    '⏳ M3...';

                showStatusBar(
                    'Đang chạy AUTO M3...'
                );


                try {

                    const bodyText =
                        norm(
                            document.body.innerText
                        );


                    // Nếu đang Khám cận lâm sàng (SID + số liệu XN)
                    if (
                        bodyText.includes(
                            'kết quả xét nghiệm máu'
                        )
                    ) {

                        await autoCanLamSang();

                    } else if (
                        // Nếu đang Khám lâm sàng
                        bodyText.includes(
                            'chưa phát hiện bất thường'
                        )
                    ) {

                        await autoM3KhamLamSang();

                    } else {

                        // Mặc định Tiền sử
                        await autoM3TienSu();
                    }


                } catch (e) {

                    console.error(
                        LOG,
                        e
                    );


                    autoAlert(
                        '❌ Lỗi AUTO M3.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );

                } finally {

                    button.disabled =
                        false;


                    button.innerText =
                        '🚀 AUTO M3';
                }
            }
        );


        document.body.appendChild(
            button
        );
    }


    // =========================================================
    // GIAO DIỆN MODAL TÙY CHỈNH (thay cho autoAlert()/confirm() thô
    // của trình duyệt, dùng cho các thông báo quan trọng - xác
    // nhận bệnh nhân, cảnh báo kết quả bất thường)
    // =========================================================

    function ensureModalStyles() {

        if (
            document.getElementById(
                'medinet-modal-style'
            )
        ) {

            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'medinet-modal-style';

        style.textContent = `
            .mnm-overlay {
                position: fixed;
                inset: 0;
                background: rgba(15, 23, 42, 0.55);
                z-index: 9999999;
                display: flex;
                align-items: center;
                justify-content: center;
                font-family: 'Segoe UI', Roboto, Arial, sans-serif;
                animation: mnm-fade-in .15s ease-out;
            }
            @keyframes mnm-fade-in {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            .mnm-box {
                background: #fff;
                border-radius: 14px;
                width: min(480px, 92vw);
                max-height: 82vh;
                display: flex;
                flex-direction: column;
                box-shadow: 0 20px 50px rgba(0,0,0,.35);
                overflow: hidden;
            }
            .mnm-header {
                padding: 18px 22px;
                font-size: 16px;
                font-weight: 700;
                color: #0f172a;
                border-bottom: 1px solid #eef0f3;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .mnm-header.mnm-warn { color: #b45309; }
            .mnm-header.mnm-ok { color: #15803d; }
            .mnm-body {
                padding: 18px 22px;
                font-size: 13.5px;
                color: #334155;
                line-height: 1.6;
                overflow-y: auto;
            }
            .mnm-footer {
                padding: 14px 22px;
                border-top: 1px solid #eef0f3;
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                background: #fafafa;
            }
            .mnm-btn {
                padding: 9px 18px;
                border-radius: 8px;
                border: none;
                font-size: 13.5px;
                font-weight: 600;
                cursor: pointer;
                transition: filter .1s;
            }
            .mnm-btn:hover { filter: brightness(0.95); }
            .mnm-btn-primary { background: #2563eb; color: #fff; }
            .mnm-btn-secondary { background: #e5e7eb; color: #334155; }
            .mnm-patient-card {
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                border-radius: 10px;
                padding: 14px 16px;
                display: grid;
                grid-template-columns: 90px 1fr;
                row-gap: 6px;
                font-size: 13.5px;
            }
            .mnm-patient-card b { color: #0f172a; }
            .mnm-pick-list {
                max-height: 340px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin: 4px -4px 0;
                padding: 4px;
            }
            .mnm-pick-item {
                text-align: left;
                background: #f8fafc;
                border: 1.5px solid #e2e8f0;
                border-radius: 10px;
                padding: 10px 14px;
                font-size: 13.5px;
                color: #1e293b;
                cursor: pointer;
                font-family: inherit;
                transition: border-color .12s, background .12s;
            }
            .mnm-pick-item:hover {
                border-color: #2563eb;
                background: #eff6ff;
            }
            .mnm-pick-item b {
                color: #0f172a;
                font-size: 14px;
            }
            .mnm-pick-item .mnm-pick-sub {
                margin-top: 3px;
                color: #64748b;
                font-size: 12.5px;
            }
            .mnm-finding-row {
                display: flex;
                align-items: flex-start;
                gap: 10px;
                padding: 10px 0;
                border-bottom: 1px solid #f1f5f9;
            }
            .mnm-finding-row:last-child { border-bottom: none; }
            .mnm-badge {
                flex-shrink: 0;
                min-width: 44px;
                text-align: center;
                padding: 3px 8px;
                border-radius: 6px;
                font-size: 11.5px;
                font-weight: 700;
                color: #fff;
            }
            .mnm-badge-cao { background: #dc2626; }
            .mnm-badge-thap { background: #2563eb; }
            .mnm-finding-main { flex: 1; }
            .mnm-finding-label { font-weight: 700; color: #0f172a; font-size: 13px; }
            .mnm-finding-value { color: #64748b; font-size: 12.5px; }
            .mnm-finding-value-row {
                display: flex;
                align-items: baseline;
                gap: 8px;
                margin: 4px 0 6px;
                flex-wrap: wrap;
            }
            .mnm-finding-number {
                font-size: 21px;
                font-weight: 800;
                line-height: 1;
            }
            .mnm-finding-number-cao { color: #dc2626; }
            .mnm-finding-number-thap { color: #2563eb; }
            .mnm-finding-range {
                font-size: 12px;
                color: #94a3b8;
            }
            .mnm-finding-icd {
                margin-top: 2px;
                font-size: 12.5px;
                color: #7c2d12;
                background: #fff7ed;
                display: inline-block;
                padding: 2px 8px;
                border-radius: 5px;
            }
            .mnm-note {
                margin-top: 14px;
                font-size: 12px;
                color: #94a3b8;
                font-style: italic;
            }
            .mnm-input-label {
                display: block;
                font-size: 13px;
                font-weight: 600;
                color: #334155;
                margin-bottom: 8px;
            }
            .mnm-input {
                width: 100%;
                box-sizing: border-box;
                padding: 11px 14px;
                font-size: 15px;
                border: 1.5px solid #cbd5e1;
                border-radius: 9px;
                outline: none;
                font-family: inherit;
                transition: border-color .15s;
            }
            .mnm-input:focus {
                border-color: #2563eb;
            }
            .mnm-select {
                width: 100%;
                box-sizing: border-box;
                padding: 11px 14px;
                font-size: 15px;
                border: 1.5px solid #cbd5e1;
                border-radius: 9px;
                outline: none;
                font-family: inherit;
                background: #fff;
                transition: border-color .15s;
            }
            .mnm-select:focus {
                border-color: #2563eb;
            }
            .mnm-select.mnm-select-placeholder {
                color: #94a3b8;
            }
            .mnm-select option:not([value=""]) {
                color: #0f172a;
            }
            .mnm-field-group {
                margin-bottom: 14px;
            }
            .mnm-field-group:last-child {
                margin-bottom: 0;
            }
            .mnm-tabs {
                display: flex;
                gap: 4px;
                padding: 0 22px;
                border-bottom: 1px solid #eef0f3;
                background: #fafafa;
            }
            .mnm-tab {
                padding: 12px 16px;
                font-size: 13.5px;
                font-weight: 600;
                color: #94a3b8;
                cursor: pointer;
                border-bottom: 2.5px solid transparent;
                user-select: none;
            }
            .mnm-tab.mnm-tab-active {
                color: #2563eb;
                border-bottom-color: #2563eb;
            }
            .mnm-tab-panel {
                display: none;
            }
            .mnm-tab-panel.mnm-tab-panel-active {
                display: block;
            }
            .mnm-toast {
                position: fixed;
                left: 50%;
                bottom: 40px;
                transform: translateX(-50%) translateY(20px);
                background: #15803d;
                color: #fff;
                padding: 13px 22px;
                border-radius: 10px;
                font-family: 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 14px;
                font-weight: 600;
                box-shadow: 0 10px 30px rgba(0,0,0,.25);
                z-index: 9999999;
                opacity: 0;
                transition: opacity .25s, transform .25s;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .mnm-toast.mnm-toast-show {
                opacity: 1;
                transform: translateX(-50%) translateY(0);
            }
        `;

        document.head.appendChild(
            style
        );
    }

    // Thông báo nhỏ tự biến mất - dùng khi mọi thứ ổn (không
    // cần bấm OK như modal), vẫn báo cho biết đã chạy xong
    function showToast(
        message,
        durationMs
    ) {

        const normalized = normalizeAutoMessageModel(message);
        const parsed = parseAutoNoticeMessage(normalized, 'Thông báo');

        if (
            typeof unifiedAutoRuntime !== 'undefined' &&
            unifiedAutoRuntime.running
        ) {
            unifiedAutoRuntime.lastMessage = normalized;
            showRunningSpeechBubble(normalized);
            return;
        }

        showAutoDockPanel(
            parsed.title,
            renderSpeechBodyHtml(parsed.body || parsed.firstLine),
            parsed.type,
            durationMs || (parsed.type === 'error' ? 9000 : 4200)
        );
    }

    function showModal(
        {
            title,
            titleClass,
            bodyHtml,
            buttons
        }
    ) {

        ensureModalStyles();

        return new Promise(
            resolve => {

                const overlay =
                    document.createElement(
                        'div'
                    );

                overlay.className =
                    'mnm-overlay';

                const box =
                    document.createElement(
                        'div'
                    );

                box.className =
                    'mnm-box';

                const header =
                    document.createElement(
                        'div'
                    );

                header.className =
                    'mnm-header' +
                    (
                        titleClass
                            ? (' ' + titleClass)
                            : ''
                    );

                header.textContent =
                    title;

                const body =
                    document.createElement(
                        'div'
                    );

                body.className =
                    'mnm-body';

                body.innerHTML =
                    bodyHtml;

                const footer =
                    document.createElement(
                        'div'
                    );

                footer.className =
                    'mnm-footer';

                buttons.forEach(
                    btn => {

                        const b =
                            document.createElement(
                                'button'
                            );

                        b.className =
                            'mnm-btn ' +
                            (
                                btn.primary
                                    ? 'mnm-btn-primary'
                                    : 'mnm-btn-secondary'
                            );

                        b.textContent =
                            btn.label;

                        b.addEventListener(
                            'click',
                            () => {

                                document.body.removeChild(
                                    overlay
                                );

                                resolve(
                                    btn.value
                                );
                            }
                        );

                        footer.appendChild(
                            b
                        );
                    }
                );

                box.appendChild(
                    header
                );

                box.appendChild(
                    body
                );

                box.appendChild(
                    footer
                );

                overlay.appendChild(
                    box
                );

                document.body.appendChild(
                    overlay
                );
            }
        );
    }

    function confirmModal(
        title,
        bodyHtml,
        titleClass
    ) {

        return showModal({
            title,
            titleClass,
            bodyHtml,
            buttons: [
                { label: 'Huỷ', value: false },
                { label: 'Xác nhận', value: true, primary: true }
            ]
        });
    }

    function infoModal(
        title,
        bodyHtml,
        titleClass
    ) {

        // Khi chạy từ nút AUTO hợp nhất: các thông báo thụ động
        // không được bật modal giữa màn hình nữa.
        // - Cảnh báo XN/bất thường: tích hợp vào badge ! của nút AUTO.
        // - Lỗi/không tìm thấy/trùng dữ liệu: hiển thị panel neo cạnh nút AUTO.
        if (
            typeof unifiedAutoRuntime !== 'undefined' &&
            unifiedAutoRuntime.running
        ) {
            const titleText = String(title || '');
            const titleNorm = norm(titleText);
            const passiveLabWarning =
                titleNorm.includes('thiếu thông số xét nghiệm') ||
                titleNorm.includes('có kết quả bất thường');

            if (passiveLabWarning) {
                // lastCanLamSangReport đã giữ đầy đủ chi tiết;
                // updateUnifiedAutoButton() sẽ bật badge cảnh báo.
                return Promise.resolve(true);
            }

            const plain = htmlToPlainText(bodyHtml);
            unifiedAutoRuntime.blocked = true;
            unifiedAutoRuntime.lastMessage =
                `${titleText}\n\n${plain}`.trim();

            const type =
                titleNorm.includes('lỗi') || titleText.includes('❌')
                    ? 'error'
                    : 'warn';

            showAutoDockPanel(
                titleText,
                bodyHtml,
                type,
                0
            );

            return Promise.resolve(true);
        }

        return showModal({
            title,
            titleClass,
            bodyHtml,
            buttons: [
                { label: 'Đóng', value: true, primary: true }
            ]
        });
    }

    // Modal nhập text (thay cho prompt() gốc) - trả về chuỗi
    // đã nhập, hoặc null nếu bấm Huỷ / để trống
    function promptModal(
        title,
        labelText,
        placeholder
    ) {

        ensureModalStyles();

        return new Promise(
            resolve => {

                const overlay =
                    document.createElement(
                        'div'
                    );

                overlay.className =
                    'mnm-overlay';

                const box =
                    document.createElement(
                        'div'
                    );

                box.className =
                    'mnm-box';

                const header =
                    document.createElement(
                        'div'
                    );

                header.className =
                    'mnm-header';

                header.textContent =
                    title;

                const body =
                    document.createElement(
                        'div'
                    );

                body.className =
                    'mnm-body';

                const label =
                    document.createElement(
                        'label'
                    );

                label.className =
                    'mnm-input-label';

                label.textContent =
                    labelText;

                const input =
                    document.createElement(
                        'input'
                    );

                input.type =
                    'text';

                input.className =
                    'mnm-input';

                input.placeholder =
                    placeholder || '';

                body.appendChild(
                    label
                );

                body.appendChild(
                    input
                );

                const footer =
                    document.createElement(
                        'div'
                    );

                footer.className =
                    'mnm-footer';

                const finish =
                    value => {

                        document.body.removeChild(
                            overlay
                        );

                        resolve(
                            value
                        );
                    };

                const btnCancel =
                    document.createElement(
                        'button'
                    );

                btnCancel.className =
                    'mnm-btn mnm-btn-secondary';

                btnCancel.textContent =
                    'Huỷ';

                btnCancel.addEventListener(
                    'click',
                    () =>
                        finish(
                            null
                        )
                );

                const btnOk =
                    document.createElement(
                        'button'
                    );

                btnOk.className =
                    'mnm-btn mnm-btn-primary';

                btnOk.textContent =
                    'Tìm kiếm';

                btnOk.addEventListener(
                    'click',
                    () =>
                        finish(
                            input.value.trim() || null
                        )
                );

                input.addEventListener(
                    'keydown',
                    e => {

                        if (
                            e.key === 'Enter'
                        ) {

                            finish(
                                input.value.trim() || null
                            );

                        } else if (
                            e.key === 'Escape'
                        ) {

                            finish(
                                null
                            );
                        }
                    }
                );

                footer.appendChild(
                    btnCancel
                );

                footer.appendChild(
                    btnOk
                );

                box.appendChild(
                    header
                );

                box.appendChild(
                    body
                );

                box.appendChild(
                    footer
                );

                overlay.appendChild(
                    box
                );

                document.body.appendChild(
                    overlay
                );

                setTimeout(
                    () =>
                        input.focus(),
                    50
                );
            }
        );
    }

    // Modal 2 TAB để tìm bệnh nhân: "Theo SID" (mặc định) và
    // "Theo Họ tên" (Họ tên + Năm sinh + Giới tính). Trả về
    // null nếu huỷ, hoặc:
    //   { mode: 'sid', sid }
    //   { mode: 'name', hoTen, namSinh, gioiTinh }
    function searchPatientModal() {

        ensureModalStyles();

        return new Promise(
            resolve => {

                const overlay =
                    document.createElement(
                        'div'
                    );

                overlay.className =
                    'mnm-overlay';

                const box =
                    document.createElement(
                        'div'
                    );

                box.className =
                    'mnm-box';

                const header =
                    document.createElement(
                        'div'
                    );

                header.className =
                    'mnm-header';

                header.textContent =
                    '🔬 Khám cận lâm sàng - Tự động điền';

                // -----------------------------------------
                // TAB BAR
                // -----------------------------------------

                const tabs =
                    document.createElement(
                        'div'
                    );

                tabs.className =
                    'mnm-tabs';

                const tabSid =
                    document.createElement(
                        'div'
                    );

                tabSid.className =
                    'mnm-tab mnm-tab-active';

                tabSid.textContent =
                    'Theo SID';

                const tabName =
                    document.createElement(
                        'div'
                    );

                tabName.className =
                    'mnm-tab';

                tabName.textContent =
                    'Theo Họ tên';

                tabs.appendChild(
                    tabSid
                );

                tabs.appendChild(
                    tabName
                );

                // -----------------------------------------
                // BODY - 2 PANEL
                // -----------------------------------------

                const body =
                    document.createElement(
                        'div'
                    );

                body.className =
                    'mnm-body';

                // Panel SID
                const panelSid =
                    document.createElement(
                        'div'
                    );

                panelSid.className =
                    'mnm-tab-panel mnm-tab-panel-active';

                const labelSid =
                    document.createElement(
                        'label'
                    );

                labelSid.className =
                    'mnm-input-label';

                labelSid.textContent =
                    'Nhập SID xét nghiệm';

                const inputSid =
                    document.createElement(
                        'input'
                    );

                inputSid.type =
                    'text';

                inputSid.className =
                    'mnm-input';

                inputSid.placeholder =
                    'Vui lòng nhập đủ 6 số';

                panelSid.appendChild(
                    labelSid
                );

                panelSid.appendChild(
                    inputSid
                );

                // Panel Họ tên + Năm sinh + Giới tính
                const panelName =
                    document.createElement(
                        'div'
                    );

                panelName.className =
                    'mnm-tab-panel';

                const groupHoTen =
                    document.createElement(
                        'div'
                    );

                groupHoTen.className =
                    'mnm-field-group';

                const labelHoTen =
                    document.createElement(
                        'label'
                    );

                labelHoTen.className =
                    'mnm-input-label';

                labelHoTen.textContent =
                    'Họ tên bệnh nhân';

                const inputHoTen =
                    document.createElement(
                        'input'
                    );

                inputHoTen.type =
                    'text';

                inputHoTen.className =
                    'mnm-input';

                inputHoTen.placeholder =
                    'VD: Nguyễn Văn A';

                groupHoTen.appendChild(
                    labelHoTen
                );

                groupHoTen.appendChild(
                    inputHoTen
                );

                const groupNamSinh =
                    document.createElement(
                        'div'
                    );

                groupNamSinh.className =
                    'mnm-field-group';

                const labelNamSinh =
                    document.createElement(
                        'label'
                    );

                labelNamSinh.className =
                    'mnm-input-label';

                labelNamSinh.textContent =
                    'Năm sinh';

                const inputNamSinh =
                    document.createElement(
                        'input'
                    );

                inputNamSinh.type =
                    'text';

                inputNamSinh.inputMode =
                    'numeric';

                inputNamSinh.className =
                    'mnm-input';

                inputNamSinh.placeholder =
                    'VD: 1990';

                groupNamSinh.appendChild(
                    labelNamSinh
                );

                groupNamSinh.appendChild(
                    inputNamSinh
                );

                const groupGioiTinh =
                    document.createElement(
                        'div'
                    );

                groupGioiTinh.className =
                    'mnm-field-group';

                const labelGioiTinh =
                    document.createElement(
                        'label'
                    );

                labelGioiTinh.className =
                    'mnm-input-label';

                labelGioiTinh.textContent =
                    'Giới tính';

                const selectGioiTinh =
                    document.createElement(
                        'select'
                    );

                selectGioiTinh.className =
                    'mnm-select mnm-select-placeholder';

                [
                    { value: '', text: 'Xin chọn...' },
                    { value: 'M', text: 'Nam' },
                    { value: 'F', text: 'Nữ' }
                ].forEach(
                    opt => {

                        const optEl =
                            document.createElement(
                                'option'
                            );

                        optEl.value =
                            opt.value;

                        optEl.textContent =
                            opt.text;

                        selectGioiTinh.appendChild(
                            optEl
                        );
                    }
                );

                selectGioiTinh.addEventListener(
                    'change',
                    () => {

                        selectGioiTinh.classList.toggle(
                            'mnm-select-placeholder',
                            selectGioiTinh.value === ''
                        );
                    }
                );

                groupGioiTinh.appendChild(
                    labelGioiTinh
                );

                groupGioiTinh.appendChild(
                    selectGioiTinh
                );

                panelName.appendChild(
                    groupHoTen
                );

                panelName.appendChild(
                    groupNamSinh
                );

                panelName.appendChild(
                    groupGioiTinh
                );

                body.appendChild(
                    panelSid
                );

                body.appendChild(
                    panelName
                );

                // -----------------------------------------
                // CHUYỂN TAB
                // -----------------------------------------

                let activeTab =
                    'sid';

                const switchTab =
                    tab => {

                        activeTab =
                            tab;

                        tabSid.classList.toggle(
                            'mnm-tab-active',
                            tab === 'sid'
                        );

                        tabName.classList.toggle(
                            'mnm-tab-active',
                            tab === 'name'
                        );

                        panelSid.classList.toggle(
                            'mnm-tab-panel-active',
                            tab === 'sid'
                        );

                        panelName.classList.toggle(
                            'mnm-tab-panel-active',
                            tab === 'name'
                        );

                        setTimeout(
                            () => {

                                (
                                    tab === 'sid'
                                        ? inputSid
                                        : inputHoTen
                                ).focus();
                            },
                            50
                        );
                    };

                tabSid.addEventListener(
                    'click',
                    () =>
                        switchTab(
                            'sid'
                        )
                );

                tabName.addEventListener(
                    'click',
                    () =>
                        switchTab(
                            'name'
                        )
                );

                // -----------------------------------------
                // FOOTER
                // -----------------------------------------

                const footer =
                    document.createElement(
                        'div'
                    );

                footer.className =
                    'mnm-footer';

                const finish =
                    value => {

                        document.body.removeChild(
                            overlay
                        );

                        resolve(
                            value
                        );
                    };

                const btnCancel =
                    document.createElement(
                        'button'
                    );

                btnCancel.className =
                    'mnm-btn mnm-btn-secondary';

                btnCancel.textContent =
                    'Huỷ';

                btnCancel.addEventListener(
                    'click',
                    () =>
                        finish(
                            null
                        )
                );

                const btnOk =
                    document.createElement(
                        'button'
                    );

                btnOk.className =
                    'mnm-btn mnm-btn-primary';

                btnOk.textContent =
                    'Tìm kiếm';

                const submit =
                    () => {

                        if (
                            activeTab === 'sid'
                        ) {

                            const sidVal =
                                inputSid.value.trim();

                            if (!sidVal) {

                                inputSid.focus();

                                return;
                            }

                            finish({
                                mode: 'sid',
                                sid: sidVal
                            });

                        } else {

                            const hoTenVal =
                                inputHoTen.value.trim();

                            if (!hoTenVal) {

                                inputHoTen.focus();

                                return;
                            }

                            const namSinhVal =
                                inputNamSinh.value.trim();

                            finish({
                                mode: 'name',
                                hoTen: hoTenVal,
                                namSinh:
                                    namSinhVal
                                        ? parseInt(namSinhVal, 10)
                                        : null,
                                gioiTinh:
                                    selectGioiTinh.value || null
                            });
                        }
                    };

                btnOk.addEventListener(
                    'click',
                    submit
                );

                inputSid.addEventListener(
                    'keydown',
                    e => {

                        if (e.key === 'Enter') submit();

                        if (e.key === 'Escape') finish(null);
                    }
                );

                inputHoTen.addEventListener(
                    'keydown',
                    e => {

                        if (e.key === 'Enter') submit();

                        if (e.key === 'Escape') finish(null);
                    }
                );

                inputNamSinh.addEventListener(
                    'keydown',
                    e => {

                        if (e.key === 'Enter') submit();

                        if (e.key === 'Escape') finish(null);
                    }
                );

                footer.appendChild(
                    btnCancel
                );

                footer.appendChild(
                    btnOk
                );

                box.appendChild(
                    header
                );

                box.appendChild(
                    tabs
                );

                box.appendChild(
                    body
                );

                box.appendChild(
                    footer
                );

                overlay.appendChild(
                    box
                );

                document.body.appendChild(
                    overlay
                );

                setTimeout(
                    () =>
                        inputSid.focus(),
                    50
                );
            }
        );
    }

    // Dựng HTML danh sách kết quả bất thường (dùng chung cho
    // cảnh báo lúc điền xong và nút "Xem lại cảnh báo")
    function renderFindingsHtml(
        findings
    ) {

        if (
            !findings.length
        ) {

            return (
                '<div style="color:#15803d;font-weight:600;">' +
                '✓ Không có kết quả bất thường.</div>'
            );
        }

        const rows =
            findings.map(
                f => {

                    const isThap =
                        f.direction === 'thấp';

                    const badgeClass =
                        isThap
                            ? 'mnm-badge-thap'
                            : 'mnm-badge-cao';

                    const numberClass =
                        isThap
                            ? 'mnm-finding-number-thap'
                            : 'mnm-finding-number-cao';

                    const badgeText =
                        f.direction
                            ? f.direction.toUpperCase()
                            : 'XEM';

                    return (
                        '<div class="mnm-finding-row">' +
                        `<span class="mnm-badge ${badgeClass}">${badgeText}</span>` +
                        '<div class="mnm-finding-main">' +
                        `<div class="mnm-finding-label">${f.label}</div>` +
                        `<div class="mnm-finding-number ${numberClass}">${f.value}</div>` +
                        `<div class="mnm-finding-range">Mức tham chiếu: ${f.rangeText}</div>` +
                        `<div class="mnm-finding-icd"><span>Mã tham khảo</span><b>${f.code}</b><span>${f.name}</span></div>` +
                        '</div>' +
                        '</div>'
                    );
                }
            ).join(
                ''
            );

        return (
            rows +
            '<div class="mnm-note">⚠️ Các gợi ý trên chỉ để tham khảo và không thay thế đánh giá của bác sĩ.</div>'
        );
    }


    // =========================================================
    // CLICK ĐẦY ĐỦ CHUỖI SỰ KIỆN (cho DevExtreme)
    //
    // el.click() chỉ bắn ra sự kiện "click" đơn thuần.
    // Một số component DevExtreme (dx-list dùng trong bảng
    // Hỏi bệnh) cần đủ pointerdown/mousedown/pointerup/mouseup
    // thì mới bắn nội bộ sự kiện chọn (selectionChanged) và
    // báo cho Angular cập nhật logic ẩn/hiện dòng con.
    // Không dùng cho các nút khác vì có thể làm chậm/không
    // cần thiết ở nơi el.click() đã đủ.
    // =========================================================

    function robustClick(el) {

        if (!el) {
            return false;
        }

        try {

            const rect =
                el.getBoundingClientRect();

            const x =
                rect.left + rect.width / 2;

            const y =
                rect.top + rect.height / 2;

            const base = {
                bubbles: true,
                cancelable: true,
                composed: true,
                view: window,
                clientX: x,
                clientY: y
            };

            const pointerOpts = {
                ...base,
                pointerId: 1,
                pointerType: 'mouse',
                isPrimary: true
            };

            const sequence = [
                () => new PointerEvent('pointerdown', pointerOpts),
                () => new MouseEvent('mousedown', base),
                () => new PointerEvent('pointerup', pointerOpts),
                () => new MouseEvent('mouseup', base),
                () => new MouseEvent('click', base)
            ];

            for (
                const makeEvent of sequence
            ) {

                el.dispatchEvent(
                    makeEvent()
                );
            }

            return true;

        } catch (e) {

            warn(
                'Lỗi robustClick, dùng click thường:',
                e
            );

            return fastClick(
                el
            );
        }
    }


    // =========================================================
    // TIỆN ÍCH DÙNG CHUNG: TÌM CÂU HỎI THEO MÃ (D1, D2.1, ...)
    // VÀ CHỌN ĐÁP ÁN BẤT KỲ (Không / Hầu như không / Có...)
    // =========================================================

    function escapeRegex(str) {

        return str.replace(
            /[.*+?^${}()|[\]\\]/g,
            '\\$&'
        );
    }


    function findQuestionByCode(code) {

        const target =
            norm(code);


        // -----------------------------------------------------
        // CÁCH 1: Bảng dạng lưới DevExtreme
        // Mã câu hỏi nằm trong 1 ô <td role="gridcell">
        // (khớp CHÍNH XÁC, không phải includes, vì mỗi ô
        // chỉ chứa đúng mã, ví dụ "D1.1")
        // -----------------------------------------------------

        const gridCells = [
            ...document.querySelectorAll(
                '[role="gridcell"]'
            )
        ];

        const cellMatch =
            gridCells.find(
                td =>
                    norm(td.innerText) ===
                    target
            );

        if (cellMatch) {

            // Trả về cả DÒNG (tr / role=row) chứa ô mã này,
            // để từ đó tìm ô đáp án Có/Không nằm cùng dòng
            return (
                cellMatch.closest(
                    'tr'
                ) ||
                cellMatch.closest(
                    '[role="row"]'
                ) ||
                cellMatch
            );
        }


        // -----------------------------------------------------
        // CÁCH 2 (dự phòng): tìm theo nhãn văn bản thông
        // thường, dùng cho các phần không phải dạng bảng
        // -----------------------------------------------------

        const boundaryRegex =
            new RegExp(
                '^' +
                escapeRegex(target) +
                '(\\.|\\)|:|\\s|$)'
            );

        const all = [
            ...document.querySelectorAll(
                'div, span, p, label, b'
            )
        ];

        const matches =
            all.filter(el => {

                const text =
                    norm(el.innerText);

                return (
                    boundaryRegex.test(text) &&
                    text.length < 500
                );
            });

        if (!matches.length) {
            return null;
        }

        matches.sort(
            (a, b) =>
                norm(a.innerText).length -
                norm(b.innerText).length
        );

        return matches[0];
    }


    function findAnswerListItem(
        rowEl,
        answerText
    ) {

        const answerNorm =
            norm(answerText);

        // Đáp án là các nút dx-list-item, nội dung nằm
        // trong .dx-item-content.dx-list-item-content
        // (giống cấu trúc 22 câu "Không" ở phần Tiền sử)
        const contents = [
            ...rowEl.querySelectorAll(
                '.dx-item-content.dx-list-item-content'
            )
        ];

        // -----------------------------------------------------
        // Khớp CHÍNH XÁC trước (ví dụ "có" === "có")
        // -----------------------------------------------------

        let match =
            contents.find(
                c =>
                    norm(c.textContent) ===
                    answerNorm
            );


        // -----------------------------------------------------
        // Dự phòng: một số câu (VD D8.3.1) có đáp án dạng
        // ghép "Không/Một số lần" - nếu không khớp chính xác,
        // thử khớp theo "bắt đầu bằng" đáp án mong muốn
        // (answerNorm là tiền tố của text hiển thị)
        // -----------------------------------------------------

        if (!match) {

            match =
                contents.find(
                    c =>
                        norm(
                            c.textContent
                        ).startsWith(
                            answerNorm + '/'
                        )
                );
        }

        if (!match) {
            return null;
        }

        return (
            match.closest(
                '.dx-list-item'
            ) ||
            match
        );
    }


    async function selectAnswerByCodeFast(
        code,
        answerText
    ) {

        const questionRow =
            findQuestionByCode(
                code
            );

        if (!questionRow) {

            warn(
                'Không tìm thấy câu hỏi:',
                code
            );

            return false;
        }

        const item =
            findAnswerListItem(
                questionRow,
                answerText
            );

        if (!item) {

            warn(
                `Không tìm thấy đáp án "${answerText}" cho:`,
                code
            );

            return false;
        }

        const alreadySelected =
            item.classList.contains(
                'dx-list-item-selected'
            ) ||
            item.getAttribute(
                'aria-selected'
            ) === 'true';

        if (
            alreadySelected
        ) {

            log(
                'Đã chọn sẵn:',
                code,
                '->',
                answerText
            );

            return true;
        }

        robustClick(
            item
        );

        // Đợi lâu hơn FAST_DELAY một chút vì robustClick bắn
        // nhiều sự kiện, cần thời gian cho Angular chạy xong
        // change detection (đặc biệt khi có ẩn/hiện dòng con)
        await sleep(
            FAST_DELAY + 30
        );

        log(
            '✓ Đã chọn:',
            code,
            '->',
            answerText
        );

        return true;
    }


    // =========================================================
    // =========================================================
    //                     M4
    // =========================================================
    // =========================================================


    // =========================================================
    // M4 - TIỀN SỬ BỆNH CỦA ĐỐI TƯỢNG
    // =========================================================

    async function autoM4TienSu() {

        log(
            '================================'
        );

        log(
            '🚀 M4 - AUTO TIỀN SỬ'
        );

        log(
            '================================'
        );


        // -----------------------------------------------------
        // 1. 22 CÂU KHÔNG
        // -----------------------------------------------------

        const listItems = [
            ...document.querySelectorAll(
                '.dx-list-item'
            )
        ].filter(
            el =>
                norm(
                    el.innerText
                ) === 'không'
        );


        log(
            'M4 tìm thấy',
            listItems.length,
            'nút Không'
        );


        const targets =
            listItems.slice(
                0,
                M4_HISTORY_COUNT
            );


        for (
            let i = 0;
            i < targets.length;
            i++
        ) {

            const item =
                targets[i];


            if (
                item.classList.contains(
                    'dx-list-item-selected'
                )
            ) {

                continue;
            }


            // CLICK NHANH
            // KHÔNG SCROLL

            fastClick(
                item
            );


            await sleep(
                FAST_DELAY
            );


            log(
                `✓ M4 Tiền sử ${i + 1}/${targets.length}`
            );
        }


        // -----------------------------------------------------
        // 2. ĐIỀU TRỊ BỆNH
        // -----------------------------------------------------

        await selectKhongFast(
            'a) Ông (bà) có đang điều trị bệnh gì không?'
        );


        // -----------------------------------------------------
        // 3. THAI SẢN
        // -----------------------------------------------------

        await selectKhongFast(
            'b) Tiền sử thai sản (Đối với phụ nữ)'
        );


        autoAlert(
            '✅ M4 - Đã Auto Fill Tiền sử!\n\n' +
            `✓ ${targets.length} câu Không\n` +
            '✓ Điều trị bệnh: Không\n' +
            '✓ Thai sản: Không\n\n' +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
    // M4 - HỎI BỆNH VÀ KHÁM LÂM SÀNG
    // =========================================================

    // Bản đồ Mã câu hỏi -> Đáp án cần chọn
    const M4_HOI_BENH_ANSWER_MAP = {

        // Chọn "Không"
        'D1': 'không',
        'D2.1': 'không', 'D2.2': 'không', 'D2.3': 'không',
        'D2.4': 'không', 'D2.5': 'không',
        'D3.1': 'không', 'D3.2': 'không', 'D3.3': 'không',
        'D4.1': 'không', 'D4.2': 'không', 'D4.3': 'không',
        'D4.4': 'không', 'D4.5': 'không', 'D4.6': 'không',
        'D4.7': 'không', 'D4.8': 'không',
        'D5.1': 'không', 'D5.2': 'không', 'D5.3': 'không',
        'D5.4': 'không', 'D5.5': 'không', 'D5.6': 'không',
        'D5.7': 'không', 'D5.8': 'không', 'D5.9': 'không',
        'D5.10': 'không', 'D5.11': 'không',

        // D8.3.1 có bộ đáp án riêng: "Không/Một số lần" vs
        // "Tất cả mọi lúc/ hầu hết thời gian" (không phải
        // Có/Không thường) -> đáp án mong muốn vẫn là "không",
        // findAnswerListItem sẽ tự khớp với "không/một số lần"
        'D8.3.1': 'không',
        'D8.3.2': 'không', 'D8.3.3': 'không',
        'D8.4.1': 'không', 'D8.4.2': 'không', 'D8.4.3': 'không',
        'D8.4.4': 'không',
        'D8.5.1': 'không',

        // Chọn "Hầu như không"
        'D6.1': 'hầu như không', 'D6.2': 'hầu như không',
        'D6.3': 'hầu như không', 'D6.4': 'hầu như không',
        'D6.5': 'hầu như không', 'D6.6': 'hầu như không',
        'D6.7': 'hầu như không', 'D6.8': 'hầu như không',
        'D6.9': 'hầu như không',
        'D7.1': 'hầu như không', 'D7.2': 'hầu như không',
        'D7.3': 'hầu như không', 'D7.4': 'hầu như không',
        'D7.5': 'hầu như không', 'D7.6': 'hầu như không',
        'D7.7': 'hầu như không',

        // Chọn "Có"
        'D8.1.1': 'có', 'D8.1.2': 'có', 'D8.1.3': 'có',
        'D8.1.4': 'có', 'D8.1.5': 'có', 'D8.1.6': 'có',
        'D8.2.1': 'có', 'D8.2.2': 'có', 'D8.2.3': 'có',
        'D8.2.4': 'có', 'D8.2.5': 'có', 'D8.2.6': 'có',
        'D8.2.7': 'có', 'D8.2.8': 'có'
    };


    // Các mã khi chọn "Không" sẽ khiến trang ẩn/hiện hàng loạt
    // dòng con (conditional rows) -> cần đợi thêm cho grid
    // render xong trước khi tìm các mã tiếp theo
    const M4_TRIGGER_EXTRA_DELAY = {
        'D1': 300,       // ẩn D1.1 .. D1.13 (13 dòng)
        'D8.5.1': 200    // ẩn D8.5.2, D8.5.3 (2 dòng)
    };


    async function autoM4HoiBenhKhamLamSang() {

        log(
            '================================'
        );

        log(
            '🚀 M4 - AUTO HỎI BỆNH VÀ KHÁM LÂM SÀNG'
        );

        log(
            '================================'
        );

        const entries =
            Object.entries(
                M4_HOI_BENH_ANSWER_MAP
            );

        let done = 0;
        let failed = 0;
        const failedCodes = [];

        for (
            const [code, answer] of entries
        ) {

            log(
                'Đang xử lý:',
                code,
                '->',
                answer
            );

            const ok =
                await selectAnswerByCodeFast(
                    code,
                    answer
                );

            if (ok) {

                done++;

            } else {

                failed++;

                failedCodes.push(
                    code
                );
            }


            // Đợi thêm nếu mã này kích hoạt ẩn/hiện
            // hàng loạt dòng con, để grid render ổn định
            // trước khi tìm mã tiếp theo
            const extraDelay =
                M4_TRIGGER_EXTRA_DELAY[
                    code
                ];

            if (
                ok &&
                extraDelay
            ) {

                log(
                    `⏳ Đợi thêm ${extraDelay}ms sau ${code} (ẩn/hiện dòng con)...`
                );

                await sleep(
                    extraDelay
                );
            }
        }

        if (failed) {

            warn(
                'Các mã không xử lý được:',
                failedCodes.join(', ')
            );
        }

        autoAlert(
            '✅ M4 - Đã Auto Fill Hỏi bệnh và khám lâm sàng!\n\n' +
            `✓ Đã xử lý: ${done}/${entries.length} câu\n` +
            (
                failed
                    ? `⚠️ Không tìm thấy: ${failed} câu (xem Console - F12)\n\n`
                    : '\n'
            ) +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // =========================================================
    // XÁC ĐỊNH TAB HIỆN TẠI QUA TIÊU ĐỀ
    // (mỗi tab có <h2 class="hidden-web-title">...</h2> riêng)
    // =========================================================

    function getCurrentTabTitle() {

        const titleEl =
            document.querySelector(
                'h2.hidden-web-title'
            ) ||
            document.querySelector(
                '.hidden-web-title'
            );

        if (!titleEl) {
            return '';
        }

        return norm(
            titleEl.innerText
        );
    }


    // =========================================================
    // M4 - NÚT RIÊNG
    // =========================================================

    function createM4Button() {

        if (
            document.getElementById(
                'medinet-auto-m4'
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            'medinet-auto-m4';


        button.innerText =
            '🚀 AUTO M4';


        button.className =
            'medinet-toolbar-btn';


        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '176px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#2e7d32',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );


        button.addEventListener(
            'click',
            async function () {

                if (
                    button.disabled
                ) {
                    return;
                }


                button.disabled =
                    true;


                button.innerText =
                    '⏳ M4...';

                showStatusBar(
                    'Đang chạy AUTO M4...'
                );


                try {

                    const tabTitle =
                        getCurrentTabTitle();

                    const bodyTextM4 =
                        norm(
                            document.body.innerText
                        );


                    // Nếu đang Khám cận lâm sàng (SID + số liệu XN)
                    if (
                        bodyTextM4.includes(
                            'kết quả xét nghiệm máu'
                        )
                    ) {

                        await autoCanLamSang();

                    } else if (
                        // Tab "Hỏi bệnh và khám lâm sàng"
                        tabTitle.includes(
                            'hỏi bệnh và khám lâm sàng'
                        )
                    ) {

                        await autoM4HoiBenhKhamLamSang();

                    } else if (
                        // Tab "Thông tin khám" - dùng chung
                        // logic với M3 Khám lâm sàng
                        // (Chưa phát hiện bất thường + Loại I)
                        tabTitle.includes(
                            'thông tin khám'
                        )
                    ) {

                        await autoM3KhamLamSang();

                    } else {

                        // Mặc định Tiền sử
                        await autoM4TienSu();
                    }


                } catch (e) {

                    console.error(
                        LOG,
                        e
                    );


                    autoAlert(
                        '❌ Lỗi AUTO M4.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );


                } finally {

                    button.disabled =
                        false;


                    button.innerText =
                        '🚀 AUTO M4';
                }
            }
        );


        document.body.appendChild(
            button
        );
    }


    // =========================================================
    // DEBUG - QUÉT TÌM MÃ CÂU HỎI (D1, D2.1, ...) TRÊN TRANG
    // Dùng khi Auto không nhận ra câu hỏi (0/66)
    // =========================================================

    function debugScanCodes() {

        // Regex lỏng: bắt mọi chuỗi bắt đầu bằng d + số
        // (không bắt buộc có dấu chấm ngay sau)
        const regex =
            /^d\s*\d+([.\s]\d+)*/i;

        const all = [
            ...document.querySelectorAll(
                '*'
            )
        ];

        const seenTexts =
            new Set();

        const candidates =
            [];

        for (
            const el of all
        ) {

            // Chỉ lấy phần tử "lá" (ít con) để tránh
            // trùng lặp do các phần tử cha lồng nhau
            if (
                el.children.length > 2
            ) {
                continue;
            }

            const rawText =
                (el.innerText || '').trim();

            if (
                !rawText ||
                rawText.length > 200
            ) {
                continue;
            }

            const text =
                norm(rawText);

            if (
                !regex.test(text)
            ) {
                continue;
            }

            if (
                seenTexts.has(rawText)
            ) {
                continue;
            }

            seenTexts.add(
                rawText
            );

            candidates.push({
                tag: el.tagName,
                class: (el.className || '').toString().slice(0, 60),
                text: rawText.slice(0, 100)
            });
        }

        console.log(
            LOG,
            `🔍 DEBUG: Tìm thấy ${candidates.length} phần tử có khả năng chứa mã câu hỏi`
        );

        console.table(
            candidates
        );

        // In thêm dạng text đơn giản để dễ copy/paste
        console.log(
            LOG,
            '🔍 DEBUG (dạng text để copy):'
        );

        candidates.forEach(
            (c, i) => {

                console.log(
                    `${i + 1}. [${c.tag}.${c.class}] "${c.text}"`
                );
            }
        );

        autoAlert(
            `🔍 DEBUG: Tìm thấy ${candidates.length} phần tử.\n\n` +
            'Mở F12 → tab Console để xem danh sách chi tiết.\n' +
            'Copy toàn bộ log (hoặc chụp màn hình) gửi lại để mình sửa script.'
        );
    }


    function createDebugButton() {

        if (
            document.getElementById(
                'medinet-auto-debug'
            )
        ) {
            return;
        }


        const button =
            document.createElement(
                'button'
            );


        button.id =
            'medinet-auto-debug';


        button.innerText =
            '🔍 DEBUG D-CODE';


        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '210px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#616161',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );


        button.addEventListener(
            'click',
            debugScanCodes
        );


        document.body.appendChild(
            button
        );
    }


    // =========================================================
    // =========================================================
    //       KHÁM CẬN LÂM SÀNG (dùng chung M3 + M4)
    //
    // Điền các ô kết quả xét nghiệm (số) + Nitrit (radio) dựa
    // trên dữ liệu tra theo SID từ Google Sheet công khai
    // "Auto Nhập KSK- DATA AUTO XN", sheet DATA, cột B = SID.
    //
    // M3 có 2 khung (mục lớn) trên cùng trang - CHỈ điền khung
    // "2. Khám sức khỏe định kỳ". M4 chỉ có 1 khung - điền
    // toàn trang. Script tự phát hiện có khung "2. ..." hay
    // không để quyết định có cần giới hạn phạm vi hay không.
    // =========================================================

    const CAN_LAM_SANG_SHEET_ID =
        '1ZN2Y7WRZUgbLQZp-fI1HQ7xlB22fVE6titx8BB1UuUk';

    const CAN_LAM_SANG_CSV_URL =
        `https://docs.google.com/spreadsheets/d/${CAN_LAM_SANG_SHEET_ID}/gviz/tq?tqx=out:csv&sheet=DATA`;

    // Nhãn trên form -> tên cột trong sheet
    // Nhãn KHÔNG kèm đơn vị - vì đơn vị hiển thị (M/µL, T/L,
    // g/dL, g/L...) phụ thuộc cấu hình hệ thống và có thể khác
    // nhau giữa các lần/mẫu. So khớp sẽ tự bỏ qua phần "(...)"
    // ở cuối nhãn thật trên trang (xem stripTrailingUnit).
    const CAN_LAM_SANG_FIELD_MAP = [
        { label: 'Số lượng HC', column: 'RBC' },
        { label: 'Huyết sắc tố', column: 'HGB' },
        { label: 'Hematocrit', column: 'HCT' },
        { label: 'MCV', column: 'MCV' },
        { label: 'MCH', column: 'MCH' },
        { label: 'MCHC', column: 'MCHC' },
        { label: 'RDW', column: 'RDW' },
        { label: 'Số lượng bạch cầu', column: 'WBC' },
        { label: 'Số lượng bạch cầu trung tính', column: 'NEU#' },
        { label: 'Số lượng bạch cầu lympho', column: 'LYM#' },
        { label: 'Số lượng bạch cầu đơn nhân', column: 'MONO#' },
        { label: 'Số lượng bạch cầu ái toan', column: 'EOS#' },
        { label: 'Số lượng bạch cầu ái kiềm', column: 'BASO#' },
        { label: 'Số lượng tiểu cầu', column: 'PLT' },
        { label: 'Đường máu', column: 'Glucose' },
        { label: 'Urê', column: 'Ure' },
        { label: 'Creatinin', column: 'Creatinine' },
        { label: 'ASAT(GOT)', column: 'AST' },
        { label: 'ALAT (GPT)', column: 'ALT' },
        { label: 'Tỉ trọng', column: 'S.G' },
        { label: 'pH', column: 'pH' },
        { label: 'Bạch cầu', column: 'LEU' },
        { label: 'Hồng cầu', column: 'BLD' },
        { label: 'Protein', column: 'PRO' },
        { label: 'Glucose', column: 'GLU' },
        { label: 'Thể cetonic', column: 'KET' },
        { label: 'Bilirubin', column: 'BIL' },
        { label: 'Urobilinogen', column: 'URO' }
    ];


    // Các nhãn KHÔNG cần cảnh báo dù thiếu (VD Khoa XN không
    // còn chạy xét nghiệm này nữa) - vẫn ĐIỀN bình thường nếu
    // sheet có dữ liệu, chỉ bỏ qua khi hiện cảnh báo thiếu.
    const MISSING_WARNING_EXCLUDE = [
        'Urê'
    ];


    // -----------------------------------------------------------
    // CSV PARSER ĐƠN GIẢN (hỗ trợ dấu ngoặc kép, phẩy trong ô)
    // -----------------------------------------------------------

    function parseCsv(text) {

        const rows = [];

        let row = [];

        let field = '';

        let inQuotes = false;

        for (
            let i = 0;
            i < text.length;
            i++
        ) {

            const c =
                text[i];

            if (inQuotes) {

                if (c === '"') {

                    if (text[i + 1] === '"') {

                        field += '"';

                        i++;

                    } else {

                        inQuotes = false;
                    }

                } else {

                    field += c;
                }

            } else {

                if (c === '"') {

                    inQuotes = true;

                } else if (c === ',') {

                    row.push(field);

                    field = '';

                } else if (c === '\n') {

                    row.push(field);

                    rows.push(row);

                    row = [];

                    field = '';

                } else if (c === '\r') {

                    // bỏ qua

                } else {

                    field += c;
                }
            }
        }

        if (
            field.length ||
            row.length
        ) {

            row.push(field);

            rows.push(row);
        }

        return rows;
    }


    // -----------------------------------------------------------
    // TẢI DỮ LIỆU XÉT NGHIỆM THEO SID TỪ GOOGLE SHEET
    // -----------------------------------------------------------

    // -----------------------------------------------------------
    // THÔNG BÁO LIÊN HỆ KHI CÓ LỖI
    // -----------------------------------------------------------

    const KHOA_XN_CONTACT_MSG =
        '📞 Nếu cần hỗ trợ, vui lòng liên hệ Khoa Xét nghiệm.';


    // -----------------------------------------------------------
    // TẢI SHEET (CÓ CACHE 2 PHÚT - tránh tải lại nhiều lần khi
    // tìm SID rồi lại tìm theo tên trong cùng phiên làm việc)
    // -----------------------------------------------------------

    let sheetCache = null;
    let sheetCacheTime = 0;
    const SHEET_CACHE_TTL = 2 * 60 * 1000;

    async function fetchSheetRows() {

        const now =
            Date.now();

        if (
            sheetCache &&
            (now - sheetCacheTime) < SHEET_CACHE_TTL
        ) {

            return sheetCache;
        }

        const res =
            await fetch(
                CAN_LAM_SANG_CSV_URL
            );

        if (!res.ok) {

            throw new Error(
                'Tải sheet thất bại (HTTP ' +
                res.status +
                ')'
            );
        }

        const text =
            await res.text();

        const rows =
            parseCsv(text);

        if (
            !rows.length
        ) {

            throw new Error(
                'Sheet rỗng hoặc không đọc được'
            );
        }

        sheetCache = {
            header: rows[0],
            rows: rows
        };

        sheetCacheTime = now;

        return sheetCache;
    }

    function buildDataObject(
        header,
        row
    ) {

        const data = {};

        header.forEach(
            (colName, idx) => {

                data[colName.trim()] =
                    (
                        row[idx] ||
                        ''
                    ).trim();
            }
        );

        return data;
    }


    // -----------------------------------------------------------
    // TÌM THEO SID (khớp chính xác, hoặc theo HẬU TỐ SỐ nếu
    // nhân viên chỉ ghi vài số cuối) - TRẢ VỀ MẢNG (có thể
    // nhiều dòng khớp, xử lý trùng ở nơi gọi)
    // -----------------------------------------------------------

    async function findLabRowsBySid(
        sidQuery
    ) {

        const { header, rows } =
            await fetchSheetRows();

        const sidIndex =
            header.findIndex(
                h =>
                    norm(h) ===
                    'sid'
            );

        if (
            sidIndex === -1
        ) {

            throw new Error(
                'Không tìm thấy cột SID trong sheet'
            );
        }

        const targetSid =
            sidQuery.trim();

        const targetDigits =
            targetSid.replace(
                /\D/g,
                ''
            );

        const dataRows =
            rows.slice(1);

        // Khớp chính xác trước
        let matchRows =
            dataRows.filter(
                r =>
                    (r[sidIndex] || '').trim() ===
                    targetSid
            );

        // Dự phòng: khớp theo hậu tố số
        if (
            !matchRows.length &&
            targetDigits
        ) {

            matchRows =
                dataRows.filter(
                    r => {

                        const fullDigits =
                            (r[sidIndex] || '')
                                .trim()
                                .replace(
                                    /\D/g,
                                    ''
                                );

                        return (
                            fullDigits.length >=
                            targetDigits.length &&
                            fullDigits.endsWith(
                                targetDigits
                            )
                        );
                    }
                );
        }

        return matchRows.map(
            r =>
                buildDataObject(
                    header,
                    r
                )
        );
    }


    // -----------------------------------------------------------
    // TÌM THEO HỌ TÊN + NĂM SINH (ước tính, sai số ±1 năm) +
    // GIỚI TÍNH (nếu có chọn). Giới tính lấy từ SELECT rõ ràng
    // của người dùng - KHÔNG tự đoán từ chữ, nên không sợ nhầm
    // tên thật là "Nam"/"Nữ".
    // -----------------------------------------------------------

    async function findLabRowsByNameYearGender(
        hoTen,
        namSinh,
        gioiTinh
    ) {

        const { header, rows } =
            await fetchSheetRows();

        const nameIndex =
            header.findIndex(
                h =>
                    norm(h) ===
                    'tên bệnh nhân'
            );

        if (
            nameIndex === -1
        ) {

            throw new Error(
                'Không tìm thấy cột Tên bệnh nhân trong sheet'
            );
        }

        const ageIndex =
            header.findIndex(
                h =>
                    norm(h) ===
                    'tuổi'
            );

        const dateIndex =
            header.findIndex(
                h =>
                    norm(h) ===
                    'ngày xn'
            );

        const genderIndex =
            header.findIndex(
                h =>
                    norm(h) ===
                    'giới tính'
            );

        const targetName =
            norm(hoTen);

        const dataRows =
            rows.slice(1);

        const matchRows =
            dataRows.filter(
                r => {

                    const rowName =
                        norm(
                            r[nameIndex] || ''
                        );

                    if (
                        rowName !== targetName
                    ) {

                        return false;
                    }

                    // Lọc giới tính nếu người dùng có chọn
                    if (
                        gioiTinh &&
                        genderIndex !== -1
                    ) {

                        const rowGender =
                            (r[genderIndex] || '')
                                .trim()
                                .toUpperCase();

                        if (
                            rowGender !== gioiTinh
                        ) {

                            return false;
                        }
                    }

                    // Lọc năm sinh nếu người dùng có nhập
                    if (!namSinh) {

                        return true;
                    }

                    const tuoi =
                        parseInt(
                            (r[ageIndex] || '').trim(),
                            10
                        );

                    const ngayXN =
                        (r[dateIndex] || '').trim();

                    const yearMatch =
                        ngayXN.match(
                            /(\d{4})/
                        );

                    // Không đủ dữ liệu để tính năm sinh -> giữ
                    // lại, để người dùng tự xác nhận sau
                    if (
                        !yearMatch ||
                        isNaN(tuoi)
                    ) {

                        return true;
                    }

                    const namXN =
                        parseInt(
                            yearMatch[1],
                            10
                        );

                    const namSinhUocTinh =
                        namXN - tuoi;

                    return (
                        Math.abs(
                            namSinhUocTinh - namSinh
                        ) <= 1
                    );
                }
            );

        return matchRows.map(
            r =>
                buildDataObject(
                    header,
                    r
                )
        );
    }


    // -----------------------------------------------------------
    // KHI CÓ NHIỀU HƠN 1 KẾT QUẢ KHỚP - cho người dùng CHỌN
    // (thay vì báo lỗi rồi bắt tìm lại từ đầu)
    // -----------------------------------------------------------

    function pickFromMultipleMatches(
        matches,
        searchDesc
    ) {

        ensureModalStyles();

        return new Promise(
            resolve => {

                const overlay =
                    document.createElement('div');

                overlay.className =
                    'mnm-overlay';

                const box =
                    document.createElement('div');

                box.className =
                    'mnm-box';

                const header =
                    document.createElement('div');

                header.className =
                    'mnm-header';

                header.textContent =
                    `🔎 Tìm thấy ${matches.length} kết quả khớp`;

                const body =
                    document.createElement('div');

                body.className =
                    'mnm-body';

                const descEl =
                    document.createElement('div');

                descEl.style.marginBottom =
                    '10px';

                descEl.style.color =
                    '#64748b';

                descEl.style.fontSize =
                    '13px';

                descEl.textContent =
                    `Khớp với ${searchDesc} - bấm đúng người để chọn:`;

                body.appendChild(
                    descEl
                );

                const listEl =
                    document.createElement('div');

                listEl.className =
                    'mnm-pick-list';

                const finish =
                    value => {

                        document.body.removeChild(
                            overlay
                        );

                        resolve(
                            value
                        );
                    };

                matches.forEach(
                    (d, i) => {

                        const ten =
                            getDataValueByColumn(
                                d,
                                'Tên bệnh nhân'
                            ) || '?';

                        const tuoi =
                            getDataValueByColumn(
                                d,
                                'Tuổi'
                            ) || '?';

                        const gtRaw =
                            (
                                getDataValueByColumn(
                                    d,
                                    'Giới tính'
                                ) || ''
                            ).toString().trim().toUpperCase();

                        const gtText =
                            gtRaw === 'F'
                                ? 'Nữ'
                                : (
                                    gtRaw === 'M'
                                        ? 'Nam'
                                        : (gtRaw || '?')
                                );

                        const sidVal =
                            getDataValueByColumn(
                                d,
                                'SID'
                            ) || '?';

                        const ngay =
                            getDataValueByColumn(
                                d,
                                'Ngày XN'
                            ) || '?';

                        const item =
                            document.createElement(
                                'button'
                            );

                        item.type =
                            'button';

                        item.className =
                            'mnm-pick-item';

                        item.innerHTML =
                            `<b>${i + 1}. ${ten}</b>` +
                            '<div class="mnm-pick-sub">' +
                            `${tuoi} tuổi, ${gtText} &nbsp;•&nbsp; ` +
                            `SID ${sidVal} &nbsp;•&nbsp; Ngày XN ${ngay}` +
                            '</div>';

                        item.addEventListener(
                            'click',
                            () =>
                                finish(d)
                        );

                        listEl.appendChild(
                            item
                        );
                    }
                );

                body.appendChild(
                    listEl
                );

                const footer =
                    document.createElement('div');

                footer.className =
                    'mnm-footer';

                const btnCancel =
                    document.createElement('button');

                btnCancel.className =
                    'mnm-btn mnm-btn-secondary';

                btnCancel.textContent =
                    'Huỷ';

                btnCancel.addEventListener(
                    'click',
                    () =>
                        finish(null)
                );

                footer.appendChild(
                    btnCancel
                );

                box.appendChild(header);
                box.appendChild(body);
                box.appendChild(footer);
                overlay.appendChild(box);
                document.body.appendChild(overlay);
            }
        );
    }


    // -----------------------------------------------------------
    // XÁC ĐỊNH PHẠM VI "KHUNG 2" (nếu có)
    //
    // M3: có nhiều khung được đánh số "1. ...", "2. ..." (chữ
    // in hoa, đậm, màu xanh) -> chỉ điền trong khung khớp
    // sectionLabelIncludes.
    // M4: không có kiểu đánh số này -> trả về null (không giới
    // hạn phạm vi, điền toàn trang).
    // -----------------------------------------------------------

    function findNumberedSectionHeaders() {

        return [
            ...document.querySelectorAll(
                'b'
            )
        ].filter(
            b => {

                const text =
                    (b.textContent || '').trim();

                return (
                    /^\d+\.\s*\S/.test(
                        text
                    )
                );
            }
        );
    }

    function getKhungScope(
        sectionLabelIncludes
    ) {

        const headers =
            findNumberedSectionHeaders();

        const idx =
            headers.findIndex(
                h =>
                    norm(
                        h.textContent
                    ).includes(
                        sectionLabelIncludes
                    )
            );

        if (idx === -1) {

            return null;
        }

        return {
            start: headers[idx],
            end: headers[idx + 1] || null
        };
    }

    function isElInScope(
        el,
        scope
    ) {

        if (!scope) {

            return true;
        }

        const posStart =
            scope.start.compareDocumentPosition(
                el
            );

        const afterStart =
            !!(
                posStart &
                Node.DOCUMENT_POSITION_FOLLOWING
            );

        if (!afterStart) {

            return false;
        }

        if (scope.end) {

            const posEnd =
                scope.end.compareDocumentPosition(
                    el
                );

            const beforeEnd =
                !!(
                    posEnd &
                    Node.DOCUMENT_POSITION_PRECEDING
                );

            if (!beforeEnd) {

                return false;
            }
        }

        return true;
    }


    // -----------------------------------------------------------
    // BỎ QUA PHẦN ĐƠN VỊ Ở CUỐI NHÃN (nếu có)
    //
    // "Số lượng HC (M/µL)" -> "số lượng hc"
    // "Số lượng HC (T/L)"  -> "số lượng hc"
    // "ASAT(GOT) (U/L)"    -> "asat(got)"  (chỉ bỏ ngoặc CUỐI
    //                                       cùng, giữ nguyên
    //                                       ngoặc là 1 phần tên)
    // -----------------------------------------------------------

    function stripTrailingUnit(text) {

        return norm(text)
            .replace(
                /\s*\([^)]*\)\s*$/,
                ''
            )
            .trim();
    }


    // -----------------------------------------------------------
    // TÌM NHÃN <b> VÀ Ô NHẬP SỐ (DevExtreme NumberBox) TƯƠNG ỨNG
    // -----------------------------------------------------------

    function findLabelElements(
        labelText
    ) {

        // KHÔNG strip nhãn mục tiêu (labelText) - nhãn khai
        // báo trong CAN_LAM_SANG_FIELD_MAP đã là tên gốc chuẩn
        // rồi, kể cả khi có ngoặc là 1 phần tên thật (VD
        // "ASAT(GOT)").
        //
        // So khớp CẢ 2 KIỂU với nhãn thật trên trang:
        // - Khớp CHÍNH XÁC (không cắt gì) - dùng cho trang
        //   không có đơn vị phía sau (VD M4: "ASAT(GOT)")
        // - Khớp sau khi CẮT đơn vị cuối - dùng cho trang có
        //   thêm đơn vị (VD M3: "ASAT(GOT) (U/L)")
        // Nhờ vậy không cần biết trước trang nào có/không có
        // đơn vị, cả 2 kiểu đều nhận đúng.
        const target =
            norm(labelText);

        return [
            ...document.querySelectorAll(
                'b'
            )
        ].filter(
            b => {

                const raw =
                    norm(
                        b.textContent
                    );

                if (
                    raw === target
                ) {

                    return true;
                }

                return (
                    stripTrailingUnit(
                        b.textContent
                    ) ===
                    target
                );
            }

        );
    }

    function findNumberInputForLabel(
        labelEl
    ) {

        let current =
            labelEl;

        for (
            let level = 0;
            level < 12;
            level++
        ) {

            if (!current) {
                break;
            }

            // Dùng CHUNG 1 selector tổng quát thay vì liệt kê
            // từng kiểu role (spinbutton/combobox/textbox...).
            // "dx-texteditor-input" là class GỐC dùng chung cho
            // MỌI ô nhập liệu DevExtreme (NumberBox, TextBox,
            // AutoComplete, SelectBox...) - class này do chính
            // DevExtreme quy định, không phải thứ cổng nhập
            // liệu tự đổi được, nên bền hơn nhiều so với dò
            // theo "role" (thứ portal có vẻ hay đổi qua mỗi
            // đợt cập nhật).
            const input =
                current.querySelector(
                    'input.dx-texteditor-input'
                );

            if (input) {

                return {
                    element: input,
                    role:
                        input.getAttribute(
                            'role'
                        ) || 'unknown'
                };
            }

            current =
                current.parentElement;
        }

        return null;
    }


    // -----------------------------------------------------------
    // SET GIÁ TRỊ CHO DevExtreme NumberBox
    //
    // Dùng native setter (bỏ qua override của framework) +
    // bắn đủ input/keyup/change/blur để Angular/DevExtreme
    // nhận đúng giá trị. Định dạng dùng dấu PHẨY thập phân
    // theo placeholder của trang ("Nhập số (thập phân dùng
    // dấu phẩy)").
    // -----------------------------------------------------------

    const nativeInputValueSetter =
        Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype,
            'value'
        ).set;

    // -----------------------------------------------------------
    // LÀM TRÒN 1 SỐ THẬP PHÂN (bỏ .0 thừa nếu là số nguyên)
    // "44.49" -> "44.5" ; "261.0" -> "261"
    // -----------------------------------------------------------

    function formatRounded1(
        value
    ) {

        const n =
            parseFloat(
                String(value).replace(
                    ',',
                    '.'
                )
            );

        if (
            isNaN(n)
        ) {

            return String(
                value
            );
        }

        const rounded =
            Math.round(
                n * 100
            ) / 100;

        let str =
            rounded.toFixed(
                2
            );

        // Bỏ số 0 thừa cuối (VD "44.50" -> "44.5",
        // "261.00" -> "261")
        str =
            str.replace(
                /0+$/,
                ''
            ).replace(
                /\.$/,
                ''
            );

        return str;
    }


    // Làm tròn 2 số thập phân + đổi dấu chấm thành phẩy, dùng
    // để HIỂN THỊ giá trị trong modal cảnh báo (khác với
    // formatRounded1 dùng khi điền vào ô trên form)
    function formatRoundedDisplay(
        value
    ) {

        const n =
            parseFloat(
                String(value).replace(
                    ',',
                    '.'
                )
            );

        if (
            isNaN(n)
        ) {

            return String(
                value
            );
        }

        const rounded =
            Math.round(
                n * 100
            ) / 100;

        return String(
            rounded
        ).replace(
            '.',
            ','
        );
    }


    // Bắn chuỗi sự kiện chuẩn (dùng chung cho cả ô số và ô
    // combobox mới) để Angular/DevExtreme nhận đúng giá trị
    async function dispatchInputValue(
        input,
        displayVal
    ) {

        input.focus();

        nativeInputValueSetter.call(
            input,
            displayVal
        );

        input.dispatchEvent(
            new Event(
                'input',
                { bubbles: true }
            )
        );

        input.dispatchEvent(
            new KeyboardEvent(
                'keyup',
                { bubbles: true }
            )
        );

        input.dispatchEvent(
            new Event(
                'change',
                { bubbles: true }
            )
        );

        input.blur();

        input.dispatchEvent(
            new Event(
                'blur',
                { bubbles: true }
            )
        );

        input.dispatchEvent(
            new FocusEvent(
                'focusout',
                { bubbles: true }
            )
        );
    }


    // -----------------------------------------------------------
    // GLUCOSE MÁU - portal mới hiển thị "Đường máu bất kỳ (mmol/L)"
    // và dùng hnumberbox/dx-number-box. Vẫn hỗ trợ các nhãn cũ.
    // Nếu nhãn chỉ còn "Glucose", phải phân biệt với Glucose niệu:
    // Glucose máu nằm trước cụm nước tiểu (Tỉ trọng / pH).
    // -----------------------------------------------------------
    function findBloodGlucoseLabelElements(scope) {

        for (const alias of ['Đường máu bất kỳ', 'Đường máu', 'Glucose máu', 'Glucose bất kỳ']) {

            const exact =
                findLabelElements(alias).filter(
                    el => isElInScope(el, scope)
                );

            if (exact.length) {
                return exact;
            }
        }

        const glucoseLabels =
            findLabelElements('Glucose').filter(
                el => isElInScope(el, scope)
            );

        if (!glucoseLabels.length) {
            return [];
        }

        const urineBoundary =
            [
                ...findLabelElements('Tỉ trọng'),
                ...findLabelElements('pH')
            ].filter(
                el => isElInScope(el, scope)
            ).sort(
                (a, b) =>
                    a === b ? 0 :
                    (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1)
            )[0] || null;

        if (urineBoundary) {

            const beforeUrine =
                glucoseLabels.filter(
                    el =>
                        !!(
                            el.compareDocumentPosition(urineBoundary) &
                            Node.DOCUMENT_POSITION_FOLLOWING
                        )
                );

            if (beforeUrine.length) {
                return [beforeUrine[0]];
            }
        }

        // Dự phòng: trên form hiện tại Glucose máu đứng trước
        // Glucose niệu, nên lấy occurrence đầu tiên.
        return [glucoseLabels[0]];
    }


    async function setBloodGlucoseValue(
        input,
        rawValue
    ) {

        if (!input) {
            return false;
        }

        const val =
            (rawValue === undefined || rawValue === null)
                ? ''
                : String(rawValue).trim();

        if (!val) {
            return false;
        }

        const rounded =
            formatRounded1(val);

        const numericValue =
            parseFloat(
                String(rounded).replace(',', '.')
            );

        if (isNaN(numericValue)) {
            return false;
        }

        const displayVal =
            String(rounded).replace('.', ',');

        const numberBoxEl =
            input.closest('.dx-numberbox') ||
            input.closest('dx-number-box') ||
            input.closest('hnumberbox');

        let instance = null;

        if (
            numberBoxEl &&
            window.DevExpress &&
            DevExpress.ui &&
            DevExpress.ui.dxNumberBox &&
            typeof DevExpress.ui.dxNumberBox.getInstance === 'function'
        ) {
            try {
                instance = DevExpress.ui.dxNumberBox.getInstance(numberBoxEl);
            } catch (e) {}
        }

        if (!instance && numberBoxEl && window.jQuery) {
            try {
                const jq = window.jQuery(numberBoxEl);
                if (jq && typeof jq.dxNumberBox === 'function') {
                    instance = jq.dxNumberBox('instance');
                }
            } catch (e) {}
        }

        // 1) Ưu tiên API NumberBox nếu portal expose instance.
        if (instance && typeof instance.option === 'function') {
            try {
                instance.option('value', numericValue);
                if (typeof instance.blur === 'function') {
                    instance.blur();
                }
                await sleep(50);

                const committed =
                    Number(instance.option('value'));

                if (!isNaN(committed) && Math.abs(committed - numericValue) < 0.000001) {
                    return true;
                }
            } catch (e) {
                warn('Glucose máu: set dxNumberBox instance thất bại:', e);
            }
        }

        // 2) Fallback giống thao tác người dùng gõ thật.
        input.focus();
        try { input.select(); } catch (e) {}

        nativeInputValueSetter.call(input, '');
        input.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    inputType: 'deleteContentBackward',
                    data: null
                }
            )
        );

        nativeInputValueSetter.call(input, displayVal);
        input.dispatchEvent(
            new InputEvent(
                'input',
                {
                    bubbles: true,
                    inputType: 'insertText',
                    data: displayVal
                }
            )
        );

        input.dispatchEvent(
            new KeyboardEvent(
                'keyup',
                {
                    bubbles: true,
                    key: 'Enter',
                    code: 'Enter'
                }
            )
        );

        input.dispatchEvent(
            new Event('change', { bubbles: true })
        );

        input.blur();
        input.dispatchEvent(
            new FocusEvent('focusout', { bubbles: true })
        );

        await sleep(80);

        // Hidden input đi kèm NumberBox - chỉ đồng bộ sau khi ô
        // hiển thị đã nhận giá trị, không dùng làm cách nhập chính.
        if (numberBoxEl) {
            const hidden =
                numberBoxEl.querySelector('input[type="hidden"]');
            if (hidden) {
                hidden.value = String(numericValue);
                hidden.dispatchEvent(
                    new Event('change', { bubbles: true })
                );
            }
        }

        return (input.value || '').trim() !== '';
    }


    async function setNumberBoxValue(
        input,
        rawValue
    ) {

        if (!input) {

            return false;
        }

        const val =
            (rawValue === undefined || rawValue === null)
                ? ''
                : String(rawValue).trim();

        if (val === '') {

            return false;
        }

        const rounded =
            formatRounded1(
                val
            );

        const numericValue =
            parseFloat(
                String(rounded).replace(
                    ',',
                    '.'
                )
            );

        const displayVal =
            rounded.replace(
                '.',
                ','
            );

        // -----------------------------------------------------
        // PORTAL MỚI: hnumberbox > dx-number-box
        //
        // Glucose và một số trường số đã đổi sang DevExtreme
        // NumberBox. Nếu chỉ sửa trực tiếp input.value thì phần
        // chữ có thể hiện đúng nhưng model nội bộ Angular chưa
        // nhận giá trị. Vì vậy ưu tiên set qua instance thật của
        // dxNumberBox, sau đó vẫn bắn event để tương thích form cũ.
        // -----------------------------------------------------

        const numberBoxEl =
            input.closest(
                '.dx-numberbox'
            );

        let instance =
            null;

        if (
            numberBoxEl &&
            window.DevExpress &&
            DevExpress.ui &&
            DevExpress.ui.dxNumberBox &&
            typeof DevExpress.ui.dxNumberBox.getInstance === 'function'
        ) {

            try {

                instance =
                    DevExpress.ui.dxNumberBox.getInstance(
                        numberBoxEl
                    );

            } catch (e) {

                warn(
                    'Không lấy được dxNumberBox instance:',
                    e
                );
            }
        }

        // Dự phòng cho các bản DevExtreme expose widget qua jQuery
        if (
            !instance &&
            numberBoxEl &&
            window.jQuery
        ) {

            try {

                const jq =
                    window.jQuery(
                        numberBoxEl
                    );

                if (
                    jq &&
                    typeof jq.dxNumberBox === 'function'
                ) {

                    instance =
                        jq.dxNumberBox(
                            'instance'
                        );
                }

            } catch (e) {

                // Không sao - sẽ fallback xuống cách cũ bên dưới.
            }
        }

        if (
            instance &&
            typeof instance.option === 'function' &&
            !isNaN(numericValue)
        ) {

            try {

                instance.option(
                    'value',
                    numericValue
                );

                await sleep(
                    30
                );

            } catch (e) {

                warn(
                    'Set dxNumberBox thất bại, chuyển sang fallback:',
                    e
                );
            }
        }

        // Luôn bắn chuỗi event để Angular nhận thay đổi và để
        // tương thích với các NumberBox/TextBox kiểu cũ.
        await dispatchInputValue(
            input,
            displayVal
        );

        // Nếu có instance, ép đồng bộ thêm một lần sau event vì
        // portal có thể tự format lại giá trị khi blur.
        if (
            instance &&
            typeof instance.option === 'function' &&
            !isNaN(numericValue)
        ) {

            try {

                instance.option(
                    'value',
                    numericValue
                );

            } catch (e) {

                // Không chặn luồng autofill nếu portal đổi API.
            }
        }

        return true;
    }


    // -----------------------------------------------------------
    // Ô ĐỊNH TÍNH (Bạch cầu/Hồng cầu/Protein/Glucose/Thể
    // cetonic/Bilirubin/Urobilinogen niệu) - cổng nhập liệu
    // có 2 kiểu tuỳ mẫu:
    // - Kiểu cũ (spinbutton, M4 hiện tại): vẫn điền SỐ như
    //   bình thường, kể cả khi giá trị là 0.
    // - Kiểu mới (combobox, M3 sau khi cập nhật): nếu kết quả
    //   là 0 -> điền chữ "Âm Tính"; khác 0 -> vẫn điền số.
    // -----------------------------------------------------------

    const QUALITATIVE_URINE_COLUMNS =
        [
            'LEU', 'BLD', 'PRO', 'GLU', 'KET', 'BIL', 'URO'
        ];

    async function setQualitativeFieldValue(
        inputInfo,
        rawValue
    ) {

        if (
            !inputInfo ||
            !inputInfo.element
        ) {

            return false;
        }

        const val =
            (rawValue === undefined || rawValue === null)
                ? ''
                : String(rawValue).trim();

        if (val === '') {

            return false;
        }

        const n =
            parseNumberLoose(
                val
            );

        // -----------------------------------------------------
        // PORTAL MỚI: ô định tính có thể đã đổi thành hnumberbox
        // / dx-number-box nhưng input bên trong vẫn là type=text.
        //
        // Với kiểu này KHÔNG được thử gõ "Negative" trước:
        // input DOM có thể tạm giữ chữ nên code tưởng đã thành công,
        // nhưng DevExtreme NumberBox không nhận vào model và sau đó
        // tự xóa -> nhìn như Glucose không được điền.
        //
        // Nếu là spinbutton hoặc nằm trong dx-numberbox => đây là
        // Ô SỐ, điền số trực tiếp, kể cả giá trị 0.
        // -----------------------------------------------------
        const isNumericNumberBox =
            inputInfo.role === 'spinbutton' ||
            !!inputInfo.element.closest('.dx-numberbox') ||
            !!inputInfo.element.closest('dx-number-box') ||
            !!inputInfo.element.closest('hnumberbox');

        if (isNumericNumberBox) {

            return await setNumberBoxValue(
                inputInfo.element,
                val
            );
        }

        // Chỉ các ô kiểu combobox/text định tính mới dùng Negative
        if (
            !isNaN(n) &&
            n === 0
        ) {

            await dispatchInputValue(
                inputInfo.element,
                'Negative'
            );

            await sleep(
                80
            );

            const displayed =
                (inputInfo.element.value || '').trim();

            if (
                displayed.toLowerCase().includes(
                    'negative'
                )
            ) {

                return true;
            }

            return await setNumberBoxValue(
                inputInfo.element,
                '0'
            );
        }

        return await setNumberBoxValue(
            inputInfo.element,
            val
        );
    }


    // -----------------------------------------------------------
    // KIỂM TRA + TỰ THỬ LẠI SAU KHI ĐIỀN (áp dụng cho MỌI loại
    // ô, không cần biết trước là kiểu ô nào) - đọc lại giá trị
    // thật đang hiển thị, so với giá trị vừa gõ. Nếu lệch, thử
    // gõ lại 1 lần. Nhờ đây script tự thích ứng được với các
    // kiểu ô mới cổng nhập liệu có thể đổi sang trong tương
    // lai mà không cần biết trước hay sửa code.
    // -----------------------------------------------------------

    async function fillAndVerify(
        inputInfo,
        label,
        valueToFill,
        setterFn
    ) {

        await setterFn();

        for (
            let attempt = 0;
            attempt < 2;
            attempt++
        ) {

            await sleep(
                attempt === 0 ? 100 : 150
            );

            const actualDisplayed =
                (inputInfo.element.value || '').trim();

            const expectedDigits =
                valueToFill.toString().replace(
                    /[^\d]/g,
                    ''
                );

            const actualDigits =
                actualDisplayed.replace(
                    /[^\d]/g,
                    ''
                );

            const looksOk =
                !expectedDigits ||
                actualDigits === expectedDigits ||
                actualDisplayed.toLowerCase().includes(
                    'negative'
                );

            if (looksOk) {

                return true;
            }

            if (attempt === 0) {

                warn(
                    `⚠️ Lệch giá trị ở "${label}" (gõ ` +
                    `"${valueToFill}" nhưng thấy ` +
                    `"${actualDisplayed}") - thử gõ lại...`
                );

                await setterFn();
            }
        }

        warn(
            `⚠️ VẪN SAI SAU KHI THỬ LẠI: "${label}" - đã gõ ` +
            `"${valueToFill}" nhưng ô hiện ` +
            `"${(inputInfo.element.value || '').trim()}"`
        );

        return false;
    }


    // -----------------------------------------------------------
    // NITRIT (radio Âm tính/Dương tính) - dựa vào cột NIT
    // 0 hoặc rỗng = Âm tính, còn lại (VD +) = Dương tính
    // -----------------------------------------------------------

    function findRadioNearLabel(
        labelEl,
        answerText
    ) {

        const answerNorm =
            norm(answerText);

        let current =
            labelEl;

        for (
            let level = 0;
            level < 12;
            level++
        ) {

            if (!current) {
                break;
            }

            const radios = [
                ...current.querySelectorAll(
                    '.dx-item.dx-radiobutton'
                )
            ];

            const match =
                radios.find(
                    r => {

                        const c =
                            r.querySelector(
                                '.dx-item-content'
                            );

                        if (!c) {
                            return false;
                        }

                        return (
                            norm(c.textContent) ===
                            answerNorm
                        );
                    }
                );

            if (match) {

                return match;
            }

            current =
                current.parentElement;
        }

        return null;
    }

    async function fillNitrit(
        data,
        scope
    ) {

        const nitValue =
            getDataValueByColumn(
                data,
                'NIT'
            );

        // Ô trống = CHƯA CÓ KẾT QUẢ, không phải Âm tính -
        // trước đây mặc định coi trống = Âm tính là SAI, có
        // thể điền nhầm khi Khoa XN chưa trả kết quả Nitrit.
        if (
            nitValue === undefined ||
            nitValue === ''
        ) {

            warn(
                'Nitrit: sheet chưa có kết quả (bỏ qua, không tự điền)'
            );

            return {
                filled: false,
                missing: true
            };
        }

        const trimmedNit =
            nitValue.toString().trim();

        const isPositive =
            trimmedNit !== '0';

        const answerText =
            isPositive
                ? 'dương tính'
                : 'âm tính';

        const labelEls =
            findLabelElements(
                'Nitrit'
            ).filter(
                el =>
                    isElInScope(
                        el,
                        scope
                    )
            );

        if (
            !labelEls.length
        ) {

            warn(
                'Không tìm thấy nhãn Nitrit'
            );

            return {
                filled: false,
                missing: false,
                notFound: true
            };
        }

        const radio =
            findRadioNearLabel(
                labelEls[0],
                answerText
            );

        if (!radio) {

            warn(
                'Không tìm thấy radio Nitrit:',
                answerText
            );

            return {
                filled: false,
                missing: false,
                notFound: true
            };
        }

        const checked =
            radio.getAttribute(
                'aria-checked'
            ) === 'true';

        if (checked) {

            log(
                'Nitrit đã chọn sẵn:',
                answerText
            );

            return {
                filled: true
            };
        }

        robustClick(
            radio
        );

        await sleep(
            FAST_DELAY + 30
        );

        log(
            '✓ Đã chọn Nitrit:',
            answerText
        );

        return {
            filled: true
        };
    }


    // =========================================================
    // =========================================================
    //          M5 / M6 (Khám sức khỏe Người lái xe / Ô tô)
    //
    // 2 route khác nhau (kskdk_NguoiLaiXe, kskdk_Oto) nhưng
    // cấu trúc trang GIỐNG HỆT NHAU - dùng chung 1 bộ logic.
    //
    // - Tiền sử: TÁI DÙNG autoM3TienSu() (đã xác nhận chạy
    //   đúng qua nút AUTO M3 có sẵn).
    // - Khám lâm sàng, mỗi khoa:
    //   + "Chưa phát hiện bất thường" -> TÁI DÙNG
    //     autoM3ChuaPhatHien()
    //   + "Phân loại" (checkbox vuông Loại I-V) -> TÁI DÙNG
    //     autoM2LoaiICheckbox()
    //   + "Kết luận" (dropdown-select, MỚI) -> chọn
    //     "Đủ điều kiện sức khỏe"
    //   + "Từ chối khám" (Sản khoa/Phụ khoa, checkbox) -> MỚI,
    //     tick hết
    // =========================================================


    // -----------------------------------------------------------
    // TÌM NHÃN <b> KHỚP CHÍNH XÁC (bỏ dấu * bắt buộc ở cuối
    // nếu có, VD "Kết luận *" -> "kết luận")
    // -----------------------------------------------------------

    function findLabelsByExactText(
        targetText
    ) {

        const target =
            norm(
                targetText
            );

        return [
            ...document.querySelectorAll(
                'b'
            )
        ].filter(
            b => {

                const text =
                    norm(
                        b.textContent
                    ).replace(
                        /\*\s*$/,
                        ''
                    ).trim();

                return (
                    text === target
                );
            }
        );
    }


    // -----------------------------------------------------------
    // TÍCH HẾT CHECKBOX THEO NHÃN (dùng cho "Từ chối khám")
    // Tái dùng cấu trúc giống findChuaPhatHienCheckboxes nhưng
    // tổng quát hoá theo nhãn bất kỳ.
    // -----------------------------------------------------------

    function findCheckboxesByLabelText(
        targetText
    ) {

        const labels =
            findLabelsByExactText(
                targetText
            );

        const result =
            [];

        labels.forEach(
            label => {

                let current =
                    label;

                for (
                    let level = 0;
                    level < 10;
                    level++
                ) {

                    if (!current) {
                        break;
                    }

                    const checkbox =
                        current.querySelector(
                            '.dx-checkbox'
                        );

                    if (checkbox) {

                        if (
                            !result.some(
                                x =>
                                    x.checkbox ===
                                    checkbox
                            )
                        ) {

                            result.push({
                                label,
                                checkbox
                            });
                        }

                        return;
                    }

                    current =
                        current.parentElement;
                }
            }
        );

        return result;
    }

    async function autoCheckAllByLabelText(
        targetText
    ) {

        const items =
            findCheckboxesByLabelText(
                targetText
            );

        log(
            `Tìm thấy ${items.length} checkbox "${targetText}"`
        );

        let count = 0;
        let skipped = 0;

        for (
            const item of items
        ) {

            const isChecked =
                item.checkbox.classList.contains(
                    'dx-checkbox-checked'
                ) ||
                item.checkbox.getAttribute(
                    'aria-checked'
                ) === 'true';

            if (isChecked) {

                skipped++;

                continue;
            }

            fastClick(
                item.checkbox
            );

            count++;

            await sleep(
                FAST_DELAY
            );
        }

        return {
            found: items.length,
            count,
            skipped
        };
    }


    // -----------------------------------------------------------
    // DROPDOWN-SELECT (VD "Kết luận") - readonly, phải click
    // MỞ danh sách rồi click ĐÚNG dòng khớp, không gõ chữ trực
    // tiếp được như ô combobox thường.
    // -----------------------------------------------------------

    // Chờ chủ động cho tới khi thấy item khớp trong dropdown
    // xuất hiện (thay vì sleep cố định) - trả về phần tử khớp
    // hoặc null nếu hết thời gian chờ mà không thấy
    async function selectDropdownOption(
        inputEl,
        optionText
    ) {

        if (!inputEl) {

            return false;
        }

        // Đã đúng giá trị sẵn rồi thì thôi
        if (
            norm(
                inputEl.value
            ) ===
            norm(
                optionText
            )
        ) {

            return true;
        }

        // Mở dropdown
        robustClick(
            inputEl
        );

        await sleep(
            200
        );

        const targetNorm =
            norm(
                optionText
            );

        // Tìm ĐÚNG popup thuộc về input này qua aria-owns -
        // mỗi ô "Kết luận" có popup RIÊNG lồng ngay trong
        // chính nó (không dùng chung 1 popup cho cả trang),
        // và input có sẵn aria-owns trỏ thẳng tới id của danh
        // sách thuộc về nó. Cách này CHẮC CHẮN đúng scope,
        // không phụ thuộc offsetParent/display (DevExtreme ẩn
        // popup bằng opacity/dx-state-invisible, không phải
        // display:none, nên offsetParent không đáng tin ở đây)
        const ownsId =
            inputEl.getAttribute(
                'aria-owns'
            );

        let scope =
            ownsId
                ? document.getElementById(
                    ownsId
                )
                : null;

        if (!scope) {

            scope =
                inputEl.closest(
                    '.dx-select-box'
                ) ||
                inputEl.closest(
                    '.dx-selectbox'
                ) ||
                document;
        }

        const items = [
            ...scope.querySelectorAll(
                '.dx-item.dx-list-item, .dx-item'
            )
        ];

        const match =
            items.find(
                el => {

                    const content =
                        el.querySelector(
                            '.dx-item-content'
                        ) ||
                        el;

                    return (
                        norm(
                            content.textContent
                        ) ===
                        targetNorm
                    );
                }
            );

        if (!match) {

            warn(
                'Không tìm thấy lựa chọn trong dropdown:',
                optionText
            );

            // Đóng dropdown lại (bấm ra ngoài input)
            inputEl.blur();

            await sleep(
                100
            );

            return false;
        }

        robustClick(
            match
        );

        await sleep(
            150
        );

        return true;
    }

    async function autoSelectAllKetLuan(
        optionText
    ) {

        const labels =
            findLabelsByExactText(
                'Kết luận'
            );

        log(
            `Tìm thấy ${labels.length} ô "Kết luận"`
        );

        let count = 0;
        let skipped = 0;
        let notFound = 0;

        for (
            const label of labels
        ) {

            const inputInfo =
                findNumberInputForLabel(
                    label
                );

            if (
                !inputInfo ||
                inputInfo.role !== 'combobox'
            ) {

                notFound++;

                continue;
            }

            const alreadyOk =
                norm(
                    inputInfo.element.value
                ) ===
                norm(
                    optionText
                );

            if (alreadyOk) {

                skipped++;

                continue;
            }

            const ok =
                await selectDropdownOption(
                    inputInfo.element,
                    optionText
                );

            if (ok) {

                count++;

            } else {

                notFound++;
            }
        }

        return {
            found: labels.length,
            count,
            skipped,
            notFound
        };
    }


    // -----------------------------------------------------------
    // M5/M6 - KHÁM LÂM SÀNG (gộp cả 4 việc)
    // -----------------------------------------------------------

    async function autoM5M6KhamLamSang() {

        log(
            '================================'
        );

        log(
            '🚀 M5/M6 - AUTO KHÁM LÂM SÀNG'
        );

        log(
            '================================'
        );

        // 1. Chưa phát hiện bất thường (tái dùng M3)
        await autoM3ChuaPhatHien();

        await sleep(
            FAST_DELAY
        );

        // 2. Loại I - checkbox (tái dùng M2)
        const loaiIResult =
            await autoM2LoaiICheckbox();

        // 3. Kết luận -> Đủ điều kiện sức khỏe
        const ketLuanResult =
            await autoSelectAllKetLuan(
                'Đủ điều kiện sức khỏe'
            );

        // 4. Từ chối khám (Sản khoa/Phụ khoa)
        const tuChoiResult =
            await autoCheckAllByLabelText(
                'Từ chối khám'
            );

        autoAlert(
            '✅ M5/M6 - Đã Auto Fill Khám lâm sàng!\n\n' +
            '✓ Chưa phát hiện bất thường\n' +
            `✓ Loại I - tổng ${loaiIResult.found}, ` +
            `đã chọn ${loaiIResult.count}\n` +
            `✓ Kết luận - tổng ${ketLuanResult.found}, ` +
            `đã chọn ${ketLuanResult.count}, ` +
            `đã sẵn ${ketLuanResult.skipped}` +
            (
                ketLuanResult.notFound
                    ? `, lỗi ${ketLuanResult.notFound}`
                    : ''
            ) +
            '\n' +
            `✓ Từ chối khám - tổng ${tuChoiResult.found}, ` +
            `đã chọn ${tuChoiResult.count}\n\n` +
            'Vui Lòng Kiểm Tra Trước Khi Lưu.\n'
        );
    }


    // -----------------------------------------------------------
    // M5/M6 - HÀM CHÍNH (tự nhận tab qua nội dung trang, giống
    // cách M3/M4 đang làm)
    // -----------------------------------------------------------

    async function autoM5M6() {

        const bodyText =
            norm(
                document.body.innerText
            );

        if (
            bodyText.includes(
                'chưa phát hiện bất thường'
            )
        ) {

            await autoM5M6KhamLamSang();

        } else {

            // Mặc định Tiền sử - tái dùng M3 (đã xác nhận
            // chạy đúng)
            await autoM3TienSu();
        }
    }


    function createM5M6Button() {

        if (
            document.getElementById(
                'medinet-auto-m5m6'
            )
        ) {

            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.id =
            'medinet-auto-m5m6';

        button.innerText =
            '🚀 AUTO M5/M6';

        button.className =
            'medinet-toolbar-btn';

        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '320px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#0d9488',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );

        button.addEventListener(
            'click',
            async function () {

                if (
                    button.disabled
                ) {

                    return;
                }

                button.disabled =
                    true;

                button.innerText =
                    '⏳ M5/M6...';

                try {

                    await autoM5M6();

                } catch (e) {

                    console.error(
                        LOG,
                        e
                    );

                    autoAlert(
                        '❌ Lỗi AUTO M5/M6.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );

                } finally {

                    button.disabled =
                        false;

                    button.innerText =
                        '🚀 AUTO M5/M6';
                }
            }
        );

        document.body.appendChild(
            button
        );
    }




    function normalizeColKey(s) {

        return (s || '')
            .toString()
            .toLowerCase()
            .replace(
                /\s+/g,
                ''
            );
    }

    function getDataValueByColumn(
        data,
        column
    ) {

        if (
            data[column] !== undefined
        ) {

            return data[column];
        }

        const target =
            normalizeColKey(
                column
            );

        const foundKey =
            Object.keys(
                data
            ).find(
                k =>
                    normalizeColKey(k) ===
                    target
            );

        return (
            foundKey
                ? data[foundKey]
                : undefined
        );
    }


    // -----------------------------------------------------------
    // ĐIỀN TẤT CẢ Ô SỐ THEO CAN_LAM_SANG_FIELD_MAP
    // -----------------------------------------------------------

    // -----------------------------------------------------------
    // TỈ TRỌNG NƯỚC TIỂU (S.G) - sheet ghi dạng số nguyên nhân
    // 1000 (VD "1024" nghĩa là 1.024) vì máy XN xuất ra kiểu
    // đó. Form cần giá trị thật (1.024), nên phải chia lại cho
    // 1000 TRƯỚC khi điền - chỉ áp dụng khi sheet chưa có dấu
    // thập phân sẵn (phòng khi sau này sheet đổi cách ghi).
    // -----------------------------------------------------------

    function normalizeSpecificGravity(
        rawValue
    ) {

        const str =
            String(rawValue).trim();

        if (
            str.includes('.') ||
            str.includes(',')
        ) {

            return str;
        }

        const n =
            parseFloat(str);

        if (
            isNaN(n)
        ) {

            return str;
        }

        // Tỉ trọng nước tiểu bình thường 1.000-1.060, ghi kiểu
        // nguyên sẽ rơi vào khoảng 1000-1060
        if (
            n >= 1000 &&
            n <= 1060
        ) {

            return String(
                n / 1000
            );
        }

        return str;
    }


    async function fillNumberFieldsInScope(
        data,
        scope
    ) {

        let filled = 0;
        let skippedEmpty = 0;
        let notFound = 0;

        const skippedLabels =
            [];

        const notFoundLabels =
            [];

        for (
            const { label, column } of CAN_LAM_SANG_FIELD_MAP
        ) {

            const labelEls =
                column === 'Glucose'
                    ? findBloodGlucoseLabelElements(
                        scope
                    )
                    : findLabelElements(
                        label
                    ).filter(
                        el =>
                            isElInScope(
                                el,
                                scope
                            )
                    );

            if (
                !labelEls.length
            ) {

                notFound++;

                notFoundLabels.push(
                    label
                );

                warn(
                    'Không tìm thấy nhãn:',
                    label
                );

                continue;
            }

            const inputInfo =
                findNumberInputForLabel(
                    labelEls[0]
                );

            if (!inputInfo) {

                notFound++;

                notFoundLabels.push(
                    label
                );

                warn(
                    'Không tìm thấy ô nhập cho:',
                    label
                );

                continue;
            }

            const value =
                getDataValueByColumn(
                    data,
                    column
                );

            if (
                value === undefined
            ) {

                warn(
                    `Không tìm thấy cột "${column}" trong sheet ` +
                    `(cho nhãn "${label}"). Các cột hiện có:`,
                    Object.keys(data)
                );
            }

            if (
                value === undefined ||
                value === ''
            ) {

                skippedEmpty++;

                skippedLabels.push(
                    label
                );

                continue;
            }

            let valueToFill =
                value;

            if (
                column === 'S.G'
            ) {

                valueToFill =
                    normalizeSpecificGravity(
                        value
                    );
            }

            const setterFn =
                async () => {

                    if (
                        column === 'S.G'
                    ) {

                        // KHÔNG làm tròn - Tỉ trọng cần đủ 3
                        // số thập phân (1.005-1.030), làm tròn
                        // 1 số sẽ mất hết ý nghĩa
                        await dispatchInputValue(
                            inputInfo.element,
                            valueToFill.toString().replace(
                                '.',
                                ','
                            )
                        );

                    } else if (
                        QUALITATIVE_URINE_COLUMNS.includes(
                            column
                        )
                    ) {

                        await setQualitativeFieldValue(
                            inputInfo,
                            valueToFill
                        );

                    } else if (
                        column === 'Glucose'
                    ) {

                        await setBloodGlucoseValue(
                            inputInfo.element,
                            valueToFill
                        );

                    } else {

                        await setNumberBoxValue(
                            inputInfo.element,
                            valueToFill
                        );
                    }
                };

            await fillAndVerify(
                inputInfo,
                label,
                valueToFill,
                setterFn
            );

            filled++;

            log(
                `✓ ${label} = ${valueToFill}`
            );

            await sleep(
                FAST_DELAY
            );
        }

        return {
            filled,
            skippedEmpty,
            notFound,
            skippedLabels,
            notFoundLabels
        };
    }


    // -----------------------------------------------------------
    // KHOẢNG BÌNH THƯỜNG - theo nguồn Việt Nam (Viện Huyết học -
    // Truyền máu TW, Vinmec, Bệnh viện Thu Cúc...) + GỢI Ý MÃ
    // ICD-10 KHI BẤT THƯỜNG.
    //
    // Có phân biệt Nam/Nữ ở các chỉ số có khác biệt rõ rệt
    // (maleMin/maleMax, femaleMin/femaleMax) - nếu không rõ
    // giới tính sẽ dùng min/max chung (khoảng gộp cả 2 giới).
    //
    // ⚠️ CHỈ MANG TÍNH THAM KHẢO CHUNG - khoảng bình thường có
    // thể khác nhau tuỳ máy xét nghiệm/phòng lab. KHÔNG thay
    // thế chẩn đoán của bác sĩ. Script chỉ hiện gợi ý, không
    // tự điền bất cứ đâu.
    // -----------------------------------------------------------

    const CAN_LAM_SANG_REFERENCE = [
        {
            column: 'RBC', label: 'Số lượng HC',
            min: 4.0, max: 5.4,
            maleMin: 4.2, maleMax: 5.4,
            femaleMin: 4.0, femaleMax: 4.9,
            low: { code: 'D64.9', name: 'Thiếu máu chưa xác định' },
            high: { code: 'D75.1', name: 'Đa hồng cầu thứ phát' }
        },
        {
            column: 'HGB', label: 'Huyết sắc tố',
            min: 120, max: 160,
            maleMin: 130, maleMax: 160,
            femaleMin: 120, femaleMax: 142,
            low: { code: 'D64.9', name: 'Thiếu máu' }
        },
        {
            column: 'HCT', label: 'Hematocrit',
            min: 0.37, max: 0.52,
            maleMin: 0.45, maleMax: 0.52,
            femaleMin: 0.37, femaleMax: 0.48,
            low: { code: 'D64.9', name: 'Thiếu máu' },
            high: { code: 'D75.1', name: 'Đa hồng cầu' }
        },
        {
            column: 'MCV', label: 'MCV',
            min: 85, max: 95,
            low: { code: 'D50.9', name: 'Thiếu máu hồng cầu nhỏ (gợi ý thiếu sắt)' },
            high: { code: 'D53.9', name: 'Thiếu máu hồng cầu to' }
        },
        { column: 'MCH', label: 'MCH', min: 28, max: 32 },
        { column: 'MCHC', label: 'MCHC', min: 320, max: 360 },
        { column: 'RDW', label: 'RDW', min: 10, max: 16.5 },
        {
            column: 'WBC', label: 'Số lượng bạch cầu',
            min: 4.0, max: 10.0,
            low: { code: 'D72.8', name: 'Giảm bạch cầu' },
            high: { code: 'D72.8', name: 'Tăng bạch cầu' }
        },
        { column: 'NEU#', label: 'BC trung tính', min: 1.7, max: 7.0 },
        { column: 'LYM#', label: 'BC lympho', min: 1.0, max: 4.0 },
        { column: 'MONO#', label: 'BC đơn nhân', min: 0.1, max: 1.0 },
        {
            column: 'EOS#', label: 'BC ái toan',
            min: 0.0, max: 0.5,
            high: { code: 'D72.1', name: 'Tăng bạch cầu ái toan' }
        },
        { column: 'BASO#', label: 'BC ái kiềm', min: 0.0, max: 0.1 },
        {
            column: 'PLT', label: 'Tiểu cầu',
            min: 150, max: 400,
            low: { code: 'D69.6', name: 'Giảm tiểu cầu' },
            high: { code: 'D75.2', name: 'Tăng tiểu cầu' }
        },
        {
            column: 'Glucose', label: 'Đường máu',
            min: 3.9, max: 6.4,
            low: { code: 'E16.2', name: 'Hạ đường huyết' },
            high: { code: 'R73.9', name: 'Tăng đường huyết - theo dõi đái tháo đường' }
        },
        {
            column: 'Ure', label: 'Urê',
            min: 2.5, max: 7.5,
            high: { code: 'R79.8', name: 'Tăng ure máu' }
        },
        {
            column: 'Creatinine', label: 'Creatinin',
            min: 44, max: 106,
            maleMin: 62, maleMax: 106,
            femaleMin: 44, femaleMax: 80,
            high: { code: 'N19', name: 'Suy giảm chức năng thận' }
        },
        {
            column: 'AST', label: 'ASAT(GOT)',
            min: 0, max: 50,
            maleMin: 0, maleMax: 50,
            femaleMin: 0, femaleMax: 35,
            high: { code: 'R74.0', name: 'Tăng men gan' }
        },
        {
            column: 'ALT', label: 'ALAT(GPT)',
            min: 0, max: 50,
            maleMin: 0, maleMax: 50,
            femaleMin: 0, femaleMax: 35,
            high: { code: 'R74.0', name: 'Tăng men gan' }
        },
        { column: 'S.G', label: 'Tỉ trọng nước tiểu', min: 1.005, max: 1.030 },
        { column: 'pH', label: 'pH nước tiểu', min: 5.0, max: 8.0 },
        {
            column: 'LEU', label: 'Bạch cầu niệu',
            min: 0, max: 0,
            high: { code: 'N39.0', name: 'Nhiễm khuẩn đường tiết niệu' }
        },
        {
            column: 'BLD', label: 'Hồng cầu niệu',
            min: 0, max: 0,
            high: { code: 'R31', name: 'Tiểu máu' }
        },
        {
            column: 'PRO', label: 'Protein niệu',
            min: 0, max: 0,
            high: { code: 'R80', name: 'Protein niệu' }
        },
        {
            column: 'GLU', label: 'Glucose niệu',
            min: 0, max: 0,
            high: { code: 'R81', name: 'Đường niệu' }
        },
        {
            column: 'KET', label: 'Thể cetonic niệu',
            min: 0, max: 0,
            high: { code: 'R82.4', name: 'Ceton niệu' }
        },
        {
            column: 'BIL', label: 'Bilirubin niệu',
            min: 0, max: 0,
            high: { code: 'R82.2', name: 'Bilirubin niệu' }
        },
        {
            column: 'URO', label: 'Urobilinogen niệu',
            min: 0, max: 17,
            high: { code: 'R82.2', name: 'Tăng urobilinogen niệu' }
        }
    ];


    // Lấy đúng khoảng (nam/nữ) theo giới tính, hoặc khoảng
    // chung nếu chỉ số không phân biệt giới hoặc không rõ giới
    function getRefRange(
        ref,
        gioiTinhRaw
    ) {

        if (
            gioiTinhRaw === 'M' &&
            ref.maleMin !== undefined
        ) {

            return {
                min: ref.maleMin,
                max: ref.maleMax
            };
        }

        if (
            gioiTinhRaw === 'F' &&
            ref.femaleMin !== undefined
        ) {

            return {
                min: ref.femaleMin,
                max: ref.femaleMax
            };
        }

        return {
            min: ref.min,
            max: ref.max
        };
    }


    function parseNumberLoose(val) {

        if (
            val === undefined ||
            val === null
        ) {

            return NaN;
        }

        const s =
            String(val)
                .trim()
                .replace(
                    ',',
                    '.'
                );

        if (s === '') {

            return NaN;
        }

        return parseFloat(s);
    }


    function checkAbnormalResults(
        data
    ) {

        const gioiTinhRaw =
            (
                getDataValueByColumn(
                    data,
                    'Giới tính'
                ) || ''
            ).toString().trim().toUpperCase();

        const findings =
            [];

        for (
            const ref of CAN_LAM_SANG_REFERENCE
        ) {

            const rawOriginal =
                getDataValueByColumn(
                    data,
                    ref.column
                );

            const raw =
                ref.column === 'S.G'
                    ? normalizeSpecificGravity(
                        rawOriginal
                    )
                    : rawOriginal;

            const n =
                parseNumberLoose(
                    raw
                );

            if (
                isNaN(n)
            ) {

                continue;
            }

            const range =
                getRefRange(
                    ref,
                    gioiTinhRaw
                );

            const rangeText =
                `${range.min}-${range.max}`;

            if (
                range.min !== undefined &&
                n < range.min &&
                ref.low
            ) {

                findings.push({
                    label: ref.label,
                    value: formatRoundedDisplay(raw),
                    direction: 'thấp',
                    rangeText,
                    code: ref.low.code,
                    name: ref.low.name
                });

            } else if (
                range.max !== undefined &&
                n > range.max &&
                ref.high
            ) {

                findings.push({
                    label: ref.label,
                    value: formatRoundedDisplay(raw),
                    direction: 'cao',
                    rangeText,
                    code: ref.high.code,
                    name: ref.high.name
                });
            }
        }

        // Nitrit - xử lý riêng vì là định tính (Âm/Dương tính)
        const nit =
            (data['NIT'] || '').toString().trim();

        if (
            nit !== '' &&
            nit !== '0'
        ) {

            findings.push({
                label: 'Nitrit',
                value: 'Dương tính',
                direction: null,
                rangeText: 'Âm tính',
                code: 'N39.0',
                name: 'Nhiễm khuẩn đường tiết niệu'
            });
        }

        return findings;
    }


    // -----------------------------------------------------------
    // HÀM CHÍNH - KHÁM CẬN LÂM SÀNG
    // -----------------------------------------------------------

    // Lưu lại báo cáo gần nhất để xem lại mà không cần nhập
    // lại SID/tên
    let lastCanLamSangReport =
        null;
    let lastCanLamSangReportPatientKey =
        "";
    const LAST_CLS_REPORT_STORAGE_KEY =
        'medinet-auto-last-cls-report-v760';

    async function autoCanLamSang() {

        const searchInput =
            await searchPatientModal();

        if (!searchInput) {

            return;
        }

        let matches;
        let searchDesc;
        let isFullCriteriaSearch =
            false;

        try {

            if (
                searchInput.mode === 'sid'
            ) {

                log(
                    '🚀 AUTO KHÁM CẬN LÂM SÀNG - SID:',
                    searchInput.sid
                );

                matches =
                    await findLabRowsBySid(
                        searchInput.sid
                    );

                searchDesc =
                    `SID "${searchInput.sid}"`;

            } else {

                log(
                    '🚀 AUTO KHÁM CẬN LÂM SÀNG - Họ tên:',
                    searchInput.hoTen,
                    'Năm sinh:',
                    searchInput.namSinh,
                    'Giới tính:',
                    searchInput.gioiTinh
                );

                matches =
                    await findLabRowsByNameYearGender(
                        searchInput.hoTen,
                        searchInput.namSinh,
                        searchInput.gioiTinh
                    );

                const gioiTinhText =
                    searchInput.gioiTinh === 'M'
                        ? 'Nam'
                        : (
                            searchInput.gioiTinh === 'F'
                                ? 'Nữ'
                                : null
                        );

                searchDesc =
                    `"${searchInput.hoTen}"` +
                    (
                        searchInput.namSinh
                            ? ` (sinh ${searchInput.namSinh})`
                            : ''
                    ) +
                    (
                        gioiTinhText
                            ? ` - ${gioiTinhText}`
                            : ''
                    );

                // Đã nhập ĐỦ CẢ 3: tên + năm sinh + giới tính
                isFullCriteriaSearch =
                    !!(
                        searchInput.namSinh &&
                        searchInput.gioiTinh
                    );
            }

        } catch (e) {

            console.error(
                LOG,
                e
            );

            await infoModal(
                '❌ Lỗi tải dữ liệu',
                `<div>${e.message}</div>` +
                `<div class="mnm-note">${KHOA_XN_CONTACT_MSG}</div>`,
                'mnm-warn'
            );

            return;
        }

        if (
            !matches ||
            !matches.length
        ) {

            await infoModal(
                '⚠️ Không tìm thấy kết quả',
                '<div class="mnm-result-empty">' +
                '<div class="mnm-result-empty-title">Không có dữ liệu phù hợp với thông tin vừa nhập.</div>' +
                `<div class="mnm-result-empty-desc"><span>Đã tìm:</span><b>${searchDesc}</b></div>` +
                '<div class="mnm-result-empty-help">Hãy kiểm tra lại SID hoặc thông tin bệnh nhân rồi thử lại.</div>' +
                `<div class="mnm-note">Nếu vẫn không tìm thấy, ${KHOA_XN_CONTACT_MSG.toLowerCase()}.</div>` +
                '</div>',
                'mnm-warn'
            );

            return;
        }

        // -----------------------------------------------------
        // ĐÃ NHẬP ĐỦ TÊN + NĂM SINH + GIỚI TÍNH MÀ VẪN TRÙNG
        // NHIỀU HƠN 1 KẾT QUẢ -> KHÔNG cho chọn tuỳ ý (rủi ro
        // điền nhầm bệnh nhân), bắt buộc quay lại nhập SID
        // hoặc liên hệ Khoa Xét nghiệm.
        // -----------------------------------------------------

        if (
            isFullCriteriaSearch &&
            matches.length > 1
        ) {

            await infoModal(
                '⛔ Trùng thông tin - không thể tự xác định',
                `<div>Có ${matches.length} bệnh nhân trùng cả Họ tên, ` +
                'Năm sinh và Giới tính với thông tin đã nhập.</div>' +
                '<div style="margin-top:10px;font-weight:600;">' +
                'Vui lòng tìm lại bằng SID để đảm bảo đúng bệnh nhân.</div>' +
                `<div class="mnm-note">${KHOA_XN_CONTACT_MSG}</div>`,
                'mnm-warn'
            );

            return;
        }

        let data;

        if (
            matches.length === 1
        ) {

            data =
                matches[0];

        } else {

            data =
                await pickFromMultipleMatches(
                    matches,
                    searchDesc
                );

            if (!data) {

                log(
                    'Người dùng huỷ chọn kết quả trùng.'
                );

                return;
            }
        }

        log(
            'Dữ liệu đã chọn:',
            data
        );


        // -----------------------------------------------------
        // XÁC NHẬN ĐÚNG BỆNH NHÂN TRƯỚC KHI ĐIỀN
        // (tránh điền nhầm do gõ sai/nhầm SID/trùng tên)
        // -----------------------------------------------------

        const tenBenhNhan =
            getDataValueByColumn(
                data,
                'Tên bệnh nhân'
            ) || '(không rõ)';

        const tuoi =
            getDataValueByColumn(
                data,
                'Tuổi'
            ) || '?';

        const gioiTinhRaw =
            (
                getDataValueByColumn(
                    data,
                    'Giới tính'
                ) || ''
            ).toString().trim().toUpperCase();

        const gioiTinh =
            gioiTinhRaw === 'F'
                ? 'Nữ'
                : (
                    gioiTinhRaw === 'M'
                        ? 'Nam'
                        : (gioiTinhRaw || '?')
                );

        const sidThat =
            getDataValueByColumn(
                data,
                'SID'
            ) || '?';

        const xacNhan =
            await confirmModal(
                '🔎 Đã tìm thấy bệnh nhân',
                '<div class="mnm-patient-card">' +
                `<span>SID</span><b>${sidThat}</b>` +
                `<span>Họ tên</span><b>${tenBenhNhan}</b>` +
                `<span>Tuổi</span><b>${tuoi}</b>` +
                `<span>Giới tính</span><b>${gioiTinh}</b>` +
                '</div>' +
                '<div class="mnm-note" style="margin-top:12px;">' +
                'Kiểm tra kỹ trước khi điền - bấm "Xác nhận" để ' +
                'tiến hành, "Huỷ" nếu sai bệnh nhân.</div>'
            );

        if (!xacNhan) {

            log(
                'Người dùng huỷ - không điền.'
            );

            return;
        }


        // Xác định khung 2 (M3 có 2 khung, M4 chỉ 1 khung)
        const scope =
            getKhungScope(
                'khám sức khỏe định kỳ'
            );

        if (scope) {

            log(
                'Đã xác định khung "2. Khám sức khỏe định kỳ" - CHỈ điền trong khung này'
            );

        } else {

            log(
                'Không có khung đánh số nhiều mục - điền toàn trang (dạng 1 khung)'
            );
        }

        const result =
            await fillNumberFieldsInScope(
                data,
                scope
            );

        const nitritResult =
            await fillNitrit(
                data,
                scope
            );


        // -----------------------------------------------------
        // GỘP DANH SÁCH THÔNG SỐ THIẾU (sheet chưa có kết quả)
        // -----------------------------------------------------

        const missingLabels =
            result.skippedLabels.filter(
                l =>
                    !MISSING_WARNING_EXCLUDE.includes(
                        l
                    )
            );

        if (
            nitritResult.missing &&
            !MISSING_WARNING_EXCLUDE.includes(
                'Nitrit'
            )
        ) {

            missingLabels.push(
                'Nitrit'
            );
        }


        // -----------------------------------------------------
        // LƯU LẠI BÁO CÁO để xem lại sau (nút "XEM CẢNH BÁO")
        // -----------------------------------------------------

        const findings =
            checkAbnormalResults(
                data
            );

        lastCanLamSangReport = {
            tenBenhNhan,
            tuoi,
            gioiTinh,
            sidThat,
            result,
            findings,
            missingLabels,
            time: new Date()
        };
        lastCanLamSangReportPatientKey = getCurrentPatientKey();
        saveLastCanLamSangReport();

        // Đồng bộ dấu cảnh báo lên nút AUTO tròn.
        updateUnifiedAutoButton();

        log(
            `✓ Hoàn tất: ${tenBenhNhan} (${tuoi} tuổi, ${gioiTinh}) - SID ${sidThat}`
        );

        log(
            `Đã điền: ${result.filled} | Bỏ qua (sheet trống): ${result.skippedEmpty}` +
            (
                result.notFound
                    ? ` | Không tìm thấy ô: ${result.notFound}`
                    : ''
            )
        );


        // -----------------------------------------------------
        // V7.49: Vừa lấy xong kết quả là tự hiện báo cáo ngay,
        // bất kể có bất thường / thiếu thông số hay hoàn toàn bình thường.
        // Dấu ! trên nút AUTO chỉ dùng để XEM LẠI.
        // -----------------------------------------------------

        showLatestCanLamSangReport(true);

    }


    // -----------------------------------------------------------
    // XEM LẠI CẢNH BÁO GẦN NHẤT (không cần nhập lại SID/tên)
    // -----------------------------------------------------------


    function renderInspectorFindingsHtml(findings) {
        if (!Array.isArray(findings) || !findings.length) {
            return '<div class="xai-ok">✓ Chưa thấy chỉ số bất thường theo khoảng tham chiếu.</div>';
        }

        return findings.map(f => {
            const isLow = f.direction === 'thấp';
            const stateClass = isLow ? 'xai-low' : 'xai-high';
            const stateText = f.direction ? String(f.direction).toUpperCase() : 'XEM';
            const code = f.code || '';
            const name = f.name || '';
            const ref = f.rangeText || '';
            return (
                `<div class="xai-finding ${stateClass}">` +
                    `<div class="xai-badge">${stateText}</div>` +
                    '<div class="xai-finding-main">' +
                        `<div class="xai-finding-name">${f.label || ''}</div>` +
                        `<div class="xai-finding-value">${f.value ?? ''}</div>` +
                        `<div class="xai-finding-ref">Tham chiếu: ${ref}</div>` +
                        `<div class="xai-finding-note"><span class="xai-icd-label">ICD-10 tham khảo:</span><span class="xai-icd-value"><b>${code}</b>${name ? `<em> · ${name}</em>` : ''}</span></div>` +
                    '</div>' +
                '</div>'
            );
        }).join('');
    }

    function buildCanLamSangReportHtml(r) {
        if (!r) return '<div>Chưa có báo cáo.</div>';

        const findingCount = Array.isArray(r.findings) ? r.findings.length : 0;
        const missingCount = Array.isArray(r.missingLabels) ? r.missingLabels.length : 0;
        const patientLine = [
            r.sidThat ? `SID ${r.sidThat}` : '',
            r.tuoi ? `Năm sinh ${r.tuoi}` : '',
            r.gioiTinh || ''
        ].filter(Boolean).join(' · ');

        const missingHtml = missingCount
            ? (
                '<section class="xai-section xai-missing">' +
                    '<div class="xai-section-title">Chưa có kết quả</div>' +
                    '<div class="xai-chip-list">' +
                    r.missingLabels.map(l => `<span class="xai-chip">${l}</span>`).join('') +
                    '</div>' +
                '</section>'
            )
            : '';

        return (
            '<div class="xai-report">' +
                '<header class="xai-patient">' +
                    `<div class="xai-patient-name">${r.tenBenhNhan || ''}</div>` +
                    `<div class="xai-patient-meta">${patientLine}</div>` +
                '</header>' +
                '<div class="xai-summary">' +
                    `<div class="xai-stat xai-stat-warn"><span>Cần kiểm tra</span><b>${findingCount}</b></div>` +
                    `<div class="xai-stat xai-stat-missing"><span>Thiếu kết quả</span><b>${missingCount}</b></div>` +
                '</div>' +
                missingHtml +
                '<section class="xai-section">' +
                    '<div class="xai-section-title">Chỉ số cần xem lại</div>' +
                    '<div class="xai-findings">' + renderInspectorFindingsHtml(r.findings || []) + '</div>' +
                '</section>' +
                '<div class="xai-save">💾 Nhớ bấm “Lưu thay đổi” trước khi sang mục khác.</div>' +
            '</div>'
        );
    }

    function showLatestCanLamSangReport(autoShown = false) {
        restoreLastCanLamSangReport();
        if (!lastCanLamSangReport) {
            showAutoDockPanel(
                'Chưa có báo cáo',
                '<div>Chưa có báo cáo nào trong phiên này.<br><br>Vui lòng chạy AUTO ở trang Khám cận lâm sàng trước.</div>',
                'info',
                autoShown ? 5000 : 0
            );
            return;
        }

        const r = lastCanLamSangReport;
        const hasWarning = !!(
            (r.findings && r.findings.length) ||
            (r.missingLabels && r.missingLabels.length)
        );

        const title = hasWarning
            ? 'Kết quả cần kiểm tra'
            : 'Kết quả xét nghiệm';

        showAutoDockPanel(
            title,
            buildCanLamSangReportHtml(r),
            hasWarning ? 'warn' : 'info',
            autoShown ? (hasWarning ? 12000 : 7500) : 0
        );

        if (autoShown && unifiedAutoRuntime.running) {
            unifiedAutoRuntime.reportShown = true;
        }
    }

    function xemLaiCanhBao() {
        showLatestCanLamSangReport(false);
    }

    function createXemCanhBaoButton() {

        if (
            document.getElementById(
                'medinet-xem-canhbao'
            )
        ) {

            return;
        }

        const button =
            document.createElement(
                'button'
            );

        button.id =
            'medinet-xem-canhbao';

        button.innerText =
            '📋 XEM CẢNH BÁO';

        button.className =
            'medinet-toolbar-btn';

        Object.assign(
            button.style,
            {
                position: 'fixed',
                right: '20px',
                bottom: '128px',
                zIndex: '999999',
                padding: '8px 14px',
                background: '#8e24aa',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: 'bold',
                cursor: 'pointer',
                boxShadow:
                    '0 3px 10px rgba(0,0,0,.3)'
            }
        );

        button.addEventListener(
            'click',
            xemLaiCanhBao
        );

        document.body.appendChild(
            button
        );
    }


    // =========================================================
    // STYLE ĐẸP CHO NHÓM NÚT (M2/M3/M4/Xem cảnh báo) - luôn
    // hiện như cũ (users đã quen), chỉ làm gọn + đẹp hơn:
    // bo tròn dạng pill, có hiệu ứng hover nhấc nhẹ lên.
    // =========================================================

    // =========================================================
    // THANH THÔNG BÁO TRẠNG THÁI - hiện ở MÉP TRÊN màn hình
    // khi script đang chạy (VD "Đang điền M3..."), tự ẩn khi
    // xong. Đặt trên đầu để không đụng độ với nút cuộn trang/
    // sidebar của portal ở góc dưới.
    // =========================================================

    // Thanh trạng thái trên cùng đã bỏ ở v7.37.
    // Giữ hàm no-op để các logic cũ gọi vào không gây lỗi.
    function ensureStatusBarStyles() {}

    function showStatusBar(message) {
        log(message);
    }

    function hideStatusBar() {}


    // =========================================================
    // STYLE ĐẸP CHO NHÓM NÚT (M2/M3/M4/Xem cảnh báo) - luôn
    // hiện như cũ (users đã quen), chỉ làm gọn + đẹp hơn:
    // bo tròn dạng pill, có hiệu ứng hover nhấc nhẹ lên.
    // =========================================================

    function ensureToolbarStyles() {

        if (
            document.getElementById(
                'medinet-toolbar-style'
            )
        ) {

            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'medinet-toolbar-style';

        style.textContent = `
            .medinet-toolbar-btn {
                border-radius: 999px !important;
                letter-spacing: .2px;
                transition: transform .12s ease,
                    box-shadow .12s ease, filter .12s ease;
            }
            .medinet-toolbar-btn:hover {
                transform: translateY(-2px);
                filter: brightness(1.08);
                box-shadow: 0 6px 16px rgba(0,0,0,.35) !important;
            }
            .medinet-toolbar-btn:active {
                transform: translateY(0);
            }
        `;

        document.head.appendChild(
            style
        );
    }


    // =========================================================
    // AUTO HỢP NHẤT M2-M6
    // - Nhận diện mẫu từ URL trang danh sách
    // - Ghi nhớ mẫu trong sessionStorage của đúng tab hiện tại
    // - Khi đi vào hồ sơ chi tiết vẫn giữ đúng mẫu
    // =========================================================

    const MEDINET_MODEL_SESSION_KEY =
        'medinet-auto-current-model-v1';

    const MEDINET_MODEL_MAX_AGE =
        12 * 60 * 60 * 1000;

    const MEDINET_MODEL_ROUTES = [
        {
            model: 'M2',
            marker: 'KSKDK_DanhSach_KSK_M12'
        },
        {
            model: 'M3',
            marker: 'KSKDK_DanhSach_KSK_M13'
        },
        {
            model: 'M4',
            marker: 'KSKDK_DanhSach_KSK_NguoiCaoTuoi_Report'
        },
        {
            model: 'M6',
            marker: 'KSKDK_DanhSach_DinhKy_LaiXeOto'
        },
        {
            model: 'M5',
            marker: 'KSKDK_DanhSach_DinhKyLaiXe'
        }
    ];

    function detectModelFromUrl(url) {

        const source =
            String(url || '');

        const found =
            MEDINET_MODEL_ROUTES.find(
                item =>
                    source.includes(
                        item.marker
                    )
            );

        return found
            ? found.model
            : '';
    }

    function rememberDetectedModel(model) {

        if (!model) {
            return;
        }

        try {

            sessionStorage.setItem(
                MEDINET_MODEL_SESSION_KEY,
                JSON.stringify({
                    model,
                    ts: Date.now()
                })
            );

        } catch (e) {

            warn(
                'Không lưu được mẫu vào sessionStorage:',
                e
            );
        }
    }

    function getRememberedModel() {

        try {

            const raw =
                sessionStorage.getItem(
                    MEDINET_MODEL_SESSION_KEY
                );

            if (!raw) {
                return '';
            }

            const data =
                JSON.parse(raw);

            if (
                !data ||
                !data.model ||
                !data.ts ||
                Date.now() - data.ts > MEDINET_MODEL_MAX_AGE
            ) {

                sessionStorage.removeItem(
                    MEDINET_MODEL_SESSION_KEY
                );

                return '';
            }

            return data.model;

        } catch (e) {

            return '';
        }
    }

    function getCurrentMedinetModel() {

        const fromCurrentUrl =
            detectModelFromUrl(
                location.href
            );

        if (fromCurrentUrl) {

            rememberDetectedModel(
                fromCurrentUrl
            );

            return fromCurrentUrl;
        }

        const fromReferrer =
            detectModelFromUrl(
                document.referrer
            );

        if (fromReferrer) {

            rememberDetectedModel(
                fromReferrer
            );

            return fromReferrer;
        }

        return getRememberedModel();
    }

    function isModelListPage() {

        return !!detectModelFromUrl(
            location.href
        );
    }

    function ensureUnifiedAutoStyles() {

        if (
            document.getElementById(
                'medinet-unified-auto-style'
            )
        ) {
            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'medinet-unified-auto-style';

        style.textContent = `
            #medinet-auto-unified {
                position: fixed;
                right: 16px;
                bottom: 16px;
                z-index: 999999;
                width: 68px;
                height: 68px;
                padding: 0;
                border: 0;
                border-radius: 50%;
                background: transparent;
                color: #fff;
                font-family: 'Segoe UI', Roboto, Arial, sans-serif;
                cursor: pointer;
                user-select: none;
                outline: none;
                overflow: visible;
                filter:
                    drop-shadow(0 7px 13px rgba(2, 6, 23, .38))
                    drop-shadow(0 0 4px rgba(34, 211, 238, .12));
                transition:
                    transform .16s cubic-bezier(.2,.8,.2,1),
                    filter .16s ease;
            }

            #medinet-auto-unified:hover:not(:disabled) {
                transform: translateY(-2px) scale(1.035);
                filter:
                    drop-shadow(0 10px 18px rgba(2, 6, 23, .42))
                    drop-shadow(0 0 8px rgba(34, 211, 238, .24));
            }

            #medinet-auto-unified:active:not(:disabled) {
                transform: translateY(0) scale(.97);
            }

            #medinet-auto-unified:disabled {
                cursor: wait;
            }

            #medinet-auto-unified .mau-shell {
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background:
                    radial-gradient(circle at 50% 34%,
                        rgba(22, 78, 109, .95) 0%,
                        rgba(8, 31, 50, .98) 44%,
                        rgba(3, 12, 23, 1) 75%,
                        rgba(1, 6, 14, 1) 100%);
                border: 1px solid rgba(125, 211, 252, .34);
                box-shadow:
                    inset 0 0 0 2px rgba(2, 6, 23, .82),
                    inset 0 0 11px rgba(34, 211, 238, .10),
                    0 0 0 1px rgba(14, 116, 144, .34),
                    0 0 9px rgba(34, 211, 238, .22);
            }

            /* Vành turbine: có khe thật thay vì border dashed giả */
            #medinet-auto-unified .mau-ring {
                position: absolute;
                inset: 3px;
                border-radius: 50%;
                background:
                    repeating-conic-gradient(
                        from 0deg,
                        rgba(103,232,249,.95) 0deg 7deg,
                        rgba(14,116,144,.12) 7deg 13deg,
                        rgba(34,211,238,.44) 13deg 18deg,
                        rgba(2,6,23,.05) 18deg 26deg
                    );
                -webkit-mask:
                    radial-gradient(
                        farthest-side,
                        transparent calc(100% - 4px),
                        #000 calc(100% - 4px)
                    );
                mask:
                    radial-gradient(
                        farthest-side,
                        transparent calc(100% - 4px),
                        #000 calc(100% - 4px)
                    );
                opacity: .72;
                filter: drop-shadow(0 0 3px rgba(34,211,238,.45));
                transform-origin: 50% 50%;
                will-change: transform;
            }

            #medinet-auto-unified .mau-ring2 {
                position: absolute;
                inset: 8px;
                border-radius: 50%;
                background:
                    conic-gradient(
                        from 25deg,
                        rgba(34,211,238,.10),
                        rgba(125,211,252,.72) 18deg,
                        rgba(34,211,238,.08) 46deg,
                        rgba(34,211,238,.08) 182deg,
                        rgba(103,232,249,.65) 215deg,
                        rgba(34,211,238,.08) 248deg,
                        rgba(34,211,238,.10)
                    );
                -webkit-mask:
                    radial-gradient(
                        farthest-side,
                        transparent calc(100% - 2px),
                        #000 calc(100% - 2px)
                    );
                mask:
                    radial-gradient(
                        farthest-side,
                        transparent calc(100% - 2px),
                        #000 calc(100% - 2px)
                    );
                opacity: .7;
            }

            #medinet-auto-unified .mau-core {
                position: absolute;
                inset: 12px;
                border-radius: 50%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                background:
                    radial-gradient(circle at 50% 34%,
                        rgba(10, 105, 140, .46),
                        rgba(6, 42, 63, .37) 47%,
                        rgba(2, 8, 18, .91) 100%);
                border: 1px solid rgba(103, 232, 249, .31);
                box-shadow:
                    inset 0 0 9px rgba(34, 211, 238, .14),
                    0 0 0 1px rgba(2, 6, 23, .8);
                overflow: hidden;
            }

            #medinet-auto-unified .mau-core::after {
                content: '';
                position: absolute;
                inset: 2px;
                border-radius: 50%;
                background:
                    linear-gradient(135deg,
                        rgba(255,255,255,.10),
                        transparent 34%,
                        transparent 70%,
                        rgba(34,211,238,.04));
                pointer-events: none;
            }

            #medinet-auto-unified .mau-model {
                position: relative;
                z-index: 2;
                font-size: 21px;
                line-height: 1;
                font-weight: 900;
                letter-spacing: -.6px;
                color: #f8fdff;
                text-shadow:
                    0 0 4px rgba(103, 232, 249, .78),
                    0 0 9px rgba(34, 211, 238, .25);
            }

            #medinet-auto-unified .mau-auto {
                position: relative;
                z-index: 2;
                margin-top: 3px;
                font-size: 6.5px;
                line-height: 1;
                font-weight: 900;
                letter-spacing: 1px;
                color: #67e8f9;
            }

            /* Vùng click cảnh báo lớn 30x30, nhưng badge nhìn vẫn gọn.
               Nằm tách khỏi tâm AUTO để khó nhấn nhầm. */
            #medinet-auto-unified .mau-warning {
                position: absolute;
                z-index: 8;
                top: -7px;
                right: -7px;
                width: 30px;
                height: 30px;
                padding: 0;
                border: 0;
                border-radius: 50%;
                display: none;
                align-items: center;
                justify-content: center;
                background: transparent;
                cursor: pointer;
                -webkit-tap-highlight-color: transparent;
            }

            #medinet-auto-unified .mau-warning::before {
                content: '!';
                width: 18px;
                height: 18px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                background:
                    linear-gradient(180deg, #fbbf24, #f59e0b 55%, #d97706);
                color: #281500;
                border: 1px solid rgba(254,243,199,.85);
                font-size: 12px;
                line-height: 1;
                font-weight: 1000;
                box-shadow:
                    0 0 0 2px rgba(2,6,23,.92),
                    0 0 8px rgba(245,158,11,.58);
            }

            #medinet-auto-unified .mau-warning:hover::before {
                transform: scale(1.10);
                box-shadow:
                    0 0 0 2px rgba(2,6,23,.94),
                    0 0 12px rgba(245,158,11,.78);
            }

            #medinet-auto-unified.mau-has-warning .mau-warning {
                display: inline-flex;
            }

            #medinet-auto-unified.mau-unknown .mau-shell {
                filter: saturate(.35);
                opacity: .78;
            }

            #medinet-auto-unified.mau-unknown .mau-model {
                color: #cbd5e1;
                text-shadow: none;
            }

            #medinet-auto-unified.mau-unknown .mau-auto {
                color: #94a3b8;
            }

            /* Tóe lửa nhẹ: chỉ xuất hiện lúc đang chạy */
            #medinet-auto-unified .mau-sparks {
                position: absolute;
                inset: -5px;
                border-radius: 50%;
                z-index: 1;
                pointer-events: none;
                opacity: 0;
                transform-origin: center;
            }

            #medinet-auto-unified .mau-sparks i {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 2px;
                height: 8px;
                margin-left: -1px;
                margin-top: -4px;
                border-radius: 999px;
                background: linear-gradient(
                    to bottom,
                    rgba(255,248,214,1),
                    rgba(251,191,36,.96) 38%,
                    rgba(249,115,22,.88) 72%,
                    transparent 100%
                );
                box-shadow:
                    0 0 4px rgba(251,191,36,.95),
                    0 0 7px rgba(249,115,22,.50);
                transform-origin: 1px 39px;
            }

            #medinet-auto-unified .mau-sparks i:nth-child(1) { transform: rotate(16deg) translateY(-34px) scale(.8); }
            #medinet-auto-unified .mau-sparks i:nth-child(2) { transform: rotate(79deg) translateY(-34px) scale(.55); }
            #medinet-auto-unified .mau-sparks i:nth-child(3) { transform: rotate(151deg) translateY(-34px) scale(.75); }
            #medinet-auto-unified .mau-sparks i:nth-child(4) { transform: rotate(226deg) translateY(-34px) scale(.50); }
            #medinet-auto-unified .mau-sparks i:nth-child(5) { transform: rotate(303deg) translateY(-34px) scale(.68); }

            /* AUTO chạy: 2 vành quay ngược chiều -> cảm giác turbine thật hơn */
            #medinet-auto-unified.mau-running .mau-ring {
                opacity: 1;
                animation: medinet-turbine-spin .88s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-ring2 {
                opacity: .95;
                animation: medinet-turbine-counter 1.45s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-shell {
                box-shadow:
                    inset 0 0 0 2px rgba(2, 6, 23, .82),
                    inset 0 0 14px rgba(34,211,238,.16),
                    0 0 0 1px rgba(14,116,144,.46),
                    0 0 13px rgba(34,211,238,.38);
            }

            #medinet-auto-unified.mau-running .mau-core {
                animation: medinet-core-breathe .85s ease-in-out infinite alternate;
            }

            #medinet-auto-unified.mau-running .mau-auto {
                color: #cffafe;
                animation: medinet-auto-pulse .65s ease-in-out infinite alternate;
            }

            #medinet-auto-unified.mau-running .mau-sparks {
                opacity: .92;
                animation:
                    medinet-spark-orbit 1.08s linear infinite,
                    medinet-spark-flicker .22s steps(2,end) infinite;
            }

            @keyframes medinet-turbine-spin {
                to { transform: rotate(360deg); }
            }

            @keyframes medinet-turbine-counter {
                to { transform: rotate(-360deg); }
            }

            @keyframes medinet-spark-orbit {
                to { transform: rotate(360deg); }
            }

            @keyframes medinet-spark-flicker {
                0%, 100% { opacity: .35; filter: brightness(.85); }
                50% { opacity: 1; filter: brightness(1.25); }
            }

            @keyframes medinet-core-breathe {
                from {
                    box-shadow:
                        inset 0 0 9px rgba(34,211,238,.13),
                        0 0 0 1px rgba(2,6,23,.8);
                }
                to {
                    box-shadow:
                        inset 0 0 13px rgba(34,211,238,.23),
                        0 0 7px rgba(34,211,238,.18);
                }
            }

            @keyframes medinet-auto-pulse {
                from { opacity: .58; }
                to { opacity: 1; }
            }

            /* Thẻ kết quả AUTO: thay alert thô */
            #medinet-auto-notice {
                position: fixed;
                right: 16px;
                bottom: 94px;
                z-index: 1000000;
                width: min(330px, calc(100vw - 28px));
                font-family: 'Segoe UI', Roboto, Arial, sans-serif;
                color: #e5eef7;
                background:
                    linear-gradient(180deg,
                        rgba(11, 24, 40, .97),
                        rgba(4, 12, 24, .98));
                border: 1px solid rgba(100, 210, 235, .22);
                border-radius: 14px;
                box-shadow:
                    0 16px 38px rgba(2,6,23,.38),
                    0 0 18px rgba(34,211,238,.08);
                overflow: hidden;
                transform: translateY(8px) scale(.98);
                opacity: 0;
                transition:
                    opacity .18s ease,
                    transform .18s ease;
                backdrop-filter: blur(8px);
            }

            #medinet-auto-notice.mau-show {
                opacity: 1;
                transform: translateY(0) scale(1);
            }

            #medinet-auto-notice .man-accent {
                height: 3px;
                background: linear-gradient(90deg, #22d3ee, #38bdf8, #67e8f9);
            }

            #medinet-auto-notice.man-warn .man-accent {
                background: linear-gradient(90deg, #f59e0b, #fbbf24, #fb923c);
            }

            #medinet-auto-notice.man-error .man-accent {
                background: linear-gradient(90deg, #ef4444, #fb7185, #f97316);
            }

            #medinet-auto-notice .man-wrap {
                display: grid;
                grid-template-columns: 34px 1fr 24px;
                gap: 10px;
                align-items: start;
                padding: 12px 12px 13px;
            }

            #medinet-auto-notice .man-icon {
                width: 34px;
                height: 34px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(34,211,238,.11);
                border: 1px solid rgba(103,232,249,.16);
                font-size: 18px;
            }

            #medinet-auto-notice.man-warn .man-icon {
                background: rgba(245,158,11,.11);
                border-color: rgba(251,191,36,.16);
            }

            #medinet-auto-notice.man-error .man-icon {
                background: rgba(239,68,68,.11);
                border-color: rgba(248,113,113,.16);
            }

            #medinet-auto-notice .man-title {
                margin: 0 0 4px;
                color: #f8fafc;
                font-size: 13px;
                font-weight: 800;
                letter-spacing: .1px;
            }

            #medinet-auto-notice .man-body {
                color: #b9c8d8;
                font-size: 12px;
                line-height: 1.48;
                white-space: pre-line;
            }

            #medinet-auto-notice .man-close {
                width: 24px;
                height: 24px;
                border: 0;
                border-radius: 7px;
                background: rgba(255,255,255,.05);
                color: #94a3b8;
                cursor: pointer;
                font-size: 16px;
                line-height: 1;
            }

            #medinet-auto-notice .man-close:hover {
                background: rgba(255,255,255,.10);
                color: #fff;
            }

            @media (max-width: 640px) {
                #medinet-auto-unified {
                    right: 11px;
                    bottom: 11px;
                    width: 61px;
                    height: 61px;
                }

                #medinet-auto-unified .mau-model {
                    font-size: 19px;
                }

                #medinet-auto-unified .mau-core {
                    inset: 11px;
                }

                #medinet-auto-unified .mau-warning {
                    top: -8px;
                    right: -8px;
                    width: 29px;
                    height: 29px;
                }

                #medinet-auto-notice {
                    right: 10px;
                    bottom: 82px;
                    width: min(318px, calc(100vw - 20px));
                }
            }

            /* =====================================================
               v7.38 - TURBO CORE 2.0
               - nhỏ hơn, sắc hơn, không đè nút cuộn mặc định Medinet
               - turbine đa tầng + arc ánh sáng + spark ngắn
               ===================================================== */
            #medinet-auto-unified {
                right: 22px;
                bottom: 92px;
                width: 62px;
                height: 62px;
                filter:
                    drop-shadow(0 8px 16px rgba(2,6,23,.42))
                    drop-shadow(0 0 5px rgba(34,211,238,.18));
            }

            #medinet-auto-unified .mau-shell {
                background:
                    radial-gradient(circle at 50% 42%,
                        rgba(10,72,103,.96) 0 24%,
                        rgba(3,22,38,.99) 55%,
                        #010711 100%);
                border: 1px solid rgba(125,211,252,.44);
                box-shadow:
                    inset 0 0 0 2px rgba(1,7,16,.94),
                    inset 0 0 10px rgba(34,211,238,.13),
                    0 0 0 1px rgba(8,145,178,.26),
                    0 0 10px rgba(34,211,238,.24);
            }

            #medinet-auto-unified .mau-shell::before {
                content: '';
                position: absolute;
                inset: 5px;
                border-radius: 50%;
                border: 1px solid rgba(103,232,249,.16);
                box-shadow:
                    inset 0 0 8px rgba(34,211,238,.08),
                    0 0 4px rgba(34,211,238,.08);
                pointer-events: none;
            }

            #medinet-auto-unified .mau-shell::after {
                content: '';
                position: absolute;
                inset: -2px;
                border-radius: 50%;
                background:
                    conic-gradient(
                        from 0deg,
                        transparent 0 16deg,
                        rgba(103,232,249,.78) 16deg 20deg,
                        transparent 20deg 92deg,
                        rgba(56,189,248,.52) 92deg 96deg,
                        transparent 96deg 184deg,
                        rgba(103,232,249,.66) 184deg 188deg,
                        transparent 188deg 272deg,
                        rgba(34,211,238,.50) 272deg 276deg,
                        transparent 276deg 360deg
                    );
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
                mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
                opacity: .72;
                pointer-events: none;
            }

            #medinet-auto-unified .mau-ring {
                inset: 3px;
                background:
                    repeating-conic-gradient(
                        from 3deg,
                        rgba(125,211,252,.96) 0 4deg,
                        rgba(14,116,144,.24) 4deg 8deg,
                        rgba(2,6,23,.04) 8deg 15deg
                    );
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
                mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0);
                opacity: .76;
            }

            #medinet-auto-unified .mau-ring2 {
                inset: 8px;
                background:
                    conic-gradient(
                        from 0deg,
                        transparent 0 40deg,
                        rgba(103,232,249,.86) 40deg 62deg,
                        transparent 62deg 176deg,
                        rgba(56,189,248,.66) 176deg 194deg,
                        transparent 194deg 310deg,
                        rgba(34,211,238,.72) 310deg 330deg,
                        transparent 330deg 360deg
                    );
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
                mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0);
                filter: drop-shadow(0 0 3px rgba(34,211,238,.38));
            }

            #medinet-auto-unified .mau-core {
                inset: 11px;
                background:
                    radial-gradient(circle at 48% 34%,
                        rgba(15,115,150,.50),
                        rgba(5,44,65,.44) 42%,
                        rgba(1,9,19,.97) 100%);
                border: 1px solid rgba(103,232,249,.34);
            }

            #medinet-auto-unified .mau-model {
                font-size: 20px;
                color: #ffffff !important;
                text-shadow:
                    0 0 4px rgba(207,250,254,.92),
                    0 0 10px rgba(34,211,238,.42);
            }

            #medinet-auto-unified .mau-auto {
                margin-top: 2px;
                font-size: 6px;
                color: #a5f3fc !important;
            }

            #medinet-auto-unified .mau-warning {
                top: -8px;
                right: -8px;
                width: 32px;
                height: 32px;
            }

            #medinet-auto-unified .mau-warning::before {
                width: 19px;
                height: 19px;
                font-size: 13px;
                color: #1f1300 !important;
                border: 1px solid rgba(255,251,235,.92);
                box-shadow:
                    0 0 0 3px rgba(1,7,16,.96),
                    0 0 10px rgba(245,158,11,.72);
            }

            #medinet-auto-unified .mau-sparks {
                inset: -7px;
            }

            #medinet-auto-unified .mau-sparks i {
                width: 2px;
                height: 6px;
                margin-top: -3px;
                transform-origin: 1px 35px;
                background: linear-gradient(to bottom, #fff7d6, #fbbf24 42%, #f97316 72%, transparent 100%);
                box-shadow:
                    0 0 4px rgba(251,191,36,.9),
                    0 0 7px rgba(249,115,22,.38);
            }

            #medinet-auto-unified .mau-sparks i:nth-child(1) { transform: rotate(11deg) translateY(-31px) scale(.85); }
            #medinet-auto-unified .mau-sparks i:nth-child(2) { transform: rotate(83deg) translateY(-31px) scale(.52); }
            #medinet-auto-unified .mau-sparks i:nth-child(3) { transform: rotate(157deg) translateY(-31px) scale(.72); }
            #medinet-auto-unified .mau-sparks i:nth-child(4) { transform: rotate(238deg) translateY(-31px) scale(.48); }
            #medinet-auto-unified .mau-sparks i:nth-child(5) { transform: rotate(314deg) translateY(-31px) scale(.66); }

            #medinet-auto-unified.mau-running .mau-ring {
                animation: medinet-turbine-spin .58s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-ring2 {
                animation: medinet-turbine-counter 1.08s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-shell::after {
                animation: medinet-turbine-spin 1.65s linear infinite;
                opacity: 1;
            }

            #medinet-auto-unified.mau-running .mau-sparks {
                opacity: .78;
                animation:
                    medinet-spark-orbit .82s linear infinite,
                    medinet-spark-flicker .16s steps(2,end) infinite;
            }

            /* =====================================================
               v7.41 - PLASMA CLUTCH / TURBINE COLLISION
               - BỎ hoàn toàn kiểu ngọn lửa dựng đứng / "cắm nến".
               - Hai vành nhiệt quay ngược chiều, chỉ có các cung nóng
                 bám sát mép turbine.
               - Điểm ma sát tạo plasma trắng-vàng và mạt lửa văng theo
                 tiếp tuyến, giống 2 turbine cạ nhau hơn là "lửa CSS".
               ===================================================== */
            #medinet-auto-unified .mau-flames {
                position: absolute;
                inset: -7px;
                z-index: 0;
                pointer-events: none;
                opacity: 0;
                border-radius: 50%;
                transform: translateZ(0);
                transition: opacity .16s ease;
            }

            /* Vành plasma ngoài: chỉ là các cung nhiệt mỏng bám sát mép */
            #medinet-auto-unified .mau-flames::before {
                content: '';
                position: absolute;
                inset: 0;
                border-radius: 50%;
                background:
                    conic-gradient(
                        from 8deg,
                        transparent 0 20deg,
                        rgba(255,255,255,.98) 20deg 22deg,
                        rgba(255,231,145,.98) 22deg 25deg,
                        rgba(255,151,28,.98) 25deg 31deg,
                        rgba(255,73,0,.72) 31deg 36deg,
                        transparent 36deg 90deg,
                        transparent 90deg 127deg,
                        rgba(255,255,255,.95) 127deg 129deg,
                        rgba(255,214,91,.96) 129deg 132deg,
                        rgba(255,124,17,.92) 132deg 138deg,
                        transparent 138deg 206deg,
                        transparent 206deg 252deg,
                        rgba(255,255,255,.96) 252deg 254deg,
                        rgba(255,221,112,.98) 254deg 257deg,
                        rgba(255,136,22,.94) 257deg 264deg,
                        rgba(255,67,0,.65) 264deg 269deg,
                        transparent 269deg 360deg
                    );
                -webkit-mask: radial-gradient(farthest-side,
                    transparent 0 72%,
                    #000 75% 82%,
                    transparent 85% 100%);
                mask: radial-gradient(farthest-side,
                    transparent 0 72%,
                    #000 75% 82%,
                    transparent 85% 100%);
                filter:
                    drop-shadow(0 0 2px rgba(255,246,210,.95))
                    drop-shadow(0 0 5px rgba(255,168,32,.88))
                    drop-shadow(0 0 9px rgba(255,70,0,.46));
            }

            /* Vành plasma trong quay ngược, ít cung hơn để tránh rối */
            #medinet-auto-unified .mau-flames::after {
                content: '';
                position: absolute;
                inset: 5px;
                border-radius: 50%;
                background:
                    conic-gradient(
                        from 42deg,
                        transparent 0 54deg,
                        rgba(255,255,255,.92) 54deg 56deg,
                        rgba(255,208,70,.95) 56deg 59deg,
                        rgba(255,112,15,.84) 59deg 64deg,
                        transparent 64deg 178deg,
                        rgba(255,255,255,.90) 178deg 180deg,
                        rgba(255,221,105,.94) 180deg 183deg,
                        rgba(255,119,16,.82) 183deg 188deg,
                        transparent 188deg 302deg,
                        rgba(255,255,255,.88) 302deg 304deg,
                        rgba(255,204,63,.90) 304deg 307deg,
                        rgba(255,96,10,.76) 307deg 312deg,
                        transparent 312deg 360deg
                    );
                -webkit-mask: radial-gradient(farthest-side,
                    transparent 0 70%,
                    #000 73% 80%,
                    transparent 83% 100%);
                mask: radial-gradient(farthest-side,
                    transparent 0 70%,
                    #000 73% 80%,
                    transparent 83% 100%);
                filter:
                    drop-shadow(0 0 2px rgba(255,245,205,.86))
                    drop-shadow(0 0 5px rgba(255,130,18,.62));
                opacity: .88;
            }

            /* Mạt lửa = chấm/đốm rất nhỏ, KHÔNG phải thanh lửa */
            #medinet-auto-unified .mau-flames i {
                position: absolute;
                left: 50%;
                top: 50%;
                width: 2px;
                height: 2px;
                margin: -1px 0 0 -1px;
                border-radius: 50%;
                background: #fff7d6;
                box-shadow:
                    0 0 2px rgba(255,255,255,1),
                    0 0 5px rgba(255,188,55,.98),
                    0 0 8px rgba(255,83,0,.72);
                opacity: 0;
                transform-origin: center;
                will-change: transform, opacity;
            }

            /* Mỗi hạt phóng theo tiếp tuyến riêng */
            #medinet-auto-unified .mau-flames i:nth-child(1) { --a: 24deg;  --r: 34px; --tx: 11px; --ty:-5px; --delay:-.04s; }
            #medinet-auto-unified .mau-flames i:nth-child(2) { --a: 67deg;  --r: 34px; --tx: 10px; --ty: 4px; --delay:-.19s; }
            #medinet-auto-unified .mau-flames i:nth-child(3) { --a: 132deg; --r: 34px; --tx:  3px; --ty:10px; --delay:-.31s; }
            #medinet-auto-unified .mau-flames i:nth-child(4) { --a: 191deg; --r: 34px; --tx:-10px; --ty: 5px; --delay:-.10s; }
            #medinet-auto-unified .mau-flames i:nth-child(5) { --a: 238deg; --r: 34px; --tx:-9px; --ty:-4px; --delay:-.24s; }
            #medinet-auto-unified .mau-flames i:nth-child(6) { --a: 292deg; --r: 34px; --tx:-2px; --ty:-10px; --delay:-.36s; }
            #medinet-auto-unified .mau-flames i:nth-child(7) { --a: 337deg; --r: 34px; --tx: 9px; --ty:-7px; --delay:-.15s; }

            #medinet-auto-unified.mau-running .mau-flames {
                opacity: 1;
            }

            #medinet-auto-unified.mau-running .mau-flames::before {
                animation: medinet-plasma-spin .46s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-flames::after {
                animation: medinet-plasma-counter .34s linear infinite;
            }

            #medinet-auto-unified.mau-running .mau-flames i {
                animation: medinet-friction-spark .54s cubic-bezier(.18,.63,.28,1) infinite;
                animation-delay: var(--delay);
            }

            /* Điểm nóng "ma sát" trên shell, không biến cả nút thành quả cầu lửa */
            #medinet-auto-unified.mau-running .mau-shell {
                box-shadow:
                    inset 0 0 0 2px rgba(1,7,16,.94),
                    inset 0 0 10px rgba(34,211,238,.18),
                    0 0 0 1px rgba(8,145,178,.28),
                    0 0 10px rgba(34,211,238,.34),
                    8px -6px 12px rgba(255,122,0,.22),
                    -7px 7px 11px rgba(255,75,0,.14);
            }

            #medinet-auto-unified.mau-running .mau-core {
                box-shadow:
                    inset 0 0 12px rgba(34,211,238,.18),
                    0 0 8px rgba(34,211,238,.32),
                    4px -3px 8px rgba(255,155,35,.10);
            }

            @keyframes medinet-plasma-spin {
                to { transform: rotate(360deg); }
            }

            @keyframes medinet-plasma-counter {
                to { transform: rotate(-360deg); }
            }

            @keyframes medinet-friction-spark {
                0% {
                    opacity: 0;
                    transform:
                        rotate(var(--a))
                        translateY(calc(-1 * var(--r)))
                        translate(0,0)
                        scale(.7);
                }
                10% { opacity: 1; }
                45% { opacity: .96; }
                100% {
                    opacity: 0;
                    transform:
                        rotate(var(--a))
                        translateY(calc(-1 * var(--r)))
                        translate(var(--tx), var(--ty))
                        scale(.2);
                }
            }

            /* Notice v7.41: nhắc LƯU thật rõ, nhưng không che UI Medinet */
            #medinet-auto-notice {
                right: 94px;
                bottom: 90px;
                width: min(300px, calc(100vw - 118px));
                color: #ffffff !important;
                background: linear-gradient(180deg, rgba(5,18,32,.985), rgba(2,9,18,.992)) !important;
                border-color: rgba(103,232,249,.30);
                box-shadow:
                    0 14px 32px rgba(2,6,23,.42),
                    0 0 16px rgba(34,211,238,.10);
            }

            #medinet-auto-notice,
            #medinet-auto-notice * {
                font-family: 'Segoe UI', Roboto, Arial, sans-serif !important;
                box-sizing: border-box;
            }

            #medinet-auto-notice .man-title {
                color: #ffffff !important;
                font-size: 13.5px;
                font-weight: 850;
            }

            #medinet-auto-notice .man-body {
                color: #dbeafe !important;
                font-size: 12.2px;
                line-height: 1.52;
            }

            #medinet-auto-notice .man-icon {
                color: #cffafe !important;
            }

            #medinet-auto-notice.man-warn .man-icon {
                color: #fef3c7 !important;
            }


            #medinet-auto-notice.man-warn {
                border-color: rgba(251,191,36,.66) !important;
                background:
                    linear-gradient(180deg, rgba(35,23,3,.985), rgba(14,10,3,.995)) !important;
                box-shadow:
                    0 14px 32px rgba(2,6,23,.42),
                    0 0 0 1px rgba(245,158,11,.16),
                    0 0 22px rgba(245,158,11,.16) !important;
            }

            #medinet-auto-notice.man-warn .man-title {
                color: #fef3c7 !important;
                font-size: 14px !important;
                letter-spacing: .15px;
            }

            #medinet-auto-notice.man-warn .man-body {
                color: #fff7ed !important;
                font-weight: 650;
            }

            #medinet-auto-notice.man-error .man-icon {
                color: #fee2e2 !important;
            }

            #medinet-auto-notice .man-close {
                color: #cbd5e1 !important;
            }

            @media (max-width: 640px) {
                #medinet-auto-unified {
                    right: 14px;
                    bottom: 82px;
                    width: 57px;
                    height: 57px;
                }

                #medinet-auto-unified .mau-core { inset: 10px; }
                #medinet-auto-unified .mau-model { font-size: 18px; }

                #medinet-auto-notice {
                    right: 78px;
                    bottom: 78px;
                    width: min(278px, calc(100vw - 94px));
                }
            }
        `;

        document.head.appendChild(
            style
        );
    }


    function ensureUnifiedAutoV742Styles() {
        if (document.getElementById('medinet-auto-v742-style')) return;

        const style = document.createElement('style');
        style.id = 'medinet-auto-v742-style';
        style.textContent = `
            /* =====================================================
               v7.42 · REACTOR TURBINE
               Bỏ hoàn toàn lửa/segment cam kiểu "cắm nến".
               Hai rotor cyan điện quay ngược chiều, giao điểm phát hồ quang.
               ===================================================== */
            #medinet-auto-unified {
                width: 58px !important;
                height: 58px !important;
                right: 24px !important;
                bottom: 96px !important;
                overflow: visible !important;
                filter: drop-shadow(0 8px 17px rgba(2,6,23,.42)) !important;
            }

            #medinet-auto-unified .mau-flames,
            #medinet-auto-unified .mau-sparks {
                display: none !important;
            }

            #medinet-auto-unified .mau-shell {
                inset: 2px !important;
                border: 1px solid rgba(125,211,252,.30) !important;
                background:
                    radial-gradient(circle at 50% 45%, rgba(18,88,118,.72) 0 20%, rgba(4,23,40,.98) 51%, #01050d 100%) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,.035),
                    inset 0 0 14px rgba(34,211,238,.10),
                    0 0 0 1px rgba(3,7,18,.88),
                    0 0 10px rgba(34,211,238,.14) !important;
            }

            #medinet-auto-unified .mau-shell::before {
                inset: 6px !important;
                border: 1px solid rgba(103,232,249,.14) !important;
                box-shadow: inset 0 0 7px rgba(56,189,248,.10) !important;
            }

            #medinet-auto-unified .mau-shell::after {
                opacity: 0 !important;
            }

            #medinet-auto-unified .mau-ring {
                inset: 1px !important;
                opacity: .92 !important;
                background: conic-gradient(
                    from 8deg,
                    transparent 0 18deg,
                    rgba(224,252,255,.96) 18deg 24deg,
                    rgba(34,211,238,.92) 24deg 52deg,
                    transparent 52deg 121deg,
                    rgba(56,189,248,.88) 121deg 153deg,
                    transparent 153deg 225deg,
                    rgba(165,243,252,.92) 225deg 233deg,
                    rgba(14,165,233,.78) 233deg 260deg,
                    transparent 260deg 360deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0) !important;
                filter: drop-shadow(0 0 3px rgba(34,211,238,.45)) !important;
            }

            #medinet-auto-unified .mau-ring2 {
                inset: 6px !important;
                opacity: .80 !important;
                background: conic-gradient(
                    from 192deg,
                    transparent 0 38deg,
                    rgba(99,102,241,.82) 38deg 66deg,
                    rgba(125,211,252,.94) 66deg 74deg,
                    transparent 74deg 182deg,
                    rgba(34,211,238,.82) 182deg 214deg,
                    transparent 214deg 300deg,
                    rgba(196,181,253,.72) 300deg 326deg,
                    transparent 326deg 360deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 2px), #000 0) !important;
                filter: drop-shadow(0 0 3px rgba(56,189,248,.32)) !important;
            }

            #medinet-auto-unified .mau-energy {
                position: absolute;
                inset: -7px;
                border-radius: 50%;
                pointer-events: none;
                opacity: 0;
                transition: opacity .18s ease;
            }

            #medinet-auto-unified .mau-energy::before,
            #medinet-auto-unified .mau-energy::after {
                content: '';
                position: absolute;
                width: 17px;
                height: 2px;
                border-radius: 999px;
                top: 50%;
                left: 50%;
                background: linear-gradient(90deg, rgba(255,255,255,0), #ecfeff 30%, #67e8f9 58%, rgba(56,189,248,0));
                box-shadow: 0 0 3px #fff, 0 0 7px rgba(34,211,238,.85), 0 0 13px rgba(59,130,246,.42);
                transform-origin: -22px 50%;
            }

            #medinet-auto-unified .mau-energy::before { transform: translate(22px,-1px) rotate(21deg); }
            #medinet-auto-unified .mau-energy::after  { transform: translate(22px,-1px) rotate(201deg); }

            #medinet-auto-unified .mau-core {
                inset: 10px !important;
                background:
                    radial-gradient(circle at 48% 31%, rgba(38,145,185,.48), rgba(5,35,55,.70) 42%, rgba(1,8,18,.98) 100%) !important;
                border: 1px solid rgba(125,211,252,.28) !important;
                box-shadow: inset 0 0 9px rgba(34,211,238,.08) !important;
            }

            #medinet-auto-unified .mau-model {
                font-size: 19px !important;
                line-height: 18px !important;
                color: #f8fdff !important;
                text-shadow: 0 0 4px rgba(207,250,254,.75), 0 0 9px rgba(34,211,238,.32) !important;
            }

            #medinet-auto-unified .mau-auto {
                font-size: 5.7px !important;
                letter-spacing: 1px !important;
                color: #8defff !important;
            }

            #medinet-auto-unified.mau-running .mau-ring {
                animation: mau-v742-rotor-a .62s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation: mau-v742-rotor-b .88s linear infinite reverse !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity: 1;
                animation: mau-v742-energy-spin .41s linear infinite;
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation: mau-v742-core-pulse .78s ease-in-out infinite alternate !important;
            }

            @keyframes mau-v742-rotor-a { to { transform: rotate(360deg); } }
            @keyframes mau-v742-rotor-b { to { transform: rotate(360deg); } }
            @keyframes mau-v742-energy-spin { to { transform: rotate(360deg); } }
            @keyframes mau-v742-core-pulse {
                from { box-shadow: inset 0 0 8px rgba(34,211,238,.08), 0 0 2px rgba(34,211,238,.05); }
                to { box-shadow: inset 0 0 14px rgba(34,211,238,.19), 0 0 9px rgba(34,211,238,.19); }
            }

            /* Warning là một node chức năng riêng, không nhuộm cả turbine thành màu cam. */
            #medinet-auto-unified .mau-warning {
                top: -8px !important;
                right: -8px !important;
                width: 30px !important;
                height: 30px !important;
                background: transparent !important;
                border: 0 !important;
                box-shadow: none !important;
            }
            #medinet-auto-unified .mau-warning::before {
                content: '!';
                position: absolute;
                width: 18px;
                height: 18px;
                right: 1px;
                top: 1px;
                display: grid;
                place-items: center;
                border-radius: 50%;
                color: #fff7ed;
                font: 900 12px/1 'Segoe UI',sans-serif;
                background: linear-gradient(145deg,#f59e0b,#ea580c);
                border: 1px solid rgba(255,237,213,.75);
                box-shadow: 0 0 0 2px rgba(2,6,23,.90), 0 0 8px rgba(249,115,22,.48);
                opacity: 0;
                transform: scale(.7);
                transition: opacity .15s, transform .15s;
            }
            #medinet-auto-unified.mau-has-warning .mau-warning::before {
                opacity: 1;
                transform: scale(1);
            }

            /* Panel thông báo gắn với AUTO - không chiếm giữa màn hình. */
            #medinet-auto-dock-panel {
                position: fixed;
                right: 94px;
                bottom: 90px;
                z-index: 9999998;
                width: min(360px, calc(100vw - 120px));
                max-height: min(62vh, 520px);
                overflow: auto;
                border-radius: 13px;
                background: linear-gradient(160deg, rgba(7,16,30,.97), rgba(3,9,19,.97));
                color: #e7f8ff !important;
                border: 1px solid rgba(103,232,249,.24);
                box-shadow: 0 14px 40px rgba(2,6,23,.40), 0 0 14px rgba(34,211,238,.09);
                font-family: 'Segoe UI',Roboto,Arial,sans-serif;
                opacity: 0;
                transform: translateX(8px) scale(.985);
                transition: opacity .18s ease, transform .18s ease;
                isolation: isolate;
            }
            #medinet-auto-dock-panel.madp-show { opacity: 1; transform: translateX(0) scale(1); }
            #medinet-auto-dock-panel::after {
                content: '';
                position: fixed;
                right: 82px;
                bottom: 114px;
                width: 10px;
                height: 10px;
                transform: rotate(45deg);
                background: #050d19;
                border-top: 1px solid rgba(103,232,249,.24);
                border-right: 1px solid rgba(103,232,249,.24);
            }
            #medinet-auto-dock-panel .madp-head {
                display:flex;
                align-items:center;
                gap:9px;
                padding:11px 12px 9px;
                border-bottom:1px solid rgba(148,163,184,.13);
                position:sticky;
                top:0;
                background:rgba(5,13,25,.98);
                z-index:2;
            }
            #medinet-auto-dock-panel .madp-pulse {
                width:8px;height:8px;border-radius:50%;background:#22d3ee;
                box-shadow:0 0 8px rgba(34,211,238,.7);
                flex:none;
            }
            #medinet-auto-dock-panel.madp-warn .madp-pulse { background:#f59e0b; box-shadow:0 0 8px rgba(245,158,11,.7); }
            #medinet-auto-dock-panel.madp-error .madp-pulse { background:#fb7185; box-shadow:0 0 8px rgba(251,113,133,.7); }
            #medinet-auto-dock-panel .madp-title { flex:1;font-size:13px;font-weight:800;color:#f8fdff !important; }
            #medinet-auto-dock-panel .madp-close {
                width:25px;height:25px;border:0;border-radius:7px;background:rgba(148,163,184,.10);
                color:#cbd5e1;font-size:18px;line-height:1;cursor:pointer;
            }
            #medinet-auto-dock-panel .madp-body {
                padding:11px 13px 13px;
                color:#d8edf5 !important;
                font-size:12.5px;
                line-height:1.55;
            }
            #medinet-auto-dock-panel .madp-body * { color:inherit !important; }
            #medinet-auto-dock-panel .madp-body b,
            #medinet-auto-dock-panel .madp-body strong { color:#fff !important; }
            #medinet-auto-dock-panel .mnm-patient-card { background:rgba(15,23,42,.72)!important;border-color:rgba(103,232,249,.18)!important; }
            #medinet-auto-dock-panel .mnm-note { background:rgba(15,23,42,.68)!important;color:#bfe9f7!important;border-color:rgba(103,232,249,.13)!important; }

            /* Toast cũ nếu phát sinh ngoài AUTO cũng neo về cùng cụm điều khiển. */
            .mnm-toast {
                left:auto !important;
                right:94px !important;
                bottom:96px !important;
                transform:translateX(8px) translateY(0) !important;
                max-width:min(330px,calc(100vw - 120px)) !important;
                background:#07111f !important;
                color:#e7f8ff !important;
                border:1px solid rgba(103,232,249,.22) !important;
                box-shadow:0 12px 30px rgba(2,6,23,.34) !important;
                font-size:12.5px !important;
            }
            .mnm-toast.mnm-toast-show { transform:translateX(0) translateY(0) !important; }

            #medinet-auto-notice {
                right:94px !important;
                bottom:90px !important;
                width:min(350px,calc(100vw - 120px)) !important;
            }

            @media (max-width:640px) {
                #medinet-auto-unified { width:54px !important;height:54px !important;right:15px !important;bottom:86px !important; }
                #medinet-auto-dock-panel, #medinet-auto-notice, .mnm-toast {
                    right:76px !important;
                    bottom:82px !important;
                    width:min(290px,calc(100vw - 92px)) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }


    function ensureUnifiedAutoSpeechBubbleStyles() {

        if (
            document.getElementById(
                'medinet-auto-speech-style'
            )
        ) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'medinet-auto-speech-style';
        style.textContent = `
            #medinet-auto-dock-panel {
                position: fixed !important;
                right: 84px !important;
                bottom: 92px !important;
                width: min(350px, calc(100vw - 116px)) !important;
                max-height: min(58vh, 480px) !important;
                overflow: auto !important;
                border-radius: 18px !important;
                background: linear-gradient(180deg, rgba(255,255,255,.985), rgba(248,250,252,.985)) !important;
                color: #111827 !important;
                border: 3px solid #111827 !important;
                box-shadow: 0 18px 38px rgba(15,23,42,.26), 0 6px 0 rgba(17,24,39,.10) !important;
                transform: translateY(8px) scale(.98) !important;
                opacity: 0;
                z-index: 9999998 !important;
                isolation: isolate;
                font-family: 'Segoe UI', Roboto, Arial, sans-serif !important;
            }
            #medinet-auto-dock-panel.madp-show {
                opacity: 1 !important;
                transform: translateY(0) scale(1) !important;
            }
            #medinet-auto-dock-panel::after {
                content: '' !important;
                position: absolute !important;
                right: 18px !important;
                bottom: -12px !important;
                width: 18px !important;
                height: 18px !important;
                background: #ffffff !important;
                border-right: 3px solid #111827 !important;
                border-bottom: 3px solid #111827 !important;
                transform: rotate(45deg) !important;
            }
            #medinet-auto-dock-panel .madp-head {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 11px 14px 8px;
                border-bottom: 1px dashed rgba(17,24,39,.16);
                background: transparent !important;
                position: sticky;
                top: 0;
                z-index: 2;
            }
            #medinet-auto-dock-panel .madp-pulse {
                width: 10px !important;
                height: 10px !important;
                border-radius: 50% !important;
                background: #38bdf8 !important;
                box-shadow: 0 0 0 3px rgba(56,189,248,.16), 0 0 10px rgba(56,189,248,.45) !important;
                flex: none;
            }
            #medinet-auto-dock-panel.madp-ok .madp-pulse,
            #medinet-auto-dock-panel.madp-info .madp-pulse { background:#38bdf8 !important; box-shadow: 0 0 0 3px rgba(56,189,248,.16), 0 0 10px rgba(56,189,248,.45) !important; }
            #medinet-auto-dock-panel.madp-warn .madp-pulse { background:#f59e0b !important; box-shadow:0 0 0 3px rgba(245,158,11,.18),0 0 10px rgba(245,158,11,.48) !important; }
            #medinet-auto-dock-panel.madp-error .madp-pulse { background:#ef4444 !important; box-shadow:0 0 0 3px rgba(239,68,68,.18),0 0 10px rgba(239,68,68,.48) !important; }
            #medinet-auto-dock-panel .madp-title {
                flex:1;
                color:#0f172a !important;
                font-size:14px !important;
                font-weight:900 !important;
                letter-spacing:.1px;
            }
            #medinet-auto-dock-panel .madp-close {
                width: 26px !important;
                height: 26px !important;
                border-radius: 999px !important;
                border: 2px solid #111827 !important;
                background: #ffffff !important;
                color: #111827 !important;
                font-size: 17px !important;
                cursor: pointer;
                line-height: 1;
                font-weight: 900;
            }
            #medinet-auto-dock-panel .madp-body {
                padding: 10px 14px 14px !important;
                color:#1f2937 !important;
                font-size:13px !important;
                line-height:1.52 !important;
            }
            #medinet-auto-dock-panel .madp-body * { color: inherit !important; }
            #medinet-auto-dock-panel .madp-speech-line {
                display:block;
                margin: 0 0 4px;
            }
            #medinet-auto-dock-panel .madp-speech-line:last-child { margin-bottom: 0; }
            #medinet-auto-dock-panel .madp-running-note {
                margin-top:8px;
                padding:8px 10px;
                border-radius:12px;
                border:1px dashed rgba(14,116,144,.32);
                background:rgba(224,242,254,.65);
                color:#0f172a !important;
                font-size:12.5px;
                font-weight:700;
            }
            #medinet-auto-dock-panel.madp-warn {
                background: linear-gradient(180deg, rgba(255,251,235,.985), rgba(255,247,237,.985)) !important;
            }
            #medinet-auto-dock-panel.madp-error {
                background: linear-gradient(180deg, rgba(254,242,242,.985), rgba(255,241,242,.985)) !important;
            }
            #medinet-auto-dock-panel .mnm-patient-card { background:rgba(255,255,255,.72)!important;border:1px solid rgba(15,23,42,.12)!important; }
            #medinet-auto-dock-panel .mnm-note { background:rgba(255,255,255,.78)!important;color:#92400e!important;border-color:rgba(217,119,6,.25)!important; }
            .mnm-toast, #medinet-auto-notice {
                display:none !important;
            }
            @media (max-width:640px) {
                #medinet-auto-dock-panel {
                    right: 68px !important;
                    bottom: 84px !important;
                    width: min(290px, calc(100vw - 82px)) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function escapeHtml(value) {
        const div = document.createElement('div');
        div.textContent = String(value || '');
        return div.innerHTML;
    }

    function renderSpeechBodyHtml(text, extraHtml) {
        const safe = String(text || '')
            .replace(/\r/g, '')
            .split('\n')
            .map(line => line.trim())
            .filter(Boolean)
            .map(line => `<span class="madp-speech-line">${escapeHtml(line)}</span>`)
            .join('');
        return (
            '<div class="madp-speech">' +
            (safe || '<span class="madp-speech-line">…</span>') +
            (extraHtml || '') +
            '</div>'
        );
    }

    function parseAutoNoticeMessage(message, fallbackTitle) {
        const raw = String(message || '').trim();
        const firstLine = raw.split('\n')[0] || String(fallbackTitle || 'Thông báo');
        const lower = norm(raw);
        let type = 'ok';
        if (firstLine.includes('❌') || lower.includes('lỗi')) {
            type = 'error';
        } else if (
            firstLine.includes('⚠️') ||
            lower.includes('cảnh báo') ||
            lower.includes('chưa hỗ trợ') ||
            lower.includes('không tìm thấy') ||
            lower.includes('chưa lưu')
        ) {
            type = 'warn';
        } else if (firstLine.includes('⏳') || lower.includes('đang')) {
            type = 'info';
        }
        const title = firstLine.replace(/[✅⚠️❌📋🚀⏳💾]/g, '').trim() || String(fallbackTitle || 'Thông báo');
        const body = raw.split('\n').slice(1).join('\n').replace(/^\s+|\s+$/g, '').replace(/Vui Lòng/gi, 'Vui lòng');
        return {
            raw,
            firstLine,
            lower,
            type,
            title,
            body: body || ''
        };
    }

    function showRunningSpeechBubble(message) {
        ensureUnifiedAutoSpeechBubbleStyles();
        ensureUnifiedAutoV759Styles();
        ensureUnifiedAutoV761Styles();
        ensureUnifiedAutoV762Styles();
        ensureUnifiedAutoV763Styles();
        ensureUnifiedAutoV764Styles();
        ensureUnifiedAutoV765Styles();
        ensureUnifiedAutoV768Styles();
        ensureUnifiedAutoV767Styles();
        ensureUnifiedAutoV767Styles();
        ensureUnifiedAutoV745Styles();
        const model = unifiedAutoRuntime.model || getCurrentMedinetModel() || 'AUTO';
        showAutoDockPanel(
            `${model} · Đang tự động điền`,
            renderSpeechBodyHtml(`Đang điền dữ liệu vào hồ sơ.
Vui lòng giữ nguyên trang đến khi hoàn tất.`),
            'info',
            0
        );
    }



    function ensureUnifiedAutoV744Styles() {

        if (document.getElementById('medinet-auto-v744-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'medinet-auto-v744-style';
        style.textContent = `
            /* =====================================================
               V7.44 - AUTO WHEEL + MANGA SPEECH BUBBLE
               Lớp cuối cùng: chủ động ghi đè toàn bộ UI cũ.
               ===================================================== */

            #medinet-auto-unified {
                width: 58px !important;
                height: 58px !important;
                right: 14px !important;
                bottom: 6px !important;
                border: 0 !important;
                padding: 0 !important;
                border-radius: 50% !important;
                background: transparent !important;
                box-shadow: 0 7px 16px rgba(15,23,42,.26) !important;
                overflow: visible !important;
                transform: none !important;
                filter: none !important;
                isolation: isolate !important;
            }

            #medinet-auto-unified:hover:not(:disabled) {
                transform: scale(1.045) !important;
                filter: none !important;
            }

            #medinet-auto-unified:active:not(:disabled) {
                transform: scale(.97) !important;
            }

            /* LỐP - nhìn như bánh xe, không như radar/đồng hồ */
            #medinet-auto-unified .mau-shell {
                position: absolute !important;
                inset: 0 !important;
                border-radius: 50% !important;
                background:
                    radial-gradient(circle at 50% 50%, transparent 0 64%, rgba(0,0,0,.25) 65% 67%, transparent 68%),
                    repeating-conic-gradient(
                        from 2deg,
                        #111827 0deg 8deg,
                        #263244 8deg 13deg,
                        #0b1220 13deg 20deg
                    ) !important;
                border: 2px solid #050a12 !important;
                box-shadow:
                    inset 0 0 0 3px rgba(71,85,105,.60),
                    inset 0 0 0 6px rgba(2,6,23,.92),
                    0 2px 7px rgba(2,6,23,.42) !important;
                animation: none !important;
                transform: none !important;
                opacity: 1 !important;
            }

            /* Mâm 8 chấu */
            #medinet-auto-unified .mau-ring {
                position: absolute !important;
                inset: 8px !important;
                border-radius: 50% !important;
                background:
                    radial-gradient(circle, transparent 0 25%, #0b1724 26% 33%, transparent 34%),
                    repeating-conic-gradient(
                        from 0deg,
                        #70e8ff 0deg 5deg,
                        #164e63 5deg 12deg,
                        transparent 12deg 40deg,
                        #38bdf8 40deg 45deg
                    ) !important;
                -webkit-mask: radial-gradient(circle, transparent 0 30%, #000 31% 100%) !important;
                mask: radial-gradient(circle, transparent 0 30%, #000 31% 100%) !important;
                border: 1px solid rgba(125,211,252,.80) !important;
                box-shadow:
                    inset 0 0 8px rgba(34,211,238,.34),
                    0 0 5px rgba(34,211,238,.28) !important;
                animation: none !important;
                opacity: 1 !important;
                transform: none !important;
            }

            /* vòng mâm phụ - tạo chiều sâu cơ khí */
            #medinet-auto-unified .mau-ring2 {
                position: absolute !important;
                inset: 13px !important;
                border-radius: 50% !important;
                background:
                    repeating-conic-gradient(
                        from 22.5deg,
                        rgba(226,232,240,.92) 0deg 3deg,
                        rgba(30,41,59,.95) 3deg 12deg,
                        transparent 12deg 42deg,
                        rgba(148,163,184,.78) 42deg 45deg
                    ) !important;
                -webkit-mask: radial-gradient(circle, transparent 0 45%, #000 46% 100%) !important;
                mask: radial-gradient(circle, transparent 0 45%, #000 46% 100%) !important;
                border: 0 !important;
                opacity: .92 !important;
                animation: none !important;
                transform: none !important;
                box-shadow: none !important;
            }

            /* hub */
            #medinet-auto-unified .mau-core {
                position: absolute !important;
                inset: 16px !important;
                border-radius: 50% !important;
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                justify-content: center !important;
                gap: 0 !important;
                background:
                    radial-gradient(circle at 38% 30%, #1e4760 0, #0b2233 38%, #07111d 72%, #020617 100%) !important;
                border: 1px solid rgba(186,230,253,.92) !important;
                box-shadow:
                    inset 0 0 0 2px rgba(14,116,144,.42),
                    inset 0 0 10px rgba(56,189,248,.34),
                    0 0 5px rgba(56,189,248,.32) !important;
                transform: none !important;
                animation: none !important;
                z-index: 6 !important;
            }

            #medinet-auto-unified .mau-core::after {
                display: none !important;
            }

            #medinet-auto-unified .mau-model {
                color: #f8fdff !important;
                font: 900 16px/1 'Segoe UI', Roboto, Arial, sans-serif !important;
                letter-spacing: -.4px !important;
                text-shadow: 0 1px 2px #000, 0 0 5px rgba(103,232,249,.58) !important;
                transform: none !important;
            }

            #medinet-auto-unified .mau-auto {
                margin-top: 2px !important;
                color: #8be9ff !important;
                font: 800 6px/1 'Segoe UI', Roboto, Arial, sans-serif !important;
                letter-spacing: .8px !important;
                text-shadow: 0 1px 2px #000 !important;
                transform: none !important;
            }

            /* bỏ hoàn toàn lửa/corona cũ */
            #medinet-auto-unified .mau-flames {
                display: none !important;
            }

            /* Điểm ma sát - chỉ hiện khi chạy */
            #medinet-auto-unified .mau-energy {
                position: absolute !important;
                inset: -3px !important;
                border-radius: 50% !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: 7 !important;
                background:
                    conic-gradient(
                        from 0deg,
                        transparent 0deg 28deg,
                        rgba(255,255,255,.98) 30deg 32deg,
                        #fde047 33deg 36deg,
                        #fb923c 37deg 40deg,
                        transparent 43deg 181deg,
                        rgba(255,255,255,.96) 184deg 186deg,
                        #fde047 187deg 190deg,
                        #f97316 191deg 194deg,
                        transparent 198deg 360deg
                    ) !important;
                -webkit-mask: radial-gradient(circle, transparent 0 77%, #000 78% 91%, transparent 92%) !important;
                mask: radial-gradient(circle, transparent 0 77%, #000 78% 91%, transparent 92%) !important;
                filter: drop-shadow(0 0 3px rgba(251,146,60,.9)) !important;
                animation: none !important;
            }

            #medinet-auto-unified .mau-sparks {
                position: absolute !important;
                inset: -12px !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: 8 !important;
                animation: none !important;
            }

            #medinet-auto-unified .mau-sparks i {
                position: absolute !important;
                left: 50% !important;
                top: 50% !important;
                width: 2px !important;
                height: 8px !important;
                border-radius: 2px !important;
                background: linear-gradient(#fff,#fde047 38%,#fb923c 72%,transparent) !important;
                transform-origin: 50% 0 !important;
                box-shadow: 0 0 4px rgba(251,146,60,.82) !important;
                animation: none !important;
            }

            #medinet-auto-unified .mau-sparks i:nth-child(1) { transform: rotate(28deg) translateY(-37px) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(2) { transform: rotate(64deg) translateY(-38px) scale(.72) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(3) { transform: rotate(205deg) translateY(-37px) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(4) { transform: rotate(242deg) translateY(-38px) scale(.7) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(5) { transform: rotate(330deg) translateY(-36px) scale(.55) !important; }

            /* RUNNING: lốp đứng yên, MÂM quay => nhìn đúng bánh xe hơn */
            #medinet-auto-unified.mau-running .mau-shell {
                animation: none !important;
            }
            #medinet-auto-unified.mau-running .mau-ring {
                animation: mau744-wheel-spin .72s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation: mau744-wheel-spin-rev 1.05s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity: 1 !important;
                animation: mau744-friction 1.1s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks {
                opacity: 1 !important;
                animation: mau744-spark-flicker .24s steps(2,end) infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation: mau744-core-pulse .85s ease-in-out infinite alternate !important;
            }
            #medinet-auto-unified.mau-running .mau-auto::after {
                content: ' •' !important;
                animation: mau744-dot .65s steps(2,end) infinite !important;
            }

            @keyframes mau744-wheel-spin { to { transform: rotate(360deg); } }
            @keyframes mau744-wheel-spin-rev { to { transform: rotate(-360deg); } }
            @keyframes mau744-friction { to { transform: rotate(360deg); } }
            @keyframes mau744-spark-flicker {
                0%,100% { opacity:.28; filter:brightness(.9); }
                45% { opacity:1; filter:brightness(1.45); }
            }
            @keyframes mau744-core-pulse {
                from { box-shadow: inset 0 0 0 2px rgba(14,116,144,.42), inset 0 0 8px rgba(56,189,248,.26), 0 0 4px rgba(56,189,248,.22); }
                to   { box-shadow: inset 0 0 0 2px rgba(34,211,238,.58), inset 0 0 13px rgba(56,189,248,.48), 0 0 9px rgba(34,211,238,.46); }
            }
            @keyframes mau744-dot { 50% { opacity:.15; } }

            /* Badge cảnh báo: nằm ngoài nhưng không làm biến dạng bánh xe */
            #medinet-auto-unified .mau-warning {
                width: 28px !important;
                height: 28px !important;
                right: -7px !important;
                top: -7px !important;
                z-index: 12 !important;
                border-radius: 50% !important;
                background: transparent !important;
            }
            #medinet-auto-unified .mau-warning::before {
                width: 17px !important;
                height: 17px !important;
                right: 3px !important;
                top: 3px !important;
                font-size: 11px !important;
                border: 2px solid #111827 !important;
                background: #f59e0b !important;
                color:#111827 !important;
                box-shadow: 0 2px 5px rgba(15,23,42,.28) !important;
            }

            /* =====================================================
               MANGA SPEECH BUBBLE - organic, không card, không trượt
               ===================================================== */
            #medinet-auto-dock-panel {
                position: fixed !important;
                right: 22px !important;
                bottom: 78px !important;
                width: min(338px, calc(100vw - 38px)) !important;
                max-height: min(56vh, 450px) !important;
                overflow: auto !important;
                padding: 0 !important;
                border: 2.5px solid #111827 !important;
                border-radius: 48% 52% 46% 54% / 18% 20% 17% 21% !important;
                background:
                    radial-gradient(circle at 16px 16px, rgba(15,23,42,.025) 0 1px, transparent 1.5px) 0 0/8px 8px,
                    #fff !important;
                color:#111827 !important;
                box-shadow: 5px 7px 0 rgba(17,24,39,.13), 0 14px 30px rgba(15,23,42,.18) !important;
                opacity: 0 !important;
                transform: scale(.94) !important;
                transform-origin: 88% 100% !important;
                transition: opacity .12s ease, transform .12s ease !important;
                z-index: 9999998 !important;
                isolation: isolate !important;
                font-family: 'Segoe UI',Roboto,Arial,sans-serif !important;
            }

            #medinet-auto-dock-panel.madp-show {
                opacity: 1 !important;
                transform: scale(1) !important;
            }

            /* đuôi thoại manga 2 lớp */
            #medinet-auto-dock-panel::before {
                content:'' !important;
                position:absolute !important;
                right:28px !important;
                bottom:-20px !important;
                width:0 !important;
                height:0 !important;
                border-left:8px solid transparent !important;
                border-right:18px solid transparent !important;
                border-top:24px solid #111827 !important;
                transform:rotate(-12deg) !important;
                z-index:0 !important;
            }
            #medinet-auto-dock-panel::after {
                content:'' !important;
                position:absolute !important;
                right:31px !important;
                bottom:-15px !important;
                width:0 !important;
                height:0 !important;
                border-left:7px solid transparent !important;
                border-right:15px solid transparent !important;
                border-top:20px solid #fff !important;
                transform:rotate(-12deg) !important;
                z-index:1 !important;
            }

            #medinet-auto-dock-panel .madp-head {
                position:relative !important;
                top:auto !important;
                display:flex !important;
                align-items:center !important;
                gap:8px !important;
                padding:15px 28px 4px 24px !important;
                border:0 !important;
                background:transparent !important;
                z-index:3 !important;
            }

            #medinet-auto-dock-panel .madp-pulse {
                width:8px !important;
                height:8px !important;
                flex:none !important;
                border-radius:50% !important;
                background:#111827 !important;
                box-shadow:none !important;
            }

            #medinet-auto-dock-panel .madp-title {
                color:#111827 !important;
                font:900 14px/1.2 'Segoe UI',Roboto,Arial,sans-serif !important;
                letter-spacing:.1px !important;
            }

            #medinet-auto-dock-panel .madp-close {
                position:absolute !important;
                right:12px !important;
                top:9px !important;
                width:24px !important;
                height:24px !important;
                border:0 !important;
                border-radius:50% !important;
                background:transparent !important;
                color:#111827 !important;
                font:900 19px/1 sans-serif !important;
                box-shadow:none !important;
            }

            #medinet-auto-dock-panel .madp-body {
                position:relative !important;
                z-index:3 !important;
                padding:5px 25px 18px 24px !important;
                color:#1f2937 !important;
                font:600 12.8px/1.48 'Segoe UI',Roboto,Arial,sans-serif !important;
                background:transparent !important;
            }

            #medinet-auto-dock-panel .madp-speech-line {
                margin-bottom:3px !important;
            }

            #medinet-auto-dock-panel .madp-running-note {
                margin-top:9px !important;
                padding:6px 0 0 !important;
                border:0 !important;
                border-top:1px dashed rgba(17,24,39,.28) !important;
                border-radius:0 !important;
                background:transparent !important;
                color:#111827 !important;
                font-weight:800 !important;
            }

            #medinet-auto-dock-panel.madp-warn {
                background:
                    radial-gradient(circle at 16px 16px, rgba(120,53,15,.035) 0 1px, transparent 1.5px) 0 0/8px 8px,
                    #fffaf0 !important;
                border-color:#7c2d12 !important;
            }
            #medinet-auto-dock-panel.madp-warn::before { border-top-color:#7c2d12 !important; }
            #medinet-auto-dock-panel.madp-warn::after { border-top-color:#fffaf0 !important; }

            #medinet-auto-dock-panel.madp-error {
                background:#fff5f5 !important;
                border-color:#991b1b !important;
            }
            #medinet-auto-dock-panel.madp-error::before { border-top-color:#991b1b !important; }
            #medinet-auto-dock-panel.madp-error::after { border-top-color:#fff5f5 !important; }

            /* Không dùng lại card/toast cũ */
            #medinet-auto-notice,
            .mnm-toast {
                display:none !important;
            }

            @media (max-width:640px) {
                #medinet-auto-unified {
                    width:54px !important;
                    height:54px !important;
                    right:9px !important;
                    bottom:5px !important;
                }
                #medinet-auto-unified .mau-core { inset:15px !important; }
                #medinet-auto-unified .mau-model { font-size:15px !important; }
                #medinet-auto-dock-panel {
                    right:10px !important;
                    bottom:70px !important;
                    width:min(300px,calc(100vw - 20px)) !important;
                }
                #medinet-auto-dock-panel::before { right:22px !important; }
                #medinet-auto-dock-panel::after { right:25px !important; }
            }
        `;
        document.head.appendChild(style);
    }


    function ensureUnifiedAutoV745Styles() {
        if (document.getElementById('medinet-auto-v745-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v745-style';
        style.textContent = `
            /* =====================================================
               V7.45 - WHEEL REBUILD + TRUE MANGA SPEECH BUBBLE
               Final override. No slide animation.
               ===================================================== */

            #medinet-auto-unified {
                width:60px !important;
                height:60px !important;
                right:10px !important;
                bottom:2px !important;
                overflow:visible !important;
                border-radius:50% !important;
                background:transparent !important;
                box-shadow:0 5px 14px rgba(2,6,23,.30) !important;
            }

            /* Tire: substantial dark rubber + visible tread. */
            #medinet-auto-unified .mau-shell {
                inset:0 !important;
                z-index:1 !important;
                border:2px solid #020617 !important;
                background:
                    repeating-conic-gradient(
                        from 0deg,
                        #111827 0deg 7deg,
                        #334155 7deg 10deg,
                        #0f172a 10deg 18deg
                    ) !important;
                box-shadow:
                    inset 0 0 0 3px #020617,
                    inset 0 0 0 5px #475569,
                    inset 0 0 10px rgba(0,0,0,.85),
                    0 2px 5px rgba(2,6,23,.42) !important;
                animation:none !important;
            }

            /* Real wheel face: 5 spokes, ONE cyan spoke => rotation is obvious. */
            #medinet-auto-unified .mau-ring {
                inset:7px !important;
                z-index:3 !important;
                border-radius:50% !important;
                border:1px solid #7dd3fc !important;
                background:
                    conic-gradient(
                        from -4deg,
                        #67e8f9 0deg 10deg,
                        transparent 10deg 70deg,
                        #94a3b8 70deg 80deg,
                        transparent 80deg 142deg,
                        #64748b 142deg 152deg,
                        transparent 152deg 214deg,
                        #94a3b8 214deg 224deg,
                        transparent 224deg 286deg,
                        #64748b 286deg 296deg,
                        transparent 296deg 360deg
                    ),
                    radial-gradient(circle at 50% 50%, #0f172a 0 31%, #1e293b 32% 41%, transparent 42%) !important;
                -webkit-mask:none !important;
                mask:none !important;
                box-shadow:
                    inset 0 0 0 3px rgba(15,23,42,.72),
                    inset 0 0 8px rgba(56,189,248,.25),
                    0 0 4px rgba(34,211,238,.20) !important;
                transform:rotate(0deg) !important;
                animation:none !important;
                transform-origin:50% 50% !important;
            }

            /* Brake disc: static perforated-looking ring, gives depth. */
            #medinet-auto-unified .mau-ring2 {
                inset:11px !important;
                z-index:4 !important;
                border:2px dotted rgba(203,213,225,.72) !important;
                border-radius:50% !important;
                background:radial-gradient(circle, transparent 0 55%, rgba(148,163,184,.20) 56% 72%, transparent 73%) !important;
                -webkit-mask:none !important;
                mask:none !important;
                box-shadow:none !important;
                opacity:.82 !important;
                transform:none !important;
                animation:none !important;
            }

            /* Hub enlarged so M2-M6 always readable. */
            #medinet-auto-unified .mau-core {
                inset:13px !important;
                z-index:20 !important;
                border:2px solid rgba(186,230,253,.96) !important;
                background:radial-gradient(circle at 38% 28%, #24516c 0 12%, #0e2c40 35%, #071522 72%, #020617 100%) !important;
                box-shadow:
                    inset 0 0 0 2px rgba(14,116,144,.50),
                    inset 0 0 10px rgba(34,211,238,.28),
                    0 0 5px rgba(34,211,238,.26) !important;
                animation:none !important;
                transform:none !important;
                pointer-events:none !important;
            }
            #medinet-auto-unified .mau-model {
                position:relative !important;
                z-index:22 !important;
                display:block !important;
                color:#ffffff !important;
                font:900 17px/1 'Segoe UI',Roboto,Arial,sans-serif !important;
                letter-spacing:-.6px !important;
                text-shadow:0 1px 2px #000,0 0 6px rgba(103,232,249,.68) !important;
                opacity:1 !important;
                visibility:visible !important;
            }
            #medinet-auto-unified .mau-auto {
                position:relative !important;
                z-index:22 !important;
                display:block !important;
                margin-top:2px !important;
                color:#a5f3fc !important;
                font:900 6px/1 'Segoe UI',Roboto,Arial,sans-serif !important;
                letter-spacing:.9px !important;
                opacity:1 !important;
            }

            /* Remove every legacy flame/spark treatment. */
            #medinet-auto-unified .mau-flames,
            #medinet-auto-unified .mau-sparks { display:none !important; }

            /* A slim friction arc rides the rim while running, below the text. */
            #medinet-auto-unified .mau-energy {
                display:block !important;
                inset:-2px !important;
                z-index:9 !important;
                opacity:0 !important;
                border-radius:50% !important;
                background:conic-gradient(from 0deg, transparent 0 310deg, #fff 314deg 318deg, #fde047 319deg 326deg, #fb923c 327deg 334deg, transparent 338deg 360deg) !important;
                -webkit-mask:radial-gradient(circle,transparent 0 79%,#000 80% 91%,transparent 92%) !important;
                mask:radial-gradient(circle,transparent 0 79%,#000 80% 91%,transparent 92%) !important;
                filter:drop-shadow(0 0 3px rgba(251,146,60,.78)) !important;
                animation:none !important;
            }

            /* Running: wheel face rotates clearly; hub remains fixed/readable. */
            #medinet-auto-unified.mau-running .mau-ring {
                animation:mau745-wheel 1.05s cubic-bezier(.42,0,.58,1) infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation:mau745-disc .68s linear infinite reverse !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1 !important;
                animation:mau745-friction .78s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation:mau745-hub .8s ease-in-out infinite alternate !important;
            }
            @keyframes mau745-wheel {
                0%   { transform:rotate(0deg); }
                35%  { transform:rotate(132deg); }
                70%  { transform:rotate(272deg); }
                100% { transform:rotate(360deg); }
            }
            @keyframes mau745-disc { to { transform:rotate(360deg); } }
            @keyframes mau745-friction { to { transform:rotate(360deg); } }
            @keyframes mau745-hub {
                from { filter:brightness(.96); }
                to   { filter:brightness(1.14); }
            }

            /* =====================================================
               Manga speech bubble: compact, classic oval balloon.
               No slide. No stretched organic card. No duplicated text.
               ===================================================== */
            #medinet-auto-dock-panel {
                position:fixed !important;
                right:16px !important;
                bottom:72px !important;
                width:auto !important;
                min-width:210px !important;
                max-width:min(310px,calc(100vw - 28px)) !important;
                max-height:min(48vh,360px) !important;
                overflow:auto !important;
                border:2.5px solid #111827 !important;
                border-radius:30px !important;
                background:#fff !important;
                color:#111827 !important;
                box-shadow:4px 5px 0 rgba(17,24,39,.12),0 10px 24px rgba(15,23,42,.16) !important;
                opacity:1 !important;
                transform:none !important;
                transition:none !important;
                animation:mau745-pop .10s ease-out both !important;
                transform-origin:88% 100% !important;
                z-index:9999998 !important;
                isolation:isolate !important;
            }
            #medinet-auto-dock-panel.madp-show {
                opacity:1 !important;
                transform:none !important;
            }
            @keyframes mau745-pop {
                from { opacity:0; scale:.96; }
                to   { opacity:1; scale:1; }
            }

            /* Pointed manga tail aiming at AUTO wheel. */
            #medinet-auto-dock-panel::before {
                content:'' !important;
                position:absolute !important;
                right:22px !important;
                bottom:-18px !important;
                width:28px !important;
                height:22px !important;
                background:#111827 !important;
                clip-path:polygon(5% 0,100% 0,92% 12%,20% 100%) !important;
                z-index:0 !important;
                transform:none !important;
                border:0 !important;
            }
            #medinet-auto-dock-panel::after {
                content:'' !important;
                position:absolute !important;
                right:24px !important;
                bottom:-13px !important;
                width:23px !important;
                height:17px !important;
                background:#fff !important;
                clip-path:polygon(4% 0,100% 0,91% 11%,20% 100%) !important;
                z-index:1 !important;
                transform:none !important;
                border:0 !important;
            }

            #medinet-auto-dock-panel .madp-head {
                position:relative !important;
                display:flex !important;
                align-items:center !important;
                gap:7px !important;
                padding:12px 35px 3px 16px !important;
                border:0 !important;
                background:transparent !important;
                min-height:0 !important;
            }
            #medinet-auto-dock-panel .madp-pulse {
                width:7px !important;height:7px !important;
                border-radius:50% !important;
                background:#111827 !important;
                box-shadow:none !important;
                flex:none !important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#111827 !important;
                font:900 13.5px/1.2 'Segoe UI',Roboto,Arial,sans-serif !important;
            }
            #medinet-auto-dock-panel .madp-close {
                position:absolute !important;
                right:10px !important;
                top:7px !important;
                width:24px !important;height:24px !important;
                border:0 !important;background:transparent !important;
                color:#111827 !important;
                font:900 18px/1 sans-serif !important;
                box-shadow:none !important;
            }
            #medinet-auto-dock-panel .madp-body {
                padding:4px 17px 13px 16px !important;
                background:transparent !important;
                color:#1f2937 !important;
                font:600 12.5px/1.45 'Segoe UI',Roboto,Arial,sans-serif !important;
            }
            #medinet-auto-dock-panel .madp-running-note { display:none !important; }
            #medinet-auto-dock-panel .madp-speech-line {
                display:block !important;
                margin:0 0 3px !important;
            }
            #medinet-auto-dock-panel.madp-warn {
                background:#fffaf0 !important;
                border-color:#7c2d12 !important;
            }
            #medinet-auto-dock-panel.madp-warn::before { background:#7c2d12 !important; }
            #medinet-auto-dock-panel.madp-warn::after { background:#fffaf0 !important; }
            #medinet-auto-dock-panel.madp-error {
                background:#fff5f5 !important;
                border-color:#991b1b !important;
            }
            #medinet-auto-dock-panel.madp-error::before { background:#991b1b !important; }
            #medinet-auto-dock-panel.madp-error::after { background:#fff5f5 !important; }

            @media (max-width:640px) {
                #medinet-auto-unified {
                    width:56px !important;height:56px !important;
                    right:7px !important;bottom:1px !important;
                }
                #medinet-auto-unified .mau-core { inset:12px !important; }
                #medinet-auto-unified .mau-model { font-size:16px !important; }
                #medinet-auto-dock-panel {
                    right:8px !important;
                    bottom:66px !important;
                    min-width:190px !important;
                    max-width:min(285px,calc(100vw - 16px)) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV746Styles() {
        if (document.getElementById('medinet-auto-v746-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v746-style';
        style.textContent = `
            #medinet-auto-unified.mau-running .mau-ring {
                animation:mau746-wheel-spin .72s linear infinite !important;
                will-change:rotate !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation:mau746-disc-spin .46s linear infinite !important;
                will-change:rotate !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1 !important;
                animation:mau746-energy-spin .62s linear infinite !important;
                will-change:rotate !important;
            }
            @keyframes mau746-wheel-spin { from { rotate:0deg; } to { rotate:360deg; } }
            @keyframes mau746-disc-spin { from { rotate:0deg; } to { rotate:-360deg; } }
            @keyframes mau746-energy-spin { from { rotate:0deg; } to { rotate:360deg; } }
            #medinet-auto-unified .mau-core,
            #medinet-auto-unified .mau-model,
            #medinet-auto-unified .mau-auto { rotate:0deg !important; }

            #medinet-auto-dock-panel {
                max-height:none !important;
                overflow:visible !important;
                overscroll-behavior:none !important;
                scrollbar-width:none !important;
                width:fit-content !important;
                min-width:0 !important;
                max-width:min(330px,calc(100vw - 22px)) !important;
            }
            #medinet-auto-dock-panel::-webkit-scrollbar,
            #medinet-auto-dock-panel .madp-body::-webkit-scrollbar { display:none !important; width:0 !important; height:0 !important; }
            #medinet-auto-dock-panel .madp-body { max-height:none !important; overflow:visible !important; }
            #medinet-auto-dock-panel .madp-close { display:none !important; }
            #medinet-auto-dock-panel .madp-head { padding-right:16px !important; }
            @media (max-width:640px) {
                #medinet-auto-dock-panel { max-width:min(280px,calc(100vw - 14px)) !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function getAutoUiContextKey() {
        let title = '';
        try {
            const el = document.querySelector('h2.hidden-web-title, .hidden-web-title');
            title = el ? norm(el.innerText) : '';
        } catch (e) {}
        return `${location.href}|${title}|${getCurrentMedinetModel() || ''}`;
    }

    function getCurrentPatientKey() {
        if (isModelListPage()) return '';

        try {
            const url = new URL(location.href);
            const params = url.searchParams;
            const phieu =
                params.get('phieukhamId') ||
                params.get('phieuKhamId') ||
                params.get('phieukhamid') ||
                '';
            const cdId =
                params.get('cdId') ||
                params.get('cdid') ||
                '';
            const model = getCurrentMedinetModel() || '';

            if (phieu) return `${model}|phieu:${phieu}`;
            if (cdId) return `${model}|cd:${cdId}`;

            const pathIds = Array.from(url.pathname.matchAll(/\/(\d{5,})(?=\/|$)/g));
            if (pathIds.length) {
                return `${model}|path:${pathIds[pathIds.length - 1][1]}`;
            }
        } catch (e) {}

        // Fallback DOM: chỉ dùng khi URL không có ID bệnh nhân.
        try {
            const body = document.body ? document.body.innerText : '';
            const cccdMatch = body.match(/CCCD\s*:?\s*([0-9]{9,12})/i);
            if (cccdMatch) {
                return `${getCurrentMedinetModel() || ''}|cccd:${cccdMatch[1]}`;
            }
        } catch (e) {}

        return '';
    }

    function saveLastCanLamSangReport() {
        try {
            if (!lastCanLamSangReport || !lastCanLamSangReportPatientKey) return;
            sessionStorage.setItem(
                LAST_CLS_REPORT_STORAGE_KEY,
                JSON.stringify({
                    patientKey: lastCanLamSangReportPatientKey,
                    report: lastCanLamSangReport
                })
            );
        } catch (e) {
            console.warn(LOG, 'Không lưu được cảnh báo CLS theo bệnh nhân:', e);
        }
    }

    function clearLastCanLamSangReport() {
        lastCanLamSangReport = null;
        lastCanLamSangReportPatientKey = '';
        try {
            sessionStorage.removeItem(LAST_CLS_REPORT_STORAGE_KEY);
        } catch (e) {}
        closeAutoDockPanel();
        updateUnifiedAutoButton();
    }

    function restoreLastCanLamSangReport() {
        if (isModelListPage()) {
            clearLastCanLamSangReport();
            return;
        }

        const currentPatientKey = getCurrentPatientKey();
        if (!currentPatientKey) return;

        if (
            lastCanLamSangReport &&
            lastCanLamSangReportPatientKey === currentPatientKey
        ) {
            return;
        }

        try {
            const raw = sessionStorage.getItem(LAST_CLS_REPORT_STORAGE_KEY);
            if (!raw) return;
            const stored = JSON.parse(raw);
            if (
                stored &&
                stored.patientKey === currentPatientKey &&
                stored.report
            ) {
                lastCanLamSangReportPatientKey = stored.patientKey;
                lastCanLamSangReport = stored.report;
            } else if (stored && stored.patientKey && stored.patientKey !== currentPatientKey) {
                // Tránh mang cảnh báo của bệnh nhân khác nếu mở hồ sơ trực tiếp.
                clearLastCanLamSangReport();
            }
        } catch (e) {
            console.warn(LOG, 'Không khôi phục được cảnh báo CLS:', e);
        }
    }

    function ensureAutoDockContextWatcher() {
        if (window.__medinetAutoDockContextWatcher) return;
        window.__medinetAutoDockContextWatcher = window.setInterval(() => {
            const panel = document.getElementById('medinet-auto-dock-panel');
            if (!panel) return;
            const initial = panel.dataset.contextKey || '';
            if (initial && getAutoUiContextKey() !== initial) closeAutoDockPanel();
        }, 450);
    }


    function ensureUnifiedAutoV747Styles() {
        if (document.getElementById('medinet-auto-v747-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v747-style';
        style.textContent = `
            /* =====================================================
               v7.47 — clean manga tail + sane scrolling
               ===================================================== */
            #medinet-auto-dock-panel {
                overflow:visible !important;
                max-height:none !important;
                scrollbar-width:none !important;
            }
            #medinet-auto-dock-panel::-webkit-scrollbar {
                display:none !important;
                width:0 !important;
                height:0 !important;
            }

            /* Kill every legacy two-layer/brown tail. */
            #medinet-auto-dock-panel::before {
                content:none !important;
                display:none !important;
            }

            /* One clean manga tail only. */
            #medinet-auto-dock-panel::after {
                content:'' !important;
                display:block !important;
                position:absolute !important;
                right:23px !important;
                bottom:-9px !important;
                width:16px !important;
                height:16px !important;
                background:#fff !important;
                border-right:2.5px solid #111827 !important;
                border-bottom:2.5px solid #111827 !important;
                border-top:0 !important;
                border-left:0 !important;
                clip-path:none !important;
                transform:rotate(45deg) !important;
                z-index:-1 !important;
                box-shadow:none !important;
            }

            /* Short notices NEVER scroll. */
            #medinet-auto-dock-panel:not(.madp-long) .madp-body {
                max-height:none !important;
                overflow:visible !important;
                scrollbar-width:none !important;
            }
            #medinet-auto-dock-panel:not(.madp-long) .madp-body::-webkit-scrollbar {
                display:none !important;
                width:0 !important;
                height:0 !important;
            }

            /* Only a genuinely long report scrolls its BODY, never the bubble shell. */
            #medinet-auto-dock-panel.madp-long {
                width:min(350px,calc(100vw - 28px)) !important;
                max-height:none !important;
                overflow:visible !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                max-height:min(48vh,360px) !important;
                overflow-y:auto !important;
                overflow-x:hidden !important;
                scrollbar-width:thin !important;
                scrollbar-color:rgba(71,85,105,.38) transparent !important;
                padding-right:11px !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar {
                display:block !important;
                width:5px !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar-track {
                background:transparent !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar-thumb {
                background:rgba(71,85,105,.30) !important;
                border-radius:999px !important;
            }
        `;
        document.head.appendChild(style);
    }

    function isLongAutoDockContent(bodyHtml) {
        const html = String(bodyHtml || '');
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        const plain = (tmp.innerText || tmp.textContent || '').trim();

        // v7.77: Every CLS inspector report (xai-*) MUST use the
        // content-driven responsive layout. The old detector only knew
        // mnm-* classes, so xai reports could fall back to the compact
        // ~350px notice layout and appear "fixed" regardless of content.
        if (tmp.querySelector('.xai-report')) {
            return true;
        }

        return (
            plain.length > 650 ||
            tmp.querySelectorAll('li').length > 7 ||
            tmp.querySelectorAll('.mnm-finding-row').length > 4 ||
            (!!tmp.querySelector('.mnm-patient-card') && plain.length > 420)
        );
    }


    function ensureUnifiedAutoV748Styles() {
        if (document.getElementById('medinet-auto-v748-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v748-style';
        style.textContent = `
            /* =====================================================
               v7.48 — readable selection + bulletproof AUTO label
               ===================================================== */

            /* Text selection inside speech/report panel must stay readable. */
            #medinet-auto-dock-panel ::selection {
                background:#bae6fd !important;
                color:#082f49 !important;
                text-shadow:none !important;
            }
            #medinet-auto-dock-panel ::-moz-selection {
                background:#bae6fd !important;
                color:#082f49 !important;
                text-shadow:none !important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                -webkit-text-fill-color:currentColor !important;
            }

            /* Wheel layers are never allowed above the label hub. */
            #medinet-auto-unified {
                isolation:isolate !important;
                overflow:visible !important;
            }
            #medinet-auto-unified .mau-shell { z-index:1 !important; }
            #medinet-auto-unified .mau-ring  { z-index:4 !important; }
            #medinet-auto-unified .mau-ring2 { z-index:5 !important; }
            #medinet-auto-unified .mau-energy{ z-index:6 !important; }
            #medinet-auto-unified .mau-flames,
            #medinet-auto-unified .mau-sparks { z-index:7 !important; }

            /* Opaque hub masks every spinning layer below it. */
            #medinet-auto-unified .mau-core {
                z-index:50 !important;
                isolation:isolate !important;
                overflow:hidden !important;
                opacity:1 !important;
                visibility:visible !important;
                mix-blend-mode:normal !important;
                background:
                    radial-gradient(circle at 38% 28%,#2b607d 0 10%,#12394f 28%,#081b2a 64%,#020617 100%) !important;
                box-shadow:
                    inset 0 0 0 2px rgba(165,243,252,.62),
                    inset 0 0 12px rgba(34,211,238,.22),
                    0 0 0 1px rgba(2,6,23,.92),
                    0 0 6px rgba(34,211,238,.28) !important;
                filter:none !important;
            }
            #medinet-auto-unified .mau-core::before,
            #medinet-auto-unified .mau-core::after {
                z-index:0 !important;
                pointer-events:none !important;
                opacity:.45 !important;
            }

            /* Label gets its own top layer and can never inherit rotor opacity/filter. */
            #medinet-auto-unified .mau-model,
            #medinet-auto-unified .mau-auto {
                position:relative !important;
                z-index:99 !important;
                opacity:1 !important;
                visibility:visible !important;
                display:block !important;
                transform:none !important;
                rotate:0deg !important;
                filter:none !important;
                mix-blend-mode:normal !important;
                -webkit-text-fill-color:currentColor !important;
                pointer-events:none !important;
            }
            #medinet-auto-unified .mau-model {
                color:#ffffff !important;
                font:900 17px/1 'Segoe UI',Roboto,Arial,sans-serif !important;
                text-shadow:0 1px 2px #000,0 0 5px rgba(103,232,249,.78) !important;
            }
            #medinet-auto-unified .mau-auto {
                color:#a5f3fc !important;
                font:900 6px/1 'Segoe UI',Roboto,Arial,sans-serif !important;
                letter-spacing:.85px !important;
                text-shadow:0 1px 1px rgba(0,0,0,.9) !important;
            }

            /* Running effects only touch the rotor, never the hub/text. */
            #medinet-auto-unified.mau-running .mau-core,
            #medinet-auto-unified.mau-running .mau-model,
            #medinet-auto-unified.mau-running .mau-auto {
                animation:none !important;
                transform:none !important;
                rotate:0deg !important;
                opacity:1 !important;
                visibility:visible !important;
            }
        `;
        document.head.appendChild(style);
    }


    function ensureUnifiedAutoV749Styles() {
        if (document.getElementById('medinet-auto-v749-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v749-style';
        style.textContent = `
            /* =====================================================
               v7.49 — visible patient values + real DOM manga tail
               ===================================================== */

            /* Kill every pseudo-element tail from every old version. */
            #medinet-auto-dock-panel::before,
            #medinet-auto-dock-panel::after {
                content:none !important;
                display:none !important;
                border:0 !important;
                background:transparent !important;
                box-shadow:none !important;
            }

            /* Real manga tail: two nested triangles, no brown artifact. */
            #medinet-auto-dock-panel .madp-tail {
                position:absolute !important;
                right:22px !important;
                bottom:-15px !important;
                width:0 !important;
                height:0 !important;
                border-left:11px solid transparent !important;
                border-right:4px solid transparent !important;
                border-top:16px solid #111827 !important;
                z-index:4 !important;
                pointer-events:none !important;
                filter:none !important;
            }
            #medinet-auto-dock-panel .madp-tail::after {
                content:'' !important;
                position:absolute !important;
                left:-7px !important;
                top:-16px !important;
                width:0 !important;
                height:0 !important;
                border-left:8px solid transparent !important;
                border-right:2px solid transparent !important;
                border-top:12px solid #fffdf7 !important;
            }
            #medinet-auto-dock-panel.madp-warn .madp-tail::after { border-top-color:#fffaf0 !important; }
            #medinet-auto-dock-panel.madp-error .madp-tail::after { border-top-color:#fff5f5 !important; }

            /* Patient card values must NEVER inherit portal/extension colors. */
            #medinet-auto-dock-panel .mnm-patient-card {
                color:#111827 !important;
                -webkit-text-fill-color:#111827 !important;
                background:#ffffff !important;
                border:1px solid #d9dee7 !important;
            }
            #medinet-auto-dock-panel .mnm-patient-card span {
                color:#334155 !important;
                -webkit-text-fill-color:#334155 !important;
                opacity:1 !important;
                visibility:visible !important;
            }
            #medinet-auto-dock-panel .mnm-patient-card b,
            #medinet-auto-dock-panel .mnm-patient-card strong {
                color:#0f172a !important;
                -webkit-text-fill-color:#0f172a !important;
                background:transparent !important;
                opacity:1 !important;
                visibility:visible !important;
                text-shadow:none !important;
                font-weight:800 !important;
            }
            #medinet-auto-dock-panel .mnm-patient-card ::selection {
                background:#bfdbfe !important;
                color:#0f172a !important;
                -webkit-text-fill-color:#0f172a !important;
            }

            #medinet-auto-dock-panel .madp-no-abnormal {
                margin:4px 0 2px !important;
                padding:10px 12px !important;
                border-radius:12px !important;
                border:1px solid #bbf7d0 !important;
                background:#f0fdf4 !important;
                color:#166534 !important;
                -webkit-text-fill-color:#166534 !important;
                font-weight:800 !important;
            }
            #medinet-auto-dock-panel .madp-save-reminder {
                margin-top:10px !important;
                padding:9px 11px !important;
                border-radius:11px !important;
                border:1px dashed #d97706 !important;
                background:#fffbeb !important;
                color:#92400e !important;
                -webkit-text-fill-color:#92400e !important;
                font-weight:800 !important;
            }
        `;
        document.head.appendChild(style);
    }

    const unifiedAutoRuntime = {
        running: false,
        model: '',
        lastMessage: '',
        blocked: false,
        reportShown: false
    };

    function normalizeAutoMessageModel(message) {

        const model =
            unifiedAutoRuntime.model ||
            getCurrentMedinetModel();

        if (!model) {
            return String(message || '');
        }

        return String(message || '').replace(
            /\bM[2-6]\b/g,
            model
        );
    }

    function htmlToPlainText(html) {
        const box = document.createElement('div');
        box.innerHTML = String(html || '');
        return (box.innerText || box.textContent || '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
    }


    function ensureUnifiedAutoV750Styles() {
        if (document.getElementById('medinet-auto-v750-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v750-style';
        style.textContent = `
            /* =====================================================
               v7.50 — ALWAYS-ALIVE WHEEL + BLUE PLASMA SPARKS
               Idle = slow rotation. Running = fast rotation + sparks.
               ===================================================== */

            /* Keep the central label absolutely stable/readable. */
            #medinet-auto-unified .mau-core,
            #medinet-auto-unified .mau-model,
            #medinet-auto-unified .mau-auto {
                rotate: 0deg !important;
                transform: none !important;
                animation: none !important;
            }

            /* IDLE: the wheel is always alive. Use rotate, not transform,
               so legacy transform:...!important rules cannot freeze it. */
            #medinet-auto-unified .mau-ring {
                animation: mau750-idle-wheel 4.8s linear infinite !important;
                transform: none !important;
                transform-origin: 50% 50% !important;
                will-change: rotate;
            }
            #medinet-auto-unified .mau-ring2 {
                animation: mau750-idle-disc 7.2s linear infinite !important;
                transform: none !important;
                transform-origin: 50% 50% !important;
                will-change: rotate;
            }
            @keyframes mau750-idle-wheel {
                from { rotate: 0deg; }
                to   { rotate: 360deg; }
            }
            @keyframes mau750-idle-disc {
                from { rotate: 0deg; }
                to   { rotate: -360deg; }
            }

            /* Running = clearly faster, counter-rotating mechanics. */
            #medinet-auto-unified.mau-running .mau-ring {
                animation: mau750-run-wheel .58s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation: mau750-run-disc .86s linear infinite !important;
            }
            @keyframes mau750-run-wheel {
                from { rotate: 0deg; }
                to   { rotate: 360deg; }
            }
            @keyframes mau750-run-disc {
                from { rotate: 0deg; }
                to   { rotate: -360deg; }
            }

            /* No orange fire. Blue plasma dots orbit only while AUTO is active. */
            #medinet-auto-unified .mau-flames {
                display: none !important;
            }
            #medinet-auto-unified .mau-sparks {
                display: block !important;
                position: absolute !important;
                inset: -7px !important;
                z-index: 30 !important;
                pointer-events: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
                transform: none !important;
                rotate: 0deg !important;
            }
            #medinet-auto-unified .mau-sparks i {
                display: block !important;
                position: absolute !important;
                left: 50% !important;
                top: 50% !important;
                width: 4px !important;
                height: 4px !important;
                margin: -2px 0 0 -2px !important;
                border-radius: 50% !important;
                background: #bffcff !important;
                border: 0 !important;
                box-shadow:
                    0 0 4px #fff,
                    0 0 8px #67e8f9,
                    0 0 14px #22d3ee,
                    0 0 20px rgba(14,165,233,.75) !important;
                opacity: 0 !important;
                filter: none !important;
            }

            /* Five different radii/angles = irregular electric embers, not a halo. */
            #medinet-auto-unified .mau-sparks i:nth-child(1) { transform: rotate(12deg)  translateY(-35px) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(2) { transform: rotate(78deg)  translateY(-32px) scale(.75) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(3) { transform: rotate(161deg) translateY(-36px) scale(.62) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(4) { transform: rotate(246deg) translateY(-33px) scale(.82) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(5) { transform: rotate(319deg) translateY(-37px) scale(.55) !important; }

            #medinet-auto-unified.mau-running .mau-sparks {
                opacity: 1 !important;
                visibility: visible !important;
                animation: mau750-spark-orbit .72s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation: mau750-spark-pulse .48s ease-in-out infinite alternate !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(2) { animation-delay: -.16s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(3) { animation-delay: -.31s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(4) { animation-delay: -.23s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(5) { animation-delay: -.39s !important; }

            @keyframes mau750-spark-orbit {
                from { rotate: 0deg; }
                to   { rotate: 360deg; }
            }
            @keyframes mau750-spark-pulse {
                0%   { opacity:.22; filter:brightness(.85); }
                45%  { opacity:1; filter:brightness(1.9); }
                100% { opacity:.45; filter:brightness(1.15); }
            }

            /* Energy ring becomes cyan while running, not orange friction fire. */
            #medinet-auto-unified .mau-energy {
                display:block !important;
                opacity:0 !important;
                background: conic-gradient(
                    from 0deg,
                    transparent 0 296deg,
                    rgba(255,255,255,.95) 300deg 305deg,
                    #a5f3fc 306deg 317deg,
                    #22d3ee 318deg 330deg,
                    transparent 334deg 360deg
                ) !important;
                filter: drop-shadow(0 0 3px #67e8f9) drop-shadow(0 0 7px rgba(34,211,238,.75)) !important;
                transform:none !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1 !important;
                animation:mau750-energy .5s linear infinite !important;
            }
            @keyframes mau750-energy {
                from { rotate:0deg; }
                to   { rotate:360deg; }
            }

            /* Idle glow is subtle; active glow is clearly stronger. */
            #medinet-auto-unified {
                filter: drop-shadow(0 2px 5px rgba(2,6,23,.34)) drop-shadow(0 0 3px rgba(34,211,238,.18)) !important;
            }
            #medinet-auto-unified.mau-running {
                filter: drop-shadow(0 2px 5px rgba(2,6,23,.38)) drop-shadow(0 0 8px rgba(34,211,238,.72)) !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV751Styles() {
        if (document.getElementById('medinet-auto-v751-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v751-style';
        style.textContent = `
            /* =====================================================
               v7.51 — ARC REACTOR REFINEMENT
               - Bigger, cleaner reactor inspired by Iron Man chest core.
               - Sits lower/right to avoid covering Medinet UI.
               - Idle slow spin, running = fast spin + blue sparks.
               ===================================================== */
            #medinet-auto-unified {
                width: 68px !important;
                height: 68px !important;
                right: 18px !important;
                bottom: 18px !important;
                overflow: visible !important;
                border-radius: 50% !important;
                filter:
                    drop-shadow(0 6px 14px rgba(2,6,23,.34))
                    drop-shadow(0 0 6px rgba(34,211,238,.22)) !important;
            }

            #medinet-auto-unified .mau-shell {
                inset: 1px !important;
                border: 1px solid rgba(147,197,253,.22) !important;
                background:
                    radial-gradient(circle at 50% 50%, rgba(10,33,55,.35) 0 37%, rgba(7,22,38,.90) 38%, rgba(4,14,27,.98) 62%, #02060d 100%) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,.05),
                    inset 0 0 14px rgba(56,189,248,.08),
                    0 0 0 1px rgba(2,6,23,.92),
                    0 0 16px rgba(34,211,238,.12) !important;
            }
            #medinet-auto-unified .mau-shell::before {
                inset: 7px !important;
                border: 1px solid rgba(186,230,253,.17) !important;
                box-shadow:
                    inset 0 0 10px rgba(125,211,252,.08),
                    0 0 6px rgba(34,211,238,.10) !important;
                opacity: 1 !important;
            }
            #medinet-auto-unified .mau-shell::after {
                content: '' !important;
                position: absolute !important;
                inset: 10px !important;
                border-radius: 50% !important;
                border: 1px dashed rgba(125,211,252,.18) !important;
                box-shadow: 0 0 6px rgba(34,211,238,.10) inset !important;
                opacity: 1 !important;
            }

            /* Outer reactor fins */
            #medinet-auto-unified .mau-ring {
                inset: 4px !important;
                background: conic-gradient(
                    from -18deg,
                    rgba(255,255,255,.0) 0 12deg,
                    rgba(224,242,254,.98) 12deg 16deg,
                    rgba(56,189,248,.96) 16deg 28deg,
                    rgba(2,6,23,0) 28deg 42deg,
                    rgba(224,242,254,.94) 42deg 46deg,
                    rgba(14,165,233,.90) 46deg 59deg,
                    rgba(2,6,23,0) 59deg 74deg,
                    rgba(224,242,254,.96) 74deg 78deg,
                    rgba(34,211,238,.90) 78deg 91deg,
                    rgba(2,6,23,0) 91deg 106deg,
                    rgba(224,242,254,.96) 106deg 110deg,
                    rgba(56,189,248,.90) 110deg 123deg,
                    rgba(2,6,23,0) 123deg 138deg,
                    rgba(224,242,254,.96) 138deg 142deg,
                    rgba(14,165,233,.90) 142deg 155deg,
                    rgba(2,6,23,0) 155deg 170deg,
                    rgba(224,242,254,.96) 170deg 174deg,
                    rgba(34,211,238,.90) 174deg 187deg,
                    rgba(2,6,23,0) 187deg 202deg,
                    rgba(224,242,254,.96) 202deg 206deg,
                    rgba(56,189,248,.90) 206deg 219deg,
                    rgba(2,6,23,0) 219deg 234deg,
                    rgba(224,242,254,.96) 234deg 238deg,
                    rgba(14,165,233,.90) 238deg 251deg,
                    rgba(2,6,23,0) 251deg 266deg,
                    rgba(224,242,254,.96) 266deg 270deg,
                    rgba(34,211,238,.90) 270deg 283deg,
                    rgba(2,6,23,0) 283deg 298deg,
                    rgba(224,242,254,.96) 298deg 302deg,
                    rgba(56,189,248,.90) 302deg 315deg,
                    rgba(2,6,23,0) 315deg 330deg,
                    rgba(224,242,254,.96) 330deg 334deg,
                    rgba(14,165,233,.90) 334deg 347deg,
                    rgba(2,6,23,0) 347deg 360deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 4px), #000 0) !important;
                filter: drop-shadow(0 0 4px rgba(56,189,248,.35)) !important;
            }
            /* Inner segmented chamber */
            #medinet-auto-unified .mau-ring2 {
                inset: 13px !important;
                background: conic-gradient(
                    from 14deg,
                    rgba(255,255,255,.0) 0 22deg,
                    rgba(186,230,253,.95) 22deg 25deg,
                    rgba(99,102,241,.56) 25deg 42deg,
                    rgba(255,255,255,.0) 42deg 67deg,
                    rgba(186,230,253,.92) 67deg 70deg,
                    rgba(34,211,238,.74) 70deg 88deg,
                    rgba(255,255,255,.0) 88deg 112deg,
                    rgba(186,230,253,.95) 112deg 115deg,
                    rgba(99,102,241,.56) 115deg 133deg,
                    rgba(255,255,255,.0) 133deg 157deg,
                    rgba(186,230,253,.92) 157deg 160deg,
                    rgba(34,211,238,.74) 160deg 178deg,
                    rgba(255,255,255,.0) 178deg 202deg,
                    rgba(186,230,253,.95) 202deg 205deg,
                    rgba(99,102,241,.56) 205deg 223deg,
                    rgba(255,255,255,.0) 223deg 247deg,
                    rgba(186,230,253,.92) 247deg 250deg,
                    rgba(34,211,238,.74) 250deg 268deg,
                    rgba(255,255,255,.0) 268deg 292deg,
                    rgba(186,230,253,.95) 292deg 295deg,
                    rgba(99,102,241,.56) 295deg 313deg,
                    rgba(255,255,255,.0) 313deg 337deg,
                    rgba(186,230,253,.92) 337deg 340deg,
                    rgba(34,211,238,.74) 340deg 360deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0) !important;
                filter: drop-shadow(0 0 4px rgba(125,211,252,.28)) !important;
            }

            #medinet-auto-unified .mau-core {
                inset: 16px !important;
                background:
                    radial-gradient(circle at 50% 50%, rgba(232,253,255,.98) 0 12%, rgba(154,246,255,.88) 13%, rgba(74,222,255,.68) 24%, rgba(10,86,115,.88) 48%, rgba(4,20,35,.98) 73%, rgba(1,8,18,.98) 100%) !important;
                border: 1px solid rgba(191,244,255,.36) !important;
                box-shadow:
                    inset 0 0 10px rgba(255,255,255,.28),
                    0 0 18px rgba(34,211,238,.24),
                    0 0 3px rgba(255,255,255,.60) !important;
                backdrop-filter: blur(.2px);
            }
            #medinet-auto-unified .mau-core::before {
                content:'' !important;
                position:absolute !important;
                inset:7px !important;
                border-radius:50% !important;
                border:1px solid rgba(232,253,255,.30) !important;
                box-shadow: inset 0 0 10px rgba(232,253,255,.16) !important;
            }
            #medinet-auto-unified .mau-model {
                font-size: 20px !important;
                line-height: 18px !important;
                font-weight: 900 !important;
                letter-spacing: -.2px !important;
                color: #f8feff !important;
                text-shadow: 0 0 5px rgba(255,255,255,.72), 0 0 10px rgba(103,232,249,.35) !important;
            }
            #medinet-auto-unified .mau-auto {
                font-size: 6px !important;
                letter-spacing: 1.1px !important;
                font-weight: 800 !important;
                color: #cffafe !important;
                text-shadow: 0 0 6px rgba(34,211,238,.22) !important;
            }

            /* Always-on slow rotation */
            #medinet-auto-unified .mau-ring {
                animation: mau751-idle-outer 5.6s linear infinite !important;
                will-change: rotate;
            }
            #medinet-auto-unified .mau-ring2 {
                animation: mau751-idle-inner 8.2s linear infinite !important;
                will-change: rotate;
            }
            @keyframes mau751-idle-outer { from { rotate: 0deg; } to { rotate: 360deg; } }
            @keyframes mau751-idle-inner { from { rotate: 0deg; } to { rotate: -360deg; } }

            /* Running = much faster + stronger core + blue sparks */
            #medinet-auto-unified.mau-running .mau-ring {
                animation: mau751-run-outer .54s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation: mau751-run-inner .78s linear infinite !important;
            }
            @keyframes mau751-run-outer { from { rotate:0deg; } to { rotate:360deg; } }
            @keyframes mau751-run-inner { from { rotate:0deg; } to { rotate:-360deg; } }

            #medinet-auto-unified .mau-energy {
                inset: -8px !important;
                display: block !important;
                opacity: .12 !important;
                background: radial-gradient(circle, transparent 59%, rgba(255,255,255,.0) 60%), conic-gradient(
                    from 0deg,
                    transparent 0 282deg,
                    rgba(232,253,255,.95) 283deg 287deg,
                    rgba(167,243,255,.95) 288deg 297deg,
                    rgba(34,211,238,.88) 298deg 312deg,
                    transparent 313deg 360deg
                ) !important;
                filter: drop-shadow(0 0 4px rgba(34,211,238,.42)) drop-shadow(0 0 8px rgba(14,165,233,.25)) !important;
                animation: none !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity: 1 !important;
                animation: mau751-energy .42s linear infinite !important;
            }
            @keyframes mau751-energy { from { rotate:0deg; } to { rotate:360deg; } }

            #medinet-auto-unified .mau-sparks {
                display: block !important;
                position: absolute !important;
                inset: -8px !important;
                z-index: 30 !important;
                pointer-events: none !important;
                opacity: 0 !important;
                visibility: hidden !important;
            }
            #medinet-auto-unified .mau-sparks i {
                width: 5px !important;
                height: 5px !important;
                margin: -2.5px 0 0 -2.5px !important;
                border-radius: 999px !important;
                background: radial-gradient(circle, #ffffff 0 30%, #a5f3fc 31% 58%, #22d3ee 59% 100%) !important;
                box-shadow:
                    0 0 5px rgba(255,255,255,.95),
                    0 0 10px rgba(103,232,249,.95),
                    0 0 18px rgba(34,211,238,.85),
                    0 0 25px rgba(14,165,233,.60) !important;
                opacity: 0 !important;
            }
            #medinet-auto-unified .mau-sparks i:nth-child(1) { transform: rotate(10deg) translateY(-42px) scale(.95) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(2) { transform: rotate(76deg) translateY(-39px) scale(.72) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(3) { transform: rotate(148deg) translateY(-43px) scale(.86) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(4) { transform: rotate(224deg) translateY(-40px) scale(.62) !important; }
            #medinet-auto-unified .mau-sparks i:nth-child(5) { transform: rotate(310deg) translateY(-44px) scale(.78) !important; }
            #medinet-auto-unified.mau-running .mau-sparks {
                opacity: 1 !important;
                visibility: visible !important;
                animation: mau751-spark-orbit .64s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation: mau751-spark-burst .34s ease-in-out infinite alternate !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(2) { animation-delay: -.08s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(3) { animation-delay: -.17s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(4) { animation-delay: -.26s !important; }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(5) { animation-delay: -.13s !important; }
            @keyframes mau751-spark-orbit { from { rotate:0deg; } to { rotate:360deg; } }
            @keyframes mau751-spark-burst {
                0%   { opacity: .18; filter: brightness(.8); }
                45%  { opacity: 1; filter: brightness(2.1); }
                100% { opacity: .42; filter: brightness(1.1); }
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation: mau751-core-pulse .68s ease-in-out infinite alternate !important;
            }
            @keyframes mau751-core-pulse {
                from {
                    box-shadow:
                        inset 0 0 10px rgba(255,255,255,.22),
                        0 0 12px rgba(34,211,238,.20),
                        0 0 3px rgba(255,255,255,.48);
                }
                to {
                    box-shadow:
                        inset 0 0 16px rgba(255,255,255,.34),
                        0 0 22px rgba(34,211,238,.36),
                        0 0 6px rgba(255,255,255,.72);
                }
            }

            #medinet-auto-unified .mau-warning {
                top: -7px !important;
                right: -7px !important;
                width: 28px !important;
                height: 28px !important;
            }
            #medinet-auto-unified .mau-warning::before {
                width: 17px !important;
                height: 17px !important;
                font-size: 11px !important;
            }

            #medinet-auto-dock-panel {
                right: 96px !important;
                bottom: 92px !important;
                width: min(340px, calc(100vw - 122px)) !important;
            }
            #medinet-auto-dock-panel::after {
                right: 24px !important;
                bottom: -12px !important;
            }
            .mnm-toast,
            #medinet-auto-notice {
                right: 96px !important;
                bottom: 92px !important;
            }

            @media (max-width:640px) {
                #medinet-auto-unified {
                    width: 62px !important;
                    height: 62px !important;
                    right: 12px !important;
                    bottom: 12px !important;
                }
                #medinet-auto-unified .mau-core {
                    inset: 15px !important;
                }
                #medinet-auto-unified .mau-model {
                    font-size: 18px !important;
                }
                #medinet-auto-dock-panel,
                #medinet-auto-notice,
                .mnm-toast {
                    right: 78px !important;
                    bottom: 80px !important;
                    width: min(290px, calc(100vw - 92px)) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV752Styles() {
        if (document.getElementById('medinet-auto-v752-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v752-style';
        style.textContent = `
            /* =====================================================
               v7.52 — ARC CORE / HIGH SPEED PLASMA
               Stronger chest-reactor geometry + visible speed streaks.
               ===================================================== */
            #medinet-auto-unified {
                width: 72px !important;
                height: 72px !important;
                right: 14px !important;
                bottom: 14px !important;
                filter:
                    drop-shadow(0 7px 16px rgba(2,6,23,.34))
                    drop-shadow(0 0 9px rgba(34,211,238,.28)) !important;
            }

            /* Dark metallic housing */
            #medinet-auto-unified .mau-shell {
                inset: 0 !important;
                background:
                    radial-gradient(circle at 50% 50%, transparent 0 39%, rgba(6,18,31,.70) 40% 55%, rgba(1,7,14,.98) 72% 100%),
                    conic-gradient(from 4deg,#101827,#050b13 18deg,#1b2b3d 36deg,#060b12 54deg,#142234 72deg,#050b12 90deg,#1a2a3b 108deg,#050a11 126deg,#162536 144deg,#050a11 162deg,#142235 180deg,#050a11 198deg,#18293a 216deg,#050a11 234deg,#142537 252deg,#050a11 270deg,#18283a 288deg,#050a11 306deg,#142436 324deg,#050a11 342deg,#101827 360deg) !important;
                border:1px solid rgba(148,163,184,.24)!important;
                box-shadow:
                    inset 0 0 0 2px rgba(0,0,0,.55),
                    inset 0 0 14px rgba(56,189,248,.06),
                    0 0 0 1px rgba(255,255,255,.025),
                    0 0 15px rgba(34,211,238,.14)!important;
            }
            #medinet-auto-unified .mau-shell::before {
                inset: 7px !important;
                border: 1px solid rgba(186,230,253,.20)!important;
                background:
                    repeating-conic-gradient(from 0deg,
                        rgba(125,211,252,.18) 0 3deg,
                        transparent 3deg 33deg
                    ) !important;
                box-shadow: inset 0 0 10px rgba(56,189,248,.08)!important;
                opacity:1!important;
            }
            #medinet-auto-unified .mau-shell::after {
                inset: 12px !important;
                border-radius:50%!important;
                border:1px solid rgba(103,232,249,.15)!important;
                background: repeating-conic-gradient(from 18deg, rgba(255,255,255,.18) 0 2deg, transparent 2deg 36deg)!important;
                box-shadow:0 0 8px rgba(34,211,238,.10) inset!important;
                opacity:1!important;
            }

            /* Outer segmented turbine ring */
            #medinet-auto-unified .mau-ring {
                inset: 3px !important;
                background: repeating-conic-gradient(
                    from 0deg,
                    rgba(224,242,254,.95) 0 3deg,
                    rgba(56,189,248,.95) 3deg 11deg,
                    rgba(14,116,144,.65) 11deg 17deg,
                    transparent 17deg 30deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0)!important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0)!important;
                filter: drop-shadow(0 0 4px rgba(34,211,238,.38))!important;
            }

            /* Inner energy vanes: radial triangular look */
            #medinet-auto-unified .mau-ring2 {
                inset: 12px !important;
                background: conic-gradient(
                    from 0deg,
                    rgba(207,250,254,.0) 0 6deg, rgba(207,250,254,.95) 6deg 10deg, rgba(34,211,238,.78) 10deg 22deg, rgba(207,250,254,.0) 22deg 36deg,
                    rgba(207,250,254,.95) 36deg 40deg, rgba(34,211,238,.78) 40deg 52deg, rgba(207,250,254,.0) 52deg 72deg,
                    rgba(207,250,254,.95) 72deg 76deg, rgba(34,211,238,.78) 76deg 88deg, rgba(207,250,254,.0) 88deg 108deg,
                    rgba(207,250,254,.95) 108deg 112deg, rgba(34,211,238,.78) 112deg 124deg, rgba(207,250,254,.0) 124deg 144deg,
                    rgba(207,250,254,.95) 144deg 148deg, rgba(34,211,238,.78) 148deg 160deg, rgba(207,250,254,.0) 160deg 180deg,
                    rgba(207,250,254,.95) 180deg 184deg, rgba(34,211,238,.78) 184deg 196deg, rgba(207,250,254,.0) 196deg 216deg,
                    rgba(207,250,254,.95) 216deg 220deg, rgba(34,211,238,.78) 220deg 232deg, rgba(207,250,254,.0) 232deg 252deg,
                    rgba(207,250,254,.95) 252deg 256deg, rgba(34,211,238,.78) 256deg 268deg, rgba(207,250,254,.0) 268deg 288deg,
                    rgba(207,250,254,.95) 288deg 292deg, rgba(34,211,238,.78) 292deg 304deg, rgba(207,250,254,.0) 304deg 324deg,
                    rgba(207,250,254,.95) 324deg 328deg, rgba(34,211,238,.78) 328deg 340deg, rgba(207,250,254,.0) 340deg 360deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 0)!important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 8px), #000 0)!important;
                filter: drop-shadow(0 0 5px rgba(103,232,249,.46))!important;
            }

            /* Bright reactor core */
            #medinet-auto-unified .mau-core {
                inset: 18px !important;
                background:
                    radial-gradient(circle at 50% 50%, #ffffff 0 7%, #dffcff 8% 18%, #8cf4ff 19% 32%, #22d3ee 33% 43%, #0e7490 44% 58%, #082f49 59% 76%, #020812 77% 100%) !important;
                border:1px solid rgba(224,252,255,.60)!important;
                box-shadow:
                    inset 0 0 8px rgba(255,255,255,.92),
                    inset 0 0 18px rgba(103,232,249,.45),
                    0 0 10px rgba(207,250,254,.55),
                    0 0 24px rgba(34,211,238,.28)!important;
            }
            #medinet-auto-unified .mau-core::before {
                inset: 5px !important;
                border:1px solid rgba(255,255,255,.48)!important;
                box-shadow:0 0 10px rgba(207,250,254,.30) inset!important;
            }
            #medinet-auto-unified .mau-model {
                font-size: 20px !important;
                line-height: 18px !important;
                color:#ffffff!important;
                text-shadow:0 0 4px #fff,0 0 9px rgba(103,232,249,.75)!important;
            }
            #medinet-auto-unified .mau-auto {
                font-size:6px!important;
                color:#e6feff!important;
                letter-spacing:1.05px!important;
            }

            /* IDLE */
            #medinet-auto-unified .mau-ring { animation:mau752-idle-a 5.2s linear infinite!important; }
            #medinet-auto-unified .mau-ring2 { animation:mau752-idle-b 7.6s linear infinite!important; }
            @keyframes mau752-idle-a { from{rotate:0deg} to{rotate:360deg} }
            @keyframes mau752-idle-b { from{rotate:0deg} to{rotate:-360deg} }

            /* ACTIVE speed */
            #medinet-auto-unified.mau-running .mau-ring { animation:mau752-run-a .34s linear infinite!important; }
            #medinet-auto-unified.mau-running .mau-ring2 { animation:mau752-run-b .48s linear infinite!important; }
            @keyframes mau752-run-a { from{rotate:0deg} to{rotate:360deg} }
            @keyframes mau752-run-b { from{rotate:0deg} to{rotate:-360deg} }

            /* Motion streak halo while running */
            #medinet-auto-unified .mau-energy {
                display:block!important;
                inset:-10px!important;
                opacity:0!important;
                background:conic-gradient(
                    from 0deg,
                    transparent 0 245deg,
                    rgba(255,255,255,.0) 245deg 258deg,
                    rgba(255,255,255,.95) 259deg 263deg,
                    rgba(165,243,252,.95) 264deg 281deg,
                    rgba(34,211,238,.78) 282deg 309deg,
                    rgba(14,165,233,.22) 310deg 334deg,
                    transparent 335deg 360deg
                )!important;
                filter:blur(.15px) drop-shadow(0 0 4px rgba(103,232,249,.78)) drop-shadow(0 0 10px rgba(34,211,238,.40))!important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1!important;
                animation:mau752-speed-halo .24s linear infinite!important;
            }
            @keyframes mau752-speed-halo { from{rotate:0deg} to{rotate:360deg} }

            /* Visible plasma streak sparks, not dots */
            #medinet-auto-unified .mau-sparks {
                display:block!important;
                position:absolute!important;
                inset:-14px!important;
                pointer-events:none!important;
                opacity:0!important;
                visibility:hidden!important;
                z-index:40!important;
            }
            #medinet-auto-unified .mau-sparks i {
                display:block!important;
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                width:15px!important;
                height:3px!important;
                margin:-1.5px 0 0 -7.5px!important;
                border-radius:999px!important;
                background:linear-gradient(90deg,rgba(255,255,255,0),#dffcff 45%,#67e8f9 70%,rgba(34,211,238,0))!important;
                box-shadow:0 0 4px #fff,0 0 8px #67e8f9,0 0 13px rgba(34,211,238,.78)!important;
                transform-origin:7.5px 1.5px!important;
                opacity:0!important;
                filter:blur(.1px)!important;
            }
            #medinet-auto-unified .mau-sparks i:nth-child(1){transform:rotate(18deg) translateY(-45px) rotate(78deg)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(2){transform:rotate(86deg) translateY(-41px) rotate(78deg) scale(.82)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(3){transform:rotate(157deg) translateY(-46px) rotate(78deg) scale(.9)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(4){transform:rotate(236deg) translateY(-42px) rotate(78deg) scale(.72)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(5){transform:rotate(314deg) translateY(-47px) rotate(78deg) scale(.84)!important;}
            #medinet-auto-unified.mau-running .mau-sparks {
                opacity:1!important;
                visibility:visible!important;
                animation:mau752-spark-orbit .46s linear infinite!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation:mau752-streak-pulse .22s ease-in-out infinite alternate!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(2){animation-delay:-.05s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(3){animation-delay:-.11s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(4){animation-delay:-.16s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(5){animation-delay:-.09s!important;}
            @keyframes mau752-spark-orbit{from{rotate:0deg}to{rotate:360deg}}
            @keyframes mau752-streak-pulse{
                0%{opacity:.18;scale:.65 1;}
                45%{opacity:1;scale:1.35 1;}
                100%{opacity:.38;scale:.9 1;}
            }

            #medinet-auto-unified.mau-running {
                filter:
                    drop-shadow(0 7px 16px rgba(2,6,23,.36))
                    drop-shadow(0 0 12px rgba(34,211,238,.80))
                    drop-shadow(0 0 22px rgba(14,165,233,.30))!important;
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation:mau752-core-pulse .42s ease-in-out infinite alternate!important;
            }
            @keyframes mau752-core-pulse {
                from{filter:brightness(1);}
                to{filter:brightness(1.32);}
            }

            #medinet-auto-unified .mau-warning { top:-6px!important;right:-6px!important; }

            #medinet-auto-dock-panel, #medinet-auto-notice, .mnm-toast {
                right:100px!important;
                bottom:94px!important;
            }
            @media(max-width:640px){
                #medinet-auto-unified{width:64px!important;height:64px!important;right:10px!important;bottom:10px!important;}
                #medinet-auto-unified .mau-core{inset:16px!important;}
                #medinet-auto-unified .mau-model{font-size:18px!important;}
                #medinet-auto-dock-panel,#medinet-auto-notice,.mnm-toast{right:78px!important;bottom:80px!important;}
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV753Styles() {
        if (document.getElementById('medinet-auto-v753-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v753-style';
        style.textContent = `
            /* =====================================================
               v7.53 — ARC REACTOR BOOST
               Dark readable core + bright energy annulus + visible plasma bolts.
               ===================================================== */
            #medinet-auto-unified {
                width:76px!important;
                height:76px!important;
                right:10px!important;
                bottom:8px!important;
                overflow:visible!important;
                filter:drop-shadow(0 8px 18px rgba(2,6,23,.38)) drop-shadow(0 0 10px rgba(34,211,238,.26))!important;
            }

            /* Housing: deeper gunmetal, thinner cyan accents. */
            #medinet-auto-unified .mau-shell {
                inset:0!important;
                background:
                    radial-gradient(circle at 50% 50%, transparent 0 46%, rgba(5,16,28,.82) 47% 62%, rgba(1,7,14,.99) 75% 100%),
                    repeating-conic-gradient(from 3deg,#182638 0 8deg,#060b12 8deg 18deg,#21374b 18deg 24deg,#050a11 24deg 36deg)!important;
                border:1px solid rgba(148,163,184,.24)!important;
                box-shadow:inset 0 0 0 2px rgba(0,0,0,.60), inset 0 0 18px rgba(56,189,248,.07), 0 0 0 1px rgba(255,255,255,.025), 0 0 17px rgba(34,211,238,.14)!important;
            }
            #medinet-auto-unified .mau-shell::before {
                inset:7px!important;
                background:repeating-conic-gradient(from 0deg,rgba(186,230,253,.24) 0 2deg,transparent 2deg 28deg)!important;
                border:1px solid rgba(125,211,252,.18)!important;
                box-shadow:inset 0 0 12px rgba(34,211,238,.08)!important;
                opacity:1!important;
            }
            #medinet-auto-unified .mau-shell::after {
                inset:12px!important;
                border:1px solid rgba(103,232,249,.16)!important;
                background:repeating-conic-gradient(from 14deg,rgba(224,252,255,.20) 0 2deg,transparent 2deg 24deg)!important;
                opacity:1!important;
            }

            /* Outer mechanical reactor ring. */
            #medinet-auto-unified .mau-ring {
                inset:3px!important;
                background:repeating-conic-gradient(from -3deg,
                    rgba(236,254,255,.98) 0 2deg,
                    rgba(103,232,249,.98) 2deg 7deg,
                    rgba(8,145,178,.72) 7deg 12deg,
                    transparent 12deg 24deg)!important;
                -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)!important;
                mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0)!important;
                filter:drop-shadow(0 0 4px rgba(34,211,238,.42))!important;
            }

            /* Inner ten-vane energy chamber. */
            #medinet-auto-unified .mau-ring2 {
                inset:12px!important;
                background:repeating-conic-gradient(from 0deg,
                    transparent 0 8deg,
                    rgba(238,254,255,.98) 8deg 11deg,
                    rgba(103,232,249,.95) 11deg 17deg,
                    rgba(14,165,233,.70) 17deg 25deg,
                    transparent 25deg 36deg)!important;
                -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 9px),#000 0)!important;
                mask:radial-gradient(farthest-side,transparent calc(100% - 9px),#000 0)!important;
                filter:drop-shadow(0 0 5px rgba(103,232,249,.48))!important;
            }

            /* Readable center: dark center + bright annulus, instead of all-white glare. */
            #medinet-auto-unified .mau-core {
                inset:18px!important;
                background:
                    radial-gradient(circle at 50% 52%,
                        #03111d 0 34%,
                        #082f49 35% 45%,
                        #22d3ee 46% 52%,
                        #a5f3fc 53% 58%,
                        #e8feff 59% 63%,
                        #0e7490 64% 72%,
                        #03101d 73% 100%)!important;
                border:1px solid rgba(224,252,255,.58)!important;
                box-shadow:inset 0 0 10px rgba(255,255,255,.22), inset 0 0 18px rgba(34,211,238,.30), 0 0 10px rgba(207,250,254,.50), 0 0 24px rgba(34,211,238,.26)!important;
                z-index:50!important;
            }
            #medinet-auto-unified .mau-core::before {
                inset:4px!important;
                border:1px solid rgba(255,255,255,.34)!important;
                background:radial-gradient(circle,rgba(0,0,0,.18) 0 48%,transparent 49%)!important;
                box-shadow:0 0 9px rgba(103,232,249,.24) inset!important;
            }
            #medinet-auto-unified .mau-model {
                position:relative!important;
                z-index:70!important;
                font-size:22px!important;
                line-height:20px!important;
                font-weight:950!important;
                letter-spacing:-.5px!important;
                color:#ffffff!important;
                -webkit-text-stroke:.35px rgba(2,18,30,.95)!important;
                text-shadow:0 1px 1px rgba(0,0,0,.92),0 0 4px rgba(255,255,255,.78),0 0 8px rgba(103,232,249,.48)!important;
                opacity:1!important;
            }
            #medinet-auto-unified .mau-auto {
                position:relative!important;
                z-index:70!important;
                margin-top:1px!important;
                font-size:7px!important;
                line-height:7px!important;
                font-weight:900!important;
                letter-spacing:1.25px!important;
                color:#d9fbff!important;
                -webkit-text-stroke:.2px rgba(2,18,30,.9)!important;
                text-shadow:0 1px 1px rgba(0,0,0,.9),0 0 5px rgba(34,211,238,.55)!important;
                opacity:1!important;
            }

            /* Idle: elegant slow motion. */
            #medinet-auto-unified .mau-ring { animation:mau753-idle-a 5.6s linear infinite!important; }
            #medinet-auto-unified .mau-ring2 { animation:mau753-idle-b 8.4s linear infinite!important; }
            @keyframes mau753-idle-a{from{rotate:0deg}to{rotate:360deg}}
            @keyframes mau753-idle-b{from{rotate:0deg}to{rotate:-360deg}}

            /* Boost: unmistakably fast. */
            #medinet-auto-unified.mau-running .mau-ring { animation:mau753-run-a .28s linear infinite!important; }
            #medinet-auto-unified.mau-running .mau-ring2 { animation:mau753-run-b .39s linear infinite!important; }
            @keyframes mau753-run-a{from{rotate:0deg}to{rotate:360deg}}
            @keyframes mau753-run-b{from{rotate:0deg}to{rotate:-360deg}}

            /* Speed halo: multiple luminous arcs rather than one small arc. */
            #medinet-auto-unified .mau-energy {
                display:block!important;
                inset:-12px!important;
                opacity:0!important;
                background:conic-gradient(from 0deg,
                    transparent 0 38deg,
                    rgba(255,255,255,.0) 38deg 43deg,
                    rgba(222,252,255,.96) 43deg 47deg,
                    rgba(34,211,238,.82) 47deg 66deg,
                    transparent 66deg 142deg,
                    rgba(255,255,255,.0) 142deg 147deg,
                    rgba(222,252,255,.92) 147deg 151deg,
                    rgba(14,165,233,.72) 151deg 171deg,
                    transparent 171deg 253deg,
                    rgba(222,252,255,.95) 253deg 257deg,
                    rgba(34,211,238,.78) 257deg 278deg,
                    transparent 278deg 360deg)!important;
                -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0)!important;
                mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0)!important;
                filter:drop-shadow(0 0 5px rgba(103,232,249,.90)) drop-shadow(0 0 12px rgba(34,211,238,.55))!important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1!important;
                animation:mau753-speed .18s linear infinite!important;
            }
            @keyframes mau753-speed{from{rotate:0deg}to{rotate:360deg}}

            /* Real visible plasma bolts: bright head + long fading tail. */
            #medinet-auto-unified .mau-sparks {
                display:block!important;
                position:absolute!important;
                inset:-20px!important;
                z-index:90!important;
                pointer-events:none!important;
                overflow:visible!important;
                opacity:0!important;
                visibility:hidden!important;
            }
            #medinet-auto-unified .mau-sparks i {
                display:block!important;
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                width:25px!important;
                height:4px!important;
                margin:-2px 0 0 -2px!important;
                border-radius:999px!important;
                background:linear-gradient(90deg,#ffffff 0 8%,#bffcff 9% 21%,#67e8f9 22% 46%,rgba(34,211,238,.55) 47% 68%,rgba(14,165,233,0) 100%)!important;
                box-shadow:0 0 4px #fff,0 0 9px #67e8f9,0 0 16px rgba(34,211,238,.88),0 0 24px rgba(14,165,233,.58)!important;
                transform-origin:2px 2px!important;
                opacity:0!important;
                filter:none!important;
            }
            #medinet-auto-unified .mau-sparks i::before {
                content:''!important;
                position:absolute!important;
                left:-2px!important;
                top:-2px!important;
                width:8px!important;
                height:8px!important;
                border-radius:50%!important;
                background:#ffffff!important;
                box-shadow:0 0 5px #fff,0 0 11px #a5f3fc,0 0 18px #22d3ee!important;
            }
            #medinet-auto-unified .mau-sparks i::after {
                content:''!important;
                position:absolute!important;
                left:7px!important;
                top:1px!important;
                width:31px!important;
                height:2px!important;
                border-radius:999px!important;
                background:linear-gradient(90deg,rgba(103,232,249,.68),rgba(34,211,238,.26),transparent)!important;
                filter:blur(.35px)!important;
            }
            #medinet-auto-unified .mau-sparks i:nth-child(1){transform:rotate(10deg) translateY(-48px) rotate(82deg)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(2){transform:rotate(79deg) translateY(-44px) rotate(82deg) scale(.78)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(3){transform:rotate(151deg) translateY(-49px) rotate(82deg) scale(.92)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(4){transform:rotate(231deg) translateY(-45px) rotate(82deg) scale(.70)!important;}
            #medinet-auto-unified .mau-sparks i:nth-child(5){transform:rotate(309deg) translateY(-50px) rotate(82deg) scale(.84)!important;}

            /* Two extra bolts so burst never looks empty. */
            #medinet-auto-unified .mau-sparks::before,
            #medinet-auto-unified .mau-sparks::after {
                content:''!important;
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                width:30px!important;
                height:3px!important;
                border-radius:999px!important;
                background:linear-gradient(90deg,#fff,#a5f3fc 22%,#22d3ee 48%,rgba(14,165,233,0) 100%)!important;
                box-shadow:0 0 5px #fff,0 0 10px #67e8f9,0 0 18px rgba(34,211,238,.8)!important;
                opacity:0!important;
                transform-origin:0 50%!important;
            }
            #medinet-auto-unified .mau-sparks::before { transform:rotate(42deg) translateX(45px)!important; }
            #medinet-auto-unified .mau-sparks::after { transform:rotate(205deg) translateX(46px)!important; }

            #medinet-auto-unified.mau-running .mau-sparks {
                opacity:1!important;
                visibility:visible!important;
                animation:mau753-orbit .34s linear infinite!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation:mau753-bolt .19s ease-in-out infinite alternate!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks::before,
            #medinet-auto-unified.mau-running .mau-sparks::after {
                animation:mau753-extra-bolt .23s ease-in-out infinite alternate!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(2){animation-delay:-.04s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(3){animation-delay:-.09s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(4){animation-delay:-.14s!important;}
            #medinet-auto-unified.mau-running .mau-sparks i:nth-child(5){animation-delay:-.07s!important;}
            @keyframes mau753-orbit{from{rotate:0deg}to{rotate:360deg}}
            @keyframes mau753-bolt{
                0%{opacity:.08;scale:.55 1;}
                40%{opacity:1;scale:1.35 1;}
                100%{opacity:.30;scale:.85 1;}
            }
            @keyframes mau753-extra-bolt{
                0%{opacity:0;scale:.55 1;}
                50%{opacity:1;scale:1.25 1;}
                100%{opacity:.18;scale:.8 1;}
            }

            #medinet-auto-unified.mau-running {
                filter:drop-shadow(0 8px 18px rgba(2,6,23,.40)) drop-shadow(0 0 14px rgba(34,211,238,.88)) drop-shadow(0 0 28px rgba(14,165,233,.34))!important;
            }
            #medinet-auto-unified.mau-running .mau-core {
                animation:mau753-core .28s ease-in-out infinite alternate!important;
            }
            @keyframes mau753-core{
                from{filter:brightness(1) saturate(1);}
                to{filter:brightness(1.24) saturate(1.18);}
            }

            #medinet-auto-unified .mau-warning{top:-5px!important;right:-5px!important;z-index:120!important;}

            #medinet-auto-dock-panel,#medinet-auto-notice,.mnm-toast{
                right:104px!important;
                bottom:92px!important;
            }
            @media(max-width:640px){
                #medinet-auto-unified{width:68px!important;height:68px!important;right:8px!important;bottom:7px!important;}
                #medinet-auto-unified .mau-core{inset:17px!important;}
                #medinet-auto-unified .mau-model{font-size:20px!important;}
                #medinet-auto-unified .mau-auto{font-size:6.5px!important;}
                #medinet-auto-dock-panel,#medinet-auto-notice,.mnm-toast{right:82px!important;bottom:80px!important;}
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV754Styles() {
        if (document.getElementById('medinet-auto-v754-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v754-style';
        style.textContent = `
            /* =====================================================
               v7.54 — UNIFIED ARC-REACTOR UI + RANDOM PLASMA
               ===================================================== */

            /* ---------- SEARCH / CONFIRM MODALS ---------- */
            .mnm-overlay {
                background: rgba(2,8,18,.62) !important;
                backdrop-filter: blur(5px) saturate(1.05) !important;
            }
            .mnm-box {
                width: min(500px,92vw) !important;
                background: linear-gradient(165deg,rgba(6,18,34,.985),rgba(3,10,22,.985)) !important;
                color:#eafaff !important;
                border:1px solid rgba(103,232,249,.26) !important;
                border-radius:20px !important;
                box-shadow:
                    0 26px 70px rgba(2,6,23,.52),
                    0 0 0 1px rgba(255,255,255,.025) inset,
                    0 0 30px rgba(34,211,238,.10) !important;
                overflow:hidden !important;
            }
            .mnm-header {
                padding:16px 18px !important;
                color:#f4fdff !important;
                background:linear-gradient(90deg,rgba(8,47,73,.72),rgba(4,12,24,.28)) !important;
                border-bottom:1px solid rgba(125,211,252,.14) !important;
                font-size:15px !important;
                font-weight:850 !important;
                letter-spacing:.1px !important;
                text-shadow:0 0 8px rgba(103,232,249,.16) !important;
            }
            .mnm-header.mnm-warn { color:#fde68a !important; }
            .mnm-header.mnm-ok { color:#bbf7d0 !important; }
            .mnm-tabs {
                padding:0 18px !important;
                background:rgba(3,10,22,.92) !important;
                border-bottom:1px solid rgba(125,211,252,.10) !important;
            }
            .mnm-tab {
                padding:12px 14px !important;
                color:#89a6bc !important;
                font-weight:750 !important;
                border-bottom:2px solid transparent !important;
            }
            .mnm-tab.mnm-tab-active {
                color:#d9fbff !important;
                border-bottom-color:#22d3ee !important;
                text-shadow:0 0 9px rgba(34,211,238,.24) !important;
            }
            .mnm-body {
                padding:18px !important;
                color:#cfe4f2 !important;
                background:linear-gradient(180deg,rgba(5,15,28,.96),rgba(3,10,20,.97)) !important;
            }
            .mnm-input-label {
                color:#ccebf6 !important;
                font-size:12.5px !important;
                font-weight:750 !important;
                margin-bottom:7px !important;
            }
            .mnm-input,
            .mnm-select {
                color:#f5fdff !important;
                background:linear-gradient(180deg,rgba(10,26,44,.96),rgba(7,18,32,.96)) !important;
                border:1px solid rgba(125,211,252,.20) !important;
                border-radius:11px !important;
                box-shadow:inset 0 0 0 1px rgba(255,255,255,.018) !important;
                caret-color:#67e8f9 !important;
            }
            .mnm-input::placeholder { color:#6f899d !important; }
            .mnm-input:focus,
            .mnm-select:focus {
                border-color:#22d3ee !important;
                box-shadow:0 0 0 3px rgba(34,211,238,.10),0 0 14px rgba(34,211,238,.10) !important;
            }
            .mnm-select option { background:#081421 !important; color:#eefcff !important; }
            .mnm-footer {
                padding:12px 18px 15px !important;
                border-top:1px solid rgba(125,211,252,.10) !important;
                background:rgba(3,10,22,.96) !important;
            }
            .mnm-btn {
                min-width:86px !important;
                padding:9px 16px !important;
                border-radius:10px !important;
                border:1px solid rgba(148,163,184,.14) !important;
                font-weight:800 !important;
            }
            .mnm-btn-primary {
                color:#effeff !important;
                background:linear-gradient(135deg,#0891b2,#2563eb) !important;
                box-shadow:0 7px 18px rgba(37,99,235,.18),0 0 10px rgba(34,211,238,.10) !important;
            }
            .mnm-btn-secondary {
                color:#d3e5f1 !important;
                background:rgba(19,32,50,.92) !important;
            }
            .mnm-patient-card,
            .mnm-pick-item {
                background:rgba(10,24,40,.78) !important;
                border-color:rgba(125,211,252,.15) !important;
                color:#d7edf7 !important;
            }
            .mnm-patient-card b,
            .mnm-pick-item b { color:#ffffff !important; }
            .mnm-pick-item:hover {
                background:rgba(8,47,73,.58) !important;
                border-color:rgba(34,211,238,.55) !important;
            }
            .mnm-pick-item .mnm-pick-sub { color:#9eb4c5 !important; }

            /* ---------- AUTO SPEECH / STATUS PANEL ---------- */
            #medinet-auto-dock-panel {
                background:linear-gradient(160deg,rgba(5,16,30,.985),rgba(2,9,20,.985)) !important;
                color:#eafaff !important;
                border:1px solid rgba(103,232,249,.28) !important;
                border-radius:18px !important;
                box-shadow:0 18px 44px rgba(2,6,23,.46),0 0 22px rgba(34,211,238,.08) !important;
            }
            #medinet-auto-dock-panel .madp-tail,
            #medinet-auto-dock-panel .madp-tail::after {
                border-top-color:#071522 !important;
            }
            #medinet-auto-dock-panel .madp-head {
                background:linear-gradient(90deg,rgba(8,47,73,.70),rgba(5,16,30,.25)) !important;
                border-bottom:1px solid rgba(125,211,252,.12) !important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#f1fdff !important;
                font-size:14px !important;
                font-weight:850 !important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                color:#cfe7f3 !important;
            }
            #medinet-auto-dock-panel .madp-running-note {
                display:block !important;
                color:#dffcff !important;
                background:rgba(8,47,73,.42) !important;
                border:1px dashed rgba(34,211,238,.28) !important;
            }
            #medinet-auto-dock-panel.madp-warn {
                background:linear-gradient(160deg,rgba(35,24,8,.985),rgba(18,12,4,.985)) !important;
                border-color:rgba(245,158,11,.34) !important;
            }
            #medinet-auto-dock-panel.madp-error {
                background:linear-gradient(160deg,rgba(39,13,18,.985),rgba(21,7,11,.985)) !important;
                border-color:rgba(248,113,113,.34) !important;
            }

            /* ---------- RANDOM PLASMA: no orbiting lightning ---------- */
            #medinet-auto-unified .mau-sparks,
            #medinet-auto-unified.mau-running .mau-sparks {
                animation:none !important;
                rotate:0deg !important;
            }
            #medinet-auto-unified .mau-sparks::before,
            #medinet-auto-unified .mau-sparks::after {
                display:none !important;
            }
            #medinet-auto-unified .mau-sparks i,
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation:none !important;
                transition:opacity .055s linear,filter .055s linear !important;
            }
            #medinet-auto-unified.mau-running .mau-sparks {
                opacity:1 !important;
                visibility:visible !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV755Styles() {
        if (document.getElementById('medinet-auto-v755-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v755-style';
        style.textContent = `
            /* =====================================================
               v7.55 — ACCESSIBLE REACTOR UI + TRUE LIGHTNING
               Reactor stays cinematic; forms stay high-contrast/readable.
               ===================================================== */

            /* ---------- HIGH-CONTRAST FORMS FOR OLDER USERS ---------- */
            .mnm-overlay {
                background:rgba(15,23,42,.48)!important;
                backdrop-filter:blur(3px)!important;
            }
            .mnm-box {
                width:min(520px,94vw)!important;
                background:#ffffff!important;
                color:#172033!important;
                border:2px solid rgba(14,116,144,.28)!important;
                border-radius:18px!important;
                box-shadow:0 24px 65px rgba(15,23,42,.30),0 0 24px rgba(34,211,238,.08)!important;
            }
            .mnm-header {
                padding:17px 19px!important;
                background:linear-gradient(135deg,#073b59,#0b5f7d 62%,#0e7490)!important;
                color:#ffffff!important;
                border-bottom:0!important;
                font-size:16px!important;
                line-height:1.35!important;
                font-weight:800!important;
                text-shadow:none!important;
            }
            .mnm-header.mnm-warn { color:#fff7d6!important; }
            .mnm-header.mnm-ok { color:#e9fff1!important; }
            .mnm-tabs {
                padding:0 18px!important;
                background:#f7fbfd!important;
                border-bottom:1px solid #d7e5ec!important;
            }
            .mnm-tab {
                padding:13px 14px!important;
                color:#5c6f7f!important;
                font-size:13.5px!important;
                font-weight:700!important;
            }
            .mnm-tab.mnm-tab-active {
                color:#075985!important;
                border-bottom-color:#0891b2!important;
                text-shadow:none!important;
            }
            .mnm-body {
                padding:20px!important;
                background:#ffffff!important;
                color:#1f2937!important;
                font-size:14px!important;
                line-height:1.55!important;
            }
            .mnm-input-label {
                display:block!important;
                color:#263746!important;
                font-size:14px!important;
                line-height:1.35!important;
                font-weight:750!important;
                margin:0 0 7px!important;
            }
            .mnm-input,
            .mnm-select {
                min-height:48px!important;
                padding:11px 13px!important;
                font-size:16px!important;
                line-height:1.3!important;
                color:#111827!important;
                background:#ffffff!important;
                border:2px solid #bfd1dc!important;
                border-radius:11px!important;
                box-shadow:none!important;
                caret-color:#0369a1!important;
            }
            .mnm-input::placeholder { color:#788995!important; opacity:1!important; }
            .mnm-input:focus,
            .mnm-select:focus {
                outline:none!important;
                border-color:#0891b2!important;
                box-shadow:0 0 0 4px rgba(8,145,178,.13)!important;
            }
            .mnm-select option { background:#fff!important; color:#111827!important; }
            .mnm-footer {
                padding:13px 18px 16px!important;
                background:#f7fbfd!important;
                border-top:1px solid #d7e5ec!important;
                gap:10px!important;
            }
            .mnm-btn {
                min-width:96px!important;
                min-height:42px!important;
                padding:10px 17px!important;
                border-radius:10px!important;
                font-size:14px!important;
                font-weight:800!important;
            }
            .mnm-btn-primary {
                color:#fff!important;
                background:linear-gradient(135deg,#0787a5,#2563eb)!important;
                border:1px solid rgba(7,89,133,.35)!important;
                box-shadow:0 5px 14px rgba(37,99,235,.18)!important;
            }
            .mnm-btn-secondary {
                color:#263746!important;
                background:#eef3f6!important;
                border:1px solid #c9d7df!important;
            }
            .mnm-patient-card,
            .mnm-pick-item {
                background:#f8fbfd!important;
                border:1px solid #d7e5ec!important;
                color:#243746!important;
            }
            .mnm-patient-card b,
            .mnm-pick-item b { color:#111827!important; }
            .mnm-pick-item:hover {
                background:#eaf8fc!important;
                border-color:#38bdf8!important;
            }
            .mnm-pick-item .mnm-pick-sub { color:#5f7180!important; }

            /* ---------- STATUS SPEECH: SAME STYLE, EASY TO READ ---------- */
            #medinet-auto-dock-panel {
                background:#ffffff!important;
                color:#172033!important;
                border:2px solid #12364a!important;
                box-shadow:0 16px 38px rgba(15,23,42,.25),0 0 16px rgba(34,211,238,.07)!important;
            }
            #medinet-auto-dock-panel .madp-head {
                background:linear-gradient(135deg,#eaf9fd,#f8fdff)!important;
                border-bottom:1px solid #d5e8ef!important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#172033!important;
                font-size:14.5px!important;
                font-weight:850!important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                color:#263746!important;
                font-size:13.5px!important;
                line-height:1.55!important;
            }
            #medinet-auto-dock-panel .madp-running-note {
                color:#0c4a6e!important;
                background:#e8f8fc!important;
                border:1px dashed #7dd3fc!important;
                font-weight:750!important;
            }
            #medinet-auto-dock-panel.madp-warn {
                background:#fffaf0!important;
                border-color:#b45309!important;
            }
            #medinet-auto-dock-panel.madp-error {
                background:#fff5f5!important;
                border-color:#b91c1c!important;
            }
            #medinet-auto-dock-panel .madp-tail,
            #medinet-auto-dock-panel .madp-tail::after {
                border-top-color:#ffffff!important;
            }

            /* ---------- LIGHTNING, NOT LASER ---------- */
            #medinet-auto-unified .mau-sparks,
            #medinet-auto-unified.mau-running .mau-sparks {
                animation:none!important;
                rotate:0deg!important;
                overflow:visible!important;
            }
            #medinet-auto-unified .mau-sparks i {
                position:absolute!important;
                left:50%!important;
                top:50%!important;
                width:34px!important;
                height:12px!important;
                margin:-6px 0 0 0!important;
                border-radius:0!important;
                background:linear-gradient(90deg,#ffffff 0 10%,#bffcff 11% 34%,#22d3ee 35% 72%,rgba(34,211,238,0) 100%)!important;
                clip-path:polygon(0 42%,18% 27%,29% 54%,45% 15%,57% 48%,74% 23%,100% 47%,76% 38%,61% 68%,48% 37%,32% 78%,20% 51%,0 62%)!important;
                box-shadow:none!important;
                filter:drop-shadow(0 0 2px #fff) drop-shadow(0 0 5px #67e8f9) drop-shadow(0 0 9px rgba(34,211,238,.9))!important;
                transform-origin:0 50%!important;
                opacity:0!important;
                pointer-events:none!important;
            }
            #medinet-auto-unified .mau-sparks i::before {
                content:''!important;
                position:absolute!important;
                left:48%!important;
                top:55%!important;
                width:17px!important;
                height:7px!important;
                background:linear-gradient(90deg,#dffcff,#22d3ee 55%,rgba(34,211,238,0))!important;
                clip-path:polygon(0 40%,28% 22%,42% 58%,63% 20%,100% 48%,65% 42%,45% 78%,28% 51%,0 65%)!important;
                transform:rotate(31deg)!important;
                transform-origin:0 50%!important;
                opacity:.68!important;
                filter:drop-shadow(0 0 3px #67e8f9)!important;
            }
            #medinet-auto-unified .mau-sparks i::after { display:none!important; }
            #medinet-auto-unified .mau-sparks::before,
            #medinet-auto-unified .mau-sparks::after { display:none!important; }
            #medinet-auto-unified.mau-running .mau-sparks {
                opacity:1!important;
                visibility:visible!important;
            }
            #medinet-auto-unified.mau-running .mau-sparks i {
                animation:none!important;
            }
        `;
        document.head.appendChild(style);
    }


    function ensureUnifiedAutoV756Styles() {
        if (document.getElementById('medinet-auto-v756-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v756-style';
        style.textContent = `
            /* =====================================================
               v7.56 — CLINICAL ARC REACTOR
               One visual language: clinical clarity + reactor accent.
               ===================================================== */

            /* ---------- REACTOR: SIMPLER, STRONGER, MORE LEGIBLE ---------- */
            #medinet-auto-unified {
                width: 74px !important;
                height: 74px !important;
                right: 16px !important;
                bottom: 12px !important;
                border-radius: 50% !important;
                overflow: visible !important;
                filter:
                    drop-shadow(0 7px 14px rgba(2,6,23,.32))
                    drop-shadow(0 0 7px rgba(34,211,238,.24)) !important;
            }
            #medinet-auto-unified .mau-shell {
                inset: 1px !important;
                background:
                    radial-gradient(circle at 50% 50%, rgba(6,20,34,.98) 0 46%, rgba(4,14,25,.99) 47% 62%, #01050c 63% 100%) !important;
                border: 1px solid rgba(186,230,253,.22) !important;
                box-shadow:
                    inset 0 0 0 2px rgba(255,255,255,.035),
                    inset 0 0 18px rgba(34,211,238,.09),
                    0 0 0 2px rgba(2,6,23,.88),
                    0 0 16px rgba(34,211,238,.15) !important;
            }
            #medinet-auto-unified .mau-shell::before {
                inset: 8px !important;
                border: 2px solid rgba(125,211,252,.20) !important;
                box-shadow: inset 0 0 12px rgba(56,189,248,.10), 0 0 8px rgba(34,211,238,.10) !important;
                opacity: 1 !important;
            }
            #medinet-auto-unified .mau-shell::after {
                content:'' !important;
                position:absolute !important;
                inset:13px !important;
                border-radius:50% !important;
                border:1px solid rgba(224,242,254,.14) !important;
                box-shadow: inset 0 0 9px rgba(125,211,252,.08) !important;
                opacity:1 !important;
            }

            /* 8 bright reactor sectors; simpler than previous clock-like detail. */
            #medinet-auto-unified .mau-ring {
                inset: 4px !important;
                background: repeating-conic-gradient(
                    from 0deg,
                    rgba(236,254,255,.98) 0deg 3deg,
                    rgba(34,211,238,.92) 3deg 14deg,
                    rgba(8,47,73,.18) 14deg 33deg,
                    rgba(2,6,23,0) 33deg 45deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 5px), #000 0) !important;
                filter: drop-shadow(0 0 4px rgba(34,211,238,.38)) !important;
                animation: mau756-idle-outer 6s linear infinite !important;
            }
            #medinet-auto-unified .mau-ring2 {
                inset: 12px !important;
                background: repeating-conic-gradient(
                    from 22.5deg,
                    rgba(186,230,253,.92) 0deg 2deg,
                    rgba(56,189,248,.60) 2deg 9deg,
                    rgba(2,6,23,0) 9deg 30deg,
                    rgba(99,102,241,.32) 30deg 34deg,
                    rgba(2,6,23,0) 34deg 45deg
                ) !important;
                -webkit-mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0) !important;
                mask: radial-gradient(farthest-side, transparent calc(100% - 3px), #000 0) !important;
                filter: drop-shadow(0 0 3px rgba(125,211,252,.30)) !important;
                animation: mau756-idle-inner 9s linear infinite !important;
            }
            @keyframes mau756-idle-outer { from { rotate:0deg; } to { rotate:360deg; } }
            @keyframes mau756-idle-inner { from { rotate:0deg; } to { rotate:-360deg; } }

            /* Dark readable core, bright energy ring around it. */
            #medinet-auto-unified .mau-core {
                inset: 18px !important;
                z-index: 50 !important;
                background:
                    radial-gradient(circle at 50% 33%, rgba(16,67,88,.96) 0 18%, rgba(5,31,47,.98) 43%, rgba(2,14,25,.995) 72%, #020812 100%) !important;
                border: 2px solid rgba(186,230,253,.62) !important;
                box-shadow:
                    inset 0 0 10px rgba(125,211,252,.16),
                    0 0 0 3px rgba(34,211,238,.10),
                    0 0 14px rgba(34,211,238,.34) !important;
                overflow: visible !important;
            }
            #medinet-auto-unified .mau-core::before {
                content:'' !important;
                position:absolute !important;
                inset:-6px !important;
                border-radius:50% !important;
                border:2px solid rgba(207,250,254,.40) !important;
                box-shadow: 0 0 9px rgba(103,232,249,.28), inset 0 0 7px rgba(103,232,249,.10) !important;
                opacity:1 !important;
            }
            #medinet-auto-unified .mau-model {
                position:relative !important;
                z-index:55 !important;
                font-size:22px !important;
                line-height:20px !important;
                font-weight:950 !important;
                letter-spacing:-.4px !important;
                color:#ffffff !important;
                -webkit-text-stroke:.35px rgba(4,47,70,.90) !important;
                text-shadow:0 1px 0 rgba(2,6,23,.85),0 0 4px rgba(255,255,255,.45),0 0 8px rgba(34,211,238,.30) !important;
            }
            #medinet-auto-unified .mau-auto {
                position:relative !important;
                z-index:55 !important;
                margin-top:2px !important;
                font-size:7px !important;
                line-height:7px !important;
                letter-spacing:1.25px !important;
                font-weight:900 !important;
                color:#bff7ff !important;
                text-shadow:0 1px 0 rgba(2,6,23,.95),0 0 5px rgba(34,211,238,.32) !important;
            }

            /* Running: obvious acceleration, but text stays still. */
            #medinet-auto-unified.mau-running .mau-ring {
                animation:mau756-run-outer .30s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation:mau756-run-inner .46s linear infinite !important;
            }
            @keyframes mau756-run-outer { from { rotate:0deg; } to { rotate:360deg; } }
            @keyframes mau756-run-inner { from { rotate:0deg; } to { rotate:-360deg; } }
            #medinet-auto-unified .mau-energy {
                inset:-6px !important;
                border-radius:50% !important;
                opacity:.10 !important;
                background:conic-gradient(
                    from 0deg,
                    transparent 0 40deg,
                    rgba(125,211,252,.12) 40deg 54deg,
                    transparent 54deg 92deg,
                    rgba(236,254,255,.38) 92deg 98deg,
                    rgba(34,211,238,.15) 98deg 122deg,
                    transparent 122deg 185deg,
                    rgba(125,211,252,.18) 185deg 205deg,
                    transparent 205deg 288deg,
                    rgba(236,254,255,.48) 288deg 294deg,
                    rgba(34,211,238,.17) 294deg 324deg,
                    transparent 324deg 360deg
                ) !important;
                filter:blur(.3px) drop-shadow(0 0 5px rgba(34,211,238,.22)) !important;
            }
            #medinet-auto-unified.mau-running .mau-energy {
                opacity:1 !important;
                animation:mau756-speedhalo .22s linear infinite !important;
            }
            @keyframes mau756-speedhalo { from { rotate:0deg; } to { rotate:360deg; } }
            #medinet-auto-unified.mau-running .mau-shell {
                animation:mau756-shell-breathe .62s ease-in-out infinite alternate !important;
            }
            @keyframes mau756-shell-breathe {
                from { box-shadow:inset 0 0 0 2px rgba(255,255,255,.035),inset 0 0 16px rgba(34,211,238,.09),0 0 0 2px rgba(2,6,23,.88),0 0 14px rgba(34,211,238,.16); }
                to { box-shadow:inset 0 0 0 2px rgba(255,255,255,.05),inset 0 0 22px rgba(34,211,238,.15),0 0 0 2px rgba(2,6,23,.88),0 0 24px rgba(34,211,238,.35); }
            }

            /* Old spark/laser layer is disabled; SVG lightning owns electrical effects. */
            #medinet-auto-unified .mau-sparks { display:none !important; }
            #medinet-auto-unified .mau-lightning-svg {
                position:absolute !important;
                left:50% !important;
                top:50% !important;
                width:160px !important;
                height:160px !important;
                transform:translate(-50%,-50%) !important;
                overflow:visible !important;
                pointer-events:none !important;
                z-index:80 !important;
                opacity:1 !important;
            }
            #medinet-auto-unified .mau-lightning-main,
            #medinet-auto-unified .mau-lightning-branch {
                fill:none !important;
                stroke-linecap:round !important;
                stroke-linejoin:round !important;
                vector-effect:non-scaling-stroke !important;
                opacity:0;
            }
            #medinet-auto-unified .mau-lightning-main {
                stroke:#e8feff !important;
                stroke-width:2.15 !important;
                filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 3px #67e8f9) drop-shadow(0 0 7px rgba(34,211,238,.95)) !important;
            }
            #medinet-auto-unified .mau-lightning-branch {
                stroke:#80efff !important;
                stroke-width:1.15 !important;
                filter:drop-shadow(0 0 2px #67e8f9) drop-shadow(0 0 5px rgba(34,211,238,.80)) !important;
            }

            /* ---------- CLINICAL FORMS: BRIGHT, LARGE, EASY ---------- */
            .mnm-box {
                width:min(540px,95vw) !important;
                background:#ffffff !important;
                border:1px solid #b7ced9 !important;
                border-top:4px solid #0e7490 !important;
                border-radius:16px !important;
                box-shadow:0 22px 60px rgba(15,23,42,.26),0 0 20px rgba(34,211,238,.05) !important;
            }
            .mnm-header {
                padding:16px 20px !important;
                background:#ffffff !important;
                color:#163247 !important;
                border-bottom:1px solid #d8e5eb !important;
                font-size:16px !important;
                font-weight:850 !important;
                text-shadow:none !important;
            }
            .mnm-tabs {
                background:#f7fbfd !important;
                border-bottom:1px solid #d8e5eb !important;
            }
            .mnm-tab {
                color:#607585 !important;
                font-size:14px !important;
                font-weight:750 !important;
                padding:13px 15px !important;
            }
            .mnm-tab.mnm-tab-active {
                color:#075985 !important;
                border-bottom:3px solid #0891b2 !important;
            }
            .mnm-body {
                padding:21px !important;
                color:#1f2937 !important;
                font-size:14px !important;
                line-height:1.55 !important;
            }
            .mnm-input-label {
                color:#23394a !important;
                font-size:14px !important;
                font-weight:800 !important;
                margin-bottom:7px !important;
            }
            .mnm-input,
            .mnm-select {
                min-height:50px !important;
                font-size:16px !important;
                font-weight:550 !important;
                color:#111827 !important;
                background:#fff !important;
                border:2px solid #b8cbd5 !important;
                border-radius:10px !important;
                padding:11px 13px !important;
            }
            .mnm-input::placeholder { color:#718391 !important; opacity:1 !important; }
            .mnm-input:focus,
            .mnm-select:focus {
                border-color:#0891b2 !important;
                box-shadow:0 0 0 4px rgba(8,145,178,.12) !important;
            }
            .mnm-footer {
                background:#f7fbfd !important;
                border-top:1px solid #d8e5eb !important;
                padding:14px 18px 17px !important;
            }
            .mnm-btn {
                min-height:44px !important;
                min-width:102px !important;
                font-size:14px !important;
                font-weight:850 !important;
                border-radius:10px !important;
            }

            /* ---------- STATUS BUBBLE: TECHNICAL, NOT CARTOON ---------- */
            #medinet-auto-dock-panel {
                right:100px !important;
                bottom:90px !important;
                width:min(330px,calc(100vw - 126px)) !important;
                background:rgba(250,254,255,.985) !important;
                color:#172033 !important;
                border:1px solid #8fb9c8 !important;
                border-left:4px solid #0891b2 !important;
                border-radius:12px !important;
                box-shadow:0 14px 34px rgba(15,23,42,.20),0 0 14px rgba(34,211,238,.06) !important;
                overflow:visible !important;
            }
            #medinet-auto-dock-panel .madp-head {
                padding:10px 12px 7px !important;
                background:linear-gradient(90deg,#e8f8fc,#f9fdff) !important;
                border-bottom:1px solid #d5e8ef !important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#173549 !important;
                font-size:14px !important;
                font-weight:900 !important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                color:#334155 !important;
                font-size:13.5px !important;
                line-height:1.48 !important;
            }
            #medinet-auto-dock-panel .madp-running-note {
                margin-top:6px !important;
                padding:7px 9px !important;
                border:0 !important;
                border-left:3px solid #22d3ee !important;
                border-radius:7px !important;
                background:#eefbfe !important;
                color:#0c4a6e !important;
                font-weight:800 !important;
            }
            #medinet-auto-dock-panel .madp-tail {
                position:absolute !important;
                right:18px !important;
                bottom:-9px !important;
                width:16px !important;
                height:16px !important;
                background:#fafeff !important;
                border-right:1px solid #8fb9c8 !important;
                border-bottom:1px solid #8fb9c8 !important;
                transform:rotate(45deg) !important;
                clip-path:none !important;
            }
            #medinet-auto-dock-panel .madp-tail::after { display:none !important; }
            #medinet-auto-dock-panel.madp-warn {
                border-left-color:#d97706 !important;
                background:#fffdf7 !important;
            }
            #medinet-auto-dock-panel.madp-error {
                border-left-color:#dc2626 !important;
                background:#fffafa !important;
            }

            @media (max-width:640px) {
                #medinet-auto-unified {
                    width:66px !important;
                    height:66px !important;
                    right:10px !important;
                    bottom:8px !important;
                }
                #medinet-auto-unified .mau-core { inset:16px !important; }
                #medinet-auto-unified .mau-model { font-size:20px !important; }
                #medinet-auto-dock-panel {
                    right:80px !important;
                    bottom:76px !important;
                    width:min(290px,calc(100vw - 92px)) !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV757Styles() {
        if (document.getElementById('medinet-auto-v757-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v757-style';
        style.textContent = `
            /* =====================================================
               v7.57 — HIGH-TECH ARC REACTOR / CLEAN HUD
               Restore strong reactor rings while keeping readability.
               ===================================================== */
            #medinet-auto-unified {
                width:76px !important;
                height:76px !important;
                right:14px !important;
                bottom:10px !important;
                filter:
                    drop-shadow(0 7px 16px rgba(2,6,23,.34))
                    drop-shadow(0 0 8px rgba(34,211,238,.30)) !important;
            }
            #medinet-auto-unified .mau-shell {
                inset:1px !important;
                background:
                    radial-gradient(circle at 50% 50%, rgba(3,12,23,.98) 0 42%, rgba(5,22,38,.98) 43% 61%, #01050c 62% 100%) !important;
                border:1px solid rgba(147,197,253,.28) !important;
                box-shadow:
                    inset 0 0 0 2px rgba(255,255,255,.035),
                    inset 0 0 20px rgba(34,211,238,.12),
                    0 0 0 2px rgba(2,6,23,.88),
                    0 0 18px rgba(34,211,238,.20) !important;
            }
            /* Strong metallic reactor annulus */
            #medinet-auto-unified .mau-shell::before {
                inset:7px !important;
                border:3px solid rgba(125,211,252,.30) !important;
                box-shadow:
                    inset 0 0 10px rgba(224,242,254,.18),
                    0 0 7px rgba(34,211,238,.22),
                    0 0 0 1px rgba(2,6,23,.85) !important;
                opacity:1 !important;
            }
            #medinet-auto-unified .mau-shell::after {
                content:'' !important;
                position:absolute !important;
                inset:12px !important;
                border-radius:50% !important;
                border:2px solid rgba(207,250,254,.58) !important;
                box-shadow:
                    0 0 9px rgba(103,232,249,.36),
                    inset 0 0 8px rgba(103,232,249,.16) !important;
                opacity:1 !important;
            }
            #medinet-auto-unified .mau-ring {
                inset:3px !important;
                background:repeating-conic-gradient(
                    from -4deg,
                    rgba(236,254,255,.98) 0deg 3deg,
                    rgba(34,211,238,.96) 3deg 11deg,
                    rgba(14,116,144,.48) 11deg 17deg,
                    transparent 17deg 30deg
                ) !important;
                -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0) !important;
                mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 0) !important;
                filter:drop-shadow(0 0 5px rgba(34,211,238,.46)) !important;
                animation:mau757-idle-outer 5.2s linear infinite !important;
            }
            #medinet-auto-unified .mau-ring2 {
                inset:11px !important;
                background:repeating-conic-gradient(
                    from 10deg,
                    rgba(224,242,254,.90) 0deg 2deg,
                    rgba(56,189,248,.78) 2deg 8deg,
                    transparent 8deg 21deg,
                    rgba(99,102,241,.40) 21deg 25deg,
                    transparent 25deg 36deg
                ) !important;
                -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) !important;
                mask:radial-gradient(farthest-side,transparent calc(100% - 3px),#000 0) !important;
                filter:drop-shadow(0 0 4px rgba(125,211,252,.30)) !important;
                animation:mau757-idle-inner 7.8s linear infinite !important;
            }
            @keyframes mau757-idle-outer { from{rotate:0deg} to{rotate:360deg} }
            @keyframes mau757-idle-inner { from{rotate:0deg} to{rotate:-360deg} }

            #medinet-auto-unified .mau-core {
                inset:19px !important;
                background:
                    radial-gradient(circle at 50% 34%, rgba(25,96,125,.92) 0 18%, rgba(4,37,58,.98) 42%, rgba(2,16,29,.995) 70%, #020811 100%) !important;
                border:1.5px solid rgba(207,250,254,.72) !important;
                box-shadow:
                    inset 0 0 11px rgba(125,211,252,.18),
                    0 0 0 3px rgba(34,211,238,.12),
                    0 0 15px rgba(34,211,238,.36) !important;
            }
            #medinet-auto-unified .mau-model {
                font-size:23px !important;
                line-height:20px !important;
                font-weight:950 !important;
                color:#fff !important;
                -webkit-text-stroke:.45px rgba(3,34,53,.98) !important;
                text-shadow:0 1px 0 #020617,0 0 5px rgba(255,255,255,.65),0 0 10px rgba(34,211,238,.40) !important;
            }
            #medinet-auto-unified .mau-auto {
                margin-top:2px !important;
                font-size:7.4px !important;
                line-height:8px !important;
                letter-spacing:1.3px !important;
                font-weight:950 !important;
                color:#d7fbff !important;
                text-shadow:0 1px 0 #020617,0 0 6px rgba(34,211,238,.35) !important;
            }
            #medinet-auto-unified.mau-running .mau-ring {
                animation:mau757-run-outer .27s linear infinite !important;
            }
            #medinet-auto-unified.mau-running .mau-ring2 {
                animation:mau757-run-inner .40s linear infinite !important;
            }
            @keyframes mau757-run-outer { from{rotate:0deg} to{rotate:360deg} }
            @keyframes mau757-run-inner { from{rotate:0deg} to{rotate:-360deg} }
            #medinet-auto-unified.mau-running .mau-shell::after {
                animation:mau757-annulus-pulse .52s ease-in-out infinite alternate !important;
            }
            @keyframes mau757-annulus-pulse {
                from{border-color:rgba(207,250,254,.52);box-shadow:0 0 8px rgba(103,232,249,.30),inset 0 0 7px rgba(103,232,249,.12)}
                to{border-color:rgba(236,254,255,.90);box-shadow:0 0 16px rgba(34,211,238,.58),inset 0 0 12px rgba(103,232,249,.24)}
            }

            /* Technical status bubble: futuristic but readable, balanced hierarchy. */
            #medinet-auto-dock-panel {
                right:102px !important;
                bottom:88px !important;
                width:min(320px,calc(100vw - 128px)) !important;
                background:linear-gradient(145deg,rgba(247,253,255,.985),rgba(235,248,252,.985)) !important;
                color:#142433 !important;
                border:1px solid rgba(14,116,144,.42) !important;
                border-left:4px solid #0891b2 !important;
                border-radius:14px !important;
                box-shadow:
                    0 15px 34px rgba(15,23,42,.18),
                    0 0 0 1px rgba(255,255,255,.72) inset,
                    0 0 18px rgba(34,211,238,.08) !important;
                overflow:visible !important;
            }
            #medinet-auto-dock-panel .madp-head {
                min-height:38px !important;
                padding:9px 12px 7px !important;
                background:linear-gradient(90deg,rgba(207,250,254,.70),rgba(248,253,255,.95)) !important;
                border-bottom:1px solid rgba(14,116,144,.16) !important;
            }
            #medinet-auto-dock-panel .madp-pulse {
                width:8px !important;height:8px !important;
                background:#06b6d4 !important;
                box-shadow:0 0 0 3px rgba(6,182,212,.12),0 0 8px rgba(6,182,212,.55) !important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#12394b !important;
                font-size:14px !important;
                font-weight:900 !important;
                letter-spacing:.08px !important;
            }
            #medinet-auto-dock-panel .madp-body {
                padding:9px 12px 11px !important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                color:#294152 !important;
                font-size:13px !important;
                line-height:1.42 !important;
            }
            #medinet-auto-dock-panel .madp-running-note {
                margin-top:7px !important;
                padding:7px 9px !important;
                background:rgba(224,247,250,.80) !important;
                border:1px solid rgba(8,145,178,.17) !important;
                border-left:3px solid #06b6d4 !important;
                border-radius:8px !important;
                color:#075985 !important;
                font-weight:800 !important;
            }
            #medinet-auto-dock-panel .madp-tail {
                right:20px !important;
                bottom:-8px !important;
                width:14px !important;height:14px !important;
                background:#eef9fc !important;
                border-right:1px solid rgba(14,116,144,.42) !important;
                border-bottom:1px solid rgba(14,116,144,.42) !important;
            }
            #medinet-auto-dock-panel.madp-warn {
                border-left-color:#d97706 !important;
                background:linear-gradient(145deg,#fffdf7,#fff9eb) !important;
            }
            #medinet-auto-dock-panel.madp-error {
                border-left-color:#dc2626 !important;
                background:linear-gradient(145deg,#fffafa,#fff1f2) !important;
            }

            /* Clinical forms stay bright/readable, with subtle high-tech accents only. */
            .mnm-modal {
                border:1px solid rgba(14,116,144,.22) !important;
                box-shadow:0 20px 55px rgba(15,23,42,.25),0 0 0 1px rgba(255,255,255,.8) inset !important;
            }
            .mnm-header {
                background:linear-gradient(90deg,#f8fdff,#edf9fc) !important;
                border-bottom:1px solid #cfe4ec !important;
            }
            .mnm-header::before {
                content:'' !important;
                position:absolute !important;
                left:0 !important;top:0 !important;bottom:0 !important;width:4px !important;
                background:linear-gradient(180deg,#22d3ee,#0284c7) !important;
            }
            .mnm-title { color:#12394b !important;font-weight:900 !important; }
            .mnm-tabs { background:#f8fcfe !important; }
            .mnm-tab.active { color:#0369a1 !important;border-bottom-color:#06b6d4 !important; }
            .mnm-btn-primary {
                background:linear-gradient(135deg,#0891b2,#2563eb) !important;
                box-shadow:0 5px 14px rgba(37,99,235,.16) !important;
            }

            @media(max-width:640px){
                #medinet-auto-unified{width:68px !important;height:68px !important;right:9px !important;bottom:7px !important}
                #medinet-auto-unified .mau-core{inset:17px !important}
                #medinet-auto-unified .mau-model{font-size:21px !important}
                #medinet-auto-dock-panel{right:82px !important;bottom:75px !important;width:min(286px,calc(100vw - 94px)) !important}
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV758Styles() {
        if (document.getElementById('medinet-auto-v758-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v758-style';
        style.textContent = `
            /* =====================================================
               v7.58 — HIGH-TECH CLEANUP + ACCESSIBLE REPORTS
               ===================================================== */
            #medinet-auto-unified {
                width: 78px !important;
                height: 78px !important;
            }
            #medinet-auto-unified .mau-shell {
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,.05),
                    inset 0 0 18px rgba(34,211,238,.14),
                    0 0 0 2px rgba(2,6,23,.86),
                    0 0 22px rgba(34,211,238,.25) !important;
            }
            #medinet-auto-unified .mau-ring {
                opacity: 1 !important;
                filter: drop-shadow(0 0 5px rgba(103,232,249,.45)) !important;
            }
            #medinet-auto-unified .mau-ring2 {
                opacity: .96 !important;
            }
            #medinet-auto-unified .mau-core {
                inset: 18px !important;
                background: radial-gradient(circle at 50% 46%, rgba(250,255,255,.98) 0 16%, rgba(178,244,255,.92) 17% 26%, rgba(46,170,204,.56) 27% 42%, rgba(7,29,48,.96) 57%, rgba(3,12,24,.98) 100%) !important;
            }
            #medinet-auto-unified .mau-model {
                font-size: 22px !important;
                line-height: 18px !important;
                text-shadow: 0 0 2px rgba(255,255,255,.98), 0 0 9px rgba(103,232,249,.40), 0 1px 1px rgba(0,0,0,.65) !important;
            }
            #medinet-auto-unified .mau-auto {
                font-size: 7px !important;
                letter-spacing: 1.25px !important;
                color: #f2fdff !important;
                text-shadow: 0 0 4px rgba(255,255,255,.42), 0 1px 1px rgba(0,0,0,.55) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-shell {
                background: radial-gradient(circle at 50% 50%, rgba(90,17,17,.30) 0 36%, rgba(47,10,10,.85) 37%, rgba(20,7,9,.96) 100%) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,.04),
                    inset 0 0 18px rgba(248,113,113,.12),
                    0 0 0 2px rgba(44,8,8,.88),
                    0 0 20px rgba(248,113,113,.18) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-core {
                background: radial-gradient(circle at 50% 45%, rgba(255,251,244,.98) 0 15%, rgba(255,214,170,.92) 16% 25%, rgba(195,74,74,.60) 26% 42%, rgba(53,17,17,.96) 58%, rgba(22,8,10,.98) 100%) !important;
            }
            #medinet-auto-unified .mau-warning {
                top: 50% !important;
                left: 50% !important;
                right: auto !important;
                transform: translate(-50%, -50%) !important;
                width: 28px !important;
                height: 28px !important;
                border-radius: 999px !important;
                background: radial-gradient(circle at 35% 35%, rgba(255,254,235,.98), rgba(253,186,116,.96) 62%, rgba(234,88,12,.98) 100%) !important;
                box-shadow: 0 0 0 2px rgba(255,248,220,.42), 0 0 10px rgba(251,146,60,.56) !important;
                opacity: 0 !important;
                pointer-events: none !important;
                z-index: 130 !important;
            }
            #medinet-auto-unified .mau-warning::before {
                content: '!' !important;
                width: 100% !important;
                height: 100% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                color: #7c2d12 !important;
                font-size: 19px !important;
                font-weight: 900 !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-warning {
                opacity: 1 !important;
                pointer-events: auto !important;
            }
            #medinet-auto-dock-panel {
                right: 102px !important;
                bottom: 90px !important;
                width: min(350px, calc(100vw - 126px)) !important;
                border-radius: 16px !important;
            }
            #medinet-auto-dock-panel .madp-head {
                padding: 11px 14px 9px !important;
            }
            #medinet-auto-dock-panel .madp-title {
                font-size: 15px !important;
                line-height: 1.28 !important;
            }
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .madp-body * {
                font-size: 14px !important;
                line-height: 1.52 !important;
            }
            #medinet-auto-dock-panel .madp-speech-line + .madp-speech-line {
                margin-top: 6px !important;
            }
            #medinet-auto-dock-panel.madp-long {
                width: min(420px, calc(100vw - 124px)) !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                max-height: min(58vh, 470px) !important;
                padding-right: 12px !important;
            }
            .madp-report { display: grid !important; gap: 14px !important; }
            .madp-patient-card {
                background: linear-gradient(180deg,#fbfeff,#f4fbfd) !important;
                border: 1px solid #d6e8ef !important;
                border-radius: 14px !important;
                padding: 14px !important;
            }
            .madp-patient-grid {
                display: grid !important;
                grid-template-columns: 110px 1fr !important;
                gap: 10px 14px !important;
                align-items: center !important;
            }
            .madp-patient-grid > div { display: contents !important; }
            .madp-patient-grid span {
                color: #536878 !important;
                font-weight: 700 !important;
            }
            .madp-patient-grid b {
                color: #0f172a !important;
                font-size: 15px !important;
                font-weight: 900 !important;
            }
            .madp-summary-grid {
                display: grid !important;
                grid-template-columns: repeat(2, minmax(0,1fr)) !important;
                gap: 10px !important;
            }
            .madp-summary-box {
                border-radius: 12px !important;
                padding: 12px 12px 10px !important;
                background: #f8fcfe !important;
                border: 1px solid #d8e8ef !important;
            }
            .madp-summary-box span { display:block !important; color:#516879 !important; font-weight:700 !important; margin-bottom:4px !important; }
            .madp-summary-box b { font-size:22px !important; line-height:1 !important; color:#0f172a !important; }
            .madp-summary-box.is-warn { background:#fff8f1 !important; border-color:#f6c89d !important; }
            .madp-summary-box.is-warn b { color:#9a3412 !important; }
            .madp-summary-box.is-ok { background:#f2fbf8 !important; border-color:#bfdfd0 !important; }
            .madp-summary-box.is-ok b { color:#166534 !important; }
            .madp-section { display:grid !important; gap:10px !important; }
            .madp-section-title {
                font-size: 14px !important;
                font-weight: 900 !important;
                color: #14384b !important;
            }
            .madp-missing-list { display:flex !important; flex-wrap:wrap !important; gap:8px !important; }
            .madp-missing-chip {
                background:#fff8e8 !important; color:#92400e !important; border:1px solid #f6d69d !important;
                border-radius:999px !important; padding:6px 10px !important; font-size:12.5px !important; font-weight:800 !important;
            }
            .mnm-finding-row {
                gap: 12px !important;
                padding: 12px 0 !important;
                border-bottom: 1px solid #e7eff4 !important;
            }
            .mnm-badge {
                min-width: 52px !important;
                padding: 5px 10px !important;
                border-radius: 8px !important;
                font-size: 12px !important;
                font-weight: 900 !important;
            }
            .mnm-finding-label {
                font-size: 16px !important;
                font-weight: 900 !important;
                margin-bottom: 4px !important;
            }
            .mnm-finding-number {
                font-size: 28px !important;
                line-height: 1.05 !important;
                margin-bottom: 4px !important;
            }
            .mnm-finding-range {
                display: block !important;
                font-size: 13px !important;
                color: #607385 !important;
                margin-bottom: 6px !important;
            }
            .mnm-finding-icd {
                font-size: 13px !important;
                padding: 4px 9px !important;
                border-radius: 7px !important;
            }
            .mnm-note, .madp-save-reminder {
                font-size: 13px !important;
                line-height: 1.5 !important;
            }
            .mnm-result-empty { display:grid !important; gap:8px !important; }
            .mnm-result-empty-title {
                font-size: 15px !important;
                font-weight: 900 !important;
                color: #92400e !important;
            }
            .mnm-result-empty-desc { color:#334155 !important; }
            @media (max-width: 640px) {
                #medinet-auto-dock-panel,
                #medinet-auto-dock-panel.madp-long { width:min(300px, calc(100vw - 92px)) !important; right:80px !important; bottom:76px !important; }
                .madp-patient-grid { grid-template-columns: 92px 1fr !important; }
                .mnm-finding-label { font-size: 15px !important; }
                .mnm-finding-number { font-size: 26px !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV759Styles() {
        if (document.getElementById('medinet-auto-v759-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v759-style';
        style.textContent = `
            /* =====================================================
               v7.59 — WARNING STATE + REPORT LAYOUT FIX
               Last UI layer: must override all legacy bubble styles.
               ===================================================== */

            /* ---------- WARNING REACTOR: UNMISSABLE ---------- */
            #medinet-auto-unified.mau-has-warning {
                filter:
                    drop-shadow(0 7px 16px rgba(55,7,10,.34))
                    drop-shadow(0 0 13px rgba(239,68,68,.50)) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-shell {
                background:
                    radial-gradient(circle at 50% 48%, rgba(104,18,24,.44) 0 35%, rgba(61,9,14,.92) 36% 65%, rgba(24,5,8,.99) 100%) !important;
                border-color: rgba(254,202,202,.38) !important;
                box-shadow:
                    inset 0 0 0 1px rgba(255,255,255,.04),
                    inset 0 0 20px rgba(248,113,113,.22),
                    0 0 0 2px rgba(46,5,10,.92),
                    0 0 24px rgba(239,68,68,.34) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-ring {
                background: repeating-conic-gradient(
                    from 4deg,
                    rgba(254,226,226,.98) 0 4deg,
                    rgba(248,113,113,.96) 4deg 10deg,
                    rgba(127,29,29,.96) 10deg 17deg,
                    transparent 17deg 28deg
                ) !important;
                filter: drop-shadow(0 0 5px rgba(248,113,113,.72)) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-ring2 {
                background: repeating-conic-gradient(
                    from 20deg,
                    rgba(255,237,213,.96) 0 4deg,
                    rgba(251,146,60,.92) 4deg 9deg,
                    rgba(185,28,28,.80) 9deg 15deg,
                    transparent 15deg 30deg
                ) !important;
                filter: drop-shadow(0 0 4px rgba(251,146,60,.52)) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-energy {
                opacity: .48 !important;
                background: conic-gradient(
                    from 0deg,
                    transparent 0 246deg,
                    rgba(255,255,255,.95) 248deg 253deg,
                    #fecaca 254deg 272deg,
                    #f87171 273deg 305deg,
                    transparent 306deg 360deg
                ) !important;
                filter: drop-shadow(0 0 5px rgba(248,113,113,.70)) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-core {
                inset: 17px !important;
                background:
                    radial-gradient(circle at 48% 38%, rgba(255,248,238,.99) 0 14%, rgba(254,202,202,.96) 15% 27%, rgba(220,38,38,.62) 28% 46%, rgba(69,10,17,.98) 62%, rgba(24,5,8,.99) 100%) !important;
                border-color: rgba(254,202,202,.58) !important;
                box-shadow:
                    inset 0 0 12px rgba(255,255,255,.24),
                    0 0 19px rgba(248,113,113,.46) !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-model,
            #medinet-auto-unified.mau-has-warning .mau-auto {
                opacity: 0 !important;
                visibility: hidden !important;
            }
            #medinet-auto-unified .mau-warning {
                top:50% !important;
                left:50% !important;
                right:auto !important;
                transform:translate(-50%,-50%) !important;
                width:44px !important;
                height:44px !important;
                border-radius:50% !important;
                border:2px solid rgba(255,237,213,.86) !important;
                background:
                    radial-gradient(circle at 38% 32%, #fff7ed 0 18%, #fdba74 34%, #f97316 62%, #b91c1c 100%) !important;
                box-shadow:
                    inset 0 0 8px rgba(255,255,255,.45),
                    0 0 0 3px rgba(69,10,10,.65),
                    0 0 18px rgba(249,115,22,.72) !important;
                opacity:0 !important;
                pointer-events:none !important;
                z-index:180 !important;
            }
            #medinet-auto-unified .mau-warning::before {
                content:'!' !important;
                position:static !important;
                width:100% !important;
                height:100% !important;
                display:flex !important;
                align-items:center !important;
                justify-content:center !important;
                background:none !important;
                border:0 !important;
                box-shadow:none !important;
                color:#7f1d1d !important;
                font:900 31px/1 'Segoe UI',Arial,sans-serif !important;
                text-shadow:0 1px 0 rgba(255,255,255,.55) !important;
                opacity:1 !important;
                transform:none !important;
            }
            #medinet-auto-unified.mau-has-warning .mau-warning {
                opacity:1 !important;
                pointer-events:auto !important;
                animation:mau759-warning-pulse 1.45s ease-in-out infinite alternate !important;
            }
            @keyframes mau759-warning-pulse {
                from { scale:.96; filter:brightness(.96); }
                to   { scale:1.04; filter:brightness(1.08); }
            }

            /* ---------- STATUS / REPORT SHELL ---------- */
            #medinet-auto-dock-panel {
                width:min(370px,calc(100vw - 126px)) !important;
                background:#ffffff !important;
                color:#172033 !important;
                border:1px solid #9ab9c7 !important;
                border-left:4px solid #0e7490 !important;
                border-radius:16px !important;
                box-shadow:0 16px 40px rgba(15,23,42,.22),0 0 18px rgba(14,116,144,.07) !important;
            }
            #medinet-auto-dock-panel.madp-long {
                width:min(480px,calc(100vw - 130px)) !important;
            }
            #medinet-auto-dock-panel .madp-head {
                background:linear-gradient(90deg,#edf9fc,#ffffff) !important;
                border-bottom:1px solid #dbe9ef !important;
                padding:12px 16px 10px !important;
            }
            #medinet-auto-dock-panel .madp-title {
                color:#173549 !important;
                font-size:16px !important;
                line-height:1.25 !important;
                font-weight:900 !important;
            }
            #medinet-auto-dock-panel .madp-body {
                color:#263746 !important;
                padding:14px 16px 16px !important;
            }
            #medinet-auto-dock-panel .madp-body * {
                box-sizing:border-box !important;
            }
            #medinet-auto-dock-panel:not(.madp-long) .madp-body {
                overflow:visible !important;
                max-height:none !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                max-height:min(64vh,540px) !important;
                overflow-y:auto !important;
                overflow-x:hidden !important;
                padding-right:22px !important;
                scrollbar-gutter:stable !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar { width:7px !important; }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar-track { background:transparent !important; }
            #medinet-auto-dock-panel.madp-long .madp-body::-webkit-scrollbar-thumb {
                background:#b8c8d0 !important;
                border-radius:999px !important;
            }

            /* ---------- PATIENT INFO: NO INVISIBLE TEXT ---------- */
            #medinet-auto-dock-panel .madp-report {
                display:grid !important;
                gap:15px !important;
                color:#172033 !important;
            }
            #medinet-auto-dock-panel .madp-patient-card {
                width:100% !important;
                overflow:visible !important;
                max-height:none !important;
                background:#f7fbfd !important;
                border:1px solid #d3e4eb !important;
                border-radius:13px !important;
                padding:14px 15px !important;
                color:#172033 !important;
            }
            #medinet-auto-dock-panel .madp-patient-grid {
                display:grid !important;
                grid-template-columns:112px minmax(0,1fr) !important;
                gap:9px 14px !important;
                align-items:start !important;
                color:#172033 !important;
            }
            #medinet-auto-dock-panel .madp-patient-grid > div { display:contents !important; }
            #medinet-auto-dock-panel .madp-patient-grid span {
                display:block !important;
                color:#465b6b !important;
                font-size:13.5px !important;
                font-weight:750 !important;
                line-height:1.35 !important;
            }
            #medinet-auto-dock-panel .madp-patient-grid b {
                display:block !important;
                color:#0f172a !important;
                font-size:14.5px !important;
                font-weight:900 !important;
                line-height:1.35 !important;
                overflow-wrap:anywhere !important;
                text-shadow:none !important;
                opacity:1 !important;
            }

            /* ---------- SUMMARY CARDS ---------- */
            #medinet-auto-dock-panel .madp-summary-grid {
                display:grid !important;
                grid-template-columns:repeat(2,minmax(0,1fr)) !important;
                gap:10px !important;
            }
            #medinet-auto-dock-panel .madp-summary-box {
                min-height:76px !important;
                padding:12px 13px !important;
                border-radius:12px !important;
                border:1px solid #d5e4ea !important;
                background:#f8fbfd !important;
            }
            #medinet-auto-dock-panel .madp-summary-box span {
                display:block !important;
                color:#42596a !important;
                font-size:13px !important;
                font-weight:800 !important;
                line-height:1.25 !important;
                margin-bottom:8px !important;
            }
            #medinet-auto-dock-panel .madp-summary-box b {
                display:block !important;
                color:#0f172a !important;
                font-size:25px !important;
                line-height:1 !important;
                font-weight:900 !important;
                opacity:1 !important;
                text-shadow:none !important;
            }
            #medinet-auto-dock-panel .madp-summary-box.is-warn {
                background:#fff7ed !important;
                border-color:#fdba74 !important;
            }
            #medinet-auto-dock-panel .madp-summary-box.is-warn b { color:#c2410c !important; }
            #medinet-auto-dock-panel .madp-summary-box.is-ok {
                background:#f0fdf4 !important;
                border-color:#bbdfc7 !important;
            }
            #medinet-auto-dock-panel .madp-summary-box.is-ok b { color:#166534 !important; }

            /* ---------- FINDINGS ---------- */
            #medinet-auto-dock-panel .madp-findings-list {
                display:grid !important;
                gap:0 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-row {
                display:grid !important;
                grid-template-columns:58px minmax(0,1fr) !important;
                gap:12px !important;
                padding:14px 0 !important;
                border-bottom:1px solid #e5edf1 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-row:last-of-type { border-bottom:0 !important; }
            #medinet-auto-dock-panel .mnm-badge {
                align-self:start !important;
                min-width:58px !important;
                padding:6px 8px !important;
                border-radius:8px !important;
                color:#fff !important;
                font-size:12px !important;
                font-weight:900 !important;
                text-align:center !important;
            }
            #medinet-auto-dock-panel .mnm-finding-label {
                color:#172033 !important;
                font-size:15px !important;
                font-weight:900 !important;
                line-height:1.3 !important;
                margin-bottom:5px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-number {
                color:inherit !important;
                font-size:26px !important;
                line-height:1 !important;
                font-weight:900 !important;
                margin:0 0 5px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-number-thap { color:#1d4ed8 !important; }
            #medinet-auto-dock-panel .mnm-finding-number-cao { color:#dc2626 !important; }
            #medinet-auto-dock-panel .mnm-finding-range {
                display:block !important;
                color:#5f7281 !important;
                font-size:13px !important;
                line-height:1.35 !important;
                margin:0 0 8px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-icd {
                display:flex !important;
                flex-wrap:wrap !important;
                align-items:center !important;
                gap:5px 7px !important;
                width:100% !important;
                margin:0 !important;
                padding:7px 9px !important;
                border:1px solid #fed7aa !important;
                border-radius:8px !important;
                background:#fff7ed !important;
                color:#7c2d12 !important;
                font-size:12.5px !important;
                line-height:1.4 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-icd span,
            #medinet-auto-dock-panel .mnm-finding-icd b {
                color:#7c2d12 !important;
                font-size:12.5px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-icd b { font-weight:900 !important; }

            /* ---------- MISSING / NOTES ---------- */
            #medinet-auto-dock-panel .madp-section {
                display:grid !important;
                gap:9px !important;
            }
            #medinet-auto-dock-panel .madp-section-title {
                color:#173549 !important;
                font-size:14px !important;
                font-weight:900 !important;
            }
            #medinet-auto-dock-panel .madp-missing-list { display:flex !important; flex-wrap:wrap !important; gap:7px !important; }
            #medinet-auto-dock-panel .madp-missing-chip {
                padding:5px 9px !important;
                border:1px solid #f3c879 !important;
                border-radius:999px !important;
                background:#fff8e8 !important;
                color:#854d0e !important;
                font-size:12.5px !important;
                font-weight:800 !important;
            }
            #medinet-auto-dock-panel .mnm-note {
                margin-top:9px !important;
                color:#6b4a22 !important;
                background:#fffaf0 !important;
                border:1px solid #f3dfbd !important;
                border-radius:8px !important;
                padding:8px 10px !important;
                font-size:12.5px !important;
                line-height:1.45 !important;
            }
            #medinet-auto-dock-panel .madp-save-reminder {
                color:#0c4a6e !important;
                background:#eef9fc !important;
                border:1px solid #c8e8f1 !important;
                border-left:4px solid #0891b2 !important;
                border-radius:9px !important;
                padding:10px 11px !important;
                font-size:13px !important;
                font-weight:800 !important;
                line-height:1.45 !important;
            }

            /* ---------- NO-RESULT MODAL ---------- */
            .mnm-result-empty { display:grid !important; gap:9px !important; }
            .mnm-result-empty-title {
                color:#92400e !important;
                font-size:15px !important;
                font-weight:900 !important;
                line-height:1.4 !important;
            }
            .mnm-result-empty-desc {
                display:grid !important;
                grid-template-columns:auto 1fr !important;
                gap:7px !important;
                color:#334155 !important;
                font-size:14px !important;
            }
            .mnm-result-empty-desc span { color:#64748b !important; font-weight:700 !important; }
            .mnm-result-empty-desc b { color:#0f172a !important; font-weight:900 !important; overflow-wrap:anywhere !important; }
            .mnm-result-empty-help { color:#334155 !important; font-size:14px !important; line-height:1.5 !important; }

            /* ---------- CLEAN TAIL ---------- */
            #medinet-auto-dock-panel .madp-tail {
                right:22px !important;
                bottom:-8px !important;
                width:14px !important;
                height:14px !important;
                background:#fff !important;
                border-right:1px solid #9ab9c7 !important;
                border-bottom:1px solid #9ab9c7 !important;
                box-shadow:none !important;
                z-index:0 !important;
            }

            /* ---------- LIGHTNING: MAIN + BRANCHES CLEARER ---------- */
            #medinet-auto-unified .mau-lightning-main {
                stroke:#f4ffff !important;
                stroke-width:2.6 !important;
                filter:drop-shadow(0 0 1px #fff) drop-shadow(0 0 4px #67e8f9) drop-shadow(0 0 9px rgba(34,211,238,.98)) !important;
            }
            #medinet-auto-unified .mau-lightning-branch {
                stroke:#9bf5ff !important;
                stroke-width:1.55 !important;
                filter:drop-shadow(0 0 2px #67e8f9) drop-shadow(0 0 6px rgba(34,211,238,.82)) !important;
            }

            @media(max-width:640px) {
                #medinet-auto-unified { width:70px !important;height:70px !important; }
                #medinet-auto-unified .mau-warning { width:40px !important;height:40px !important; }
                #medinet-auto-unified .mau-warning::before { font-size:28px !important; }
                #medinet-auto-dock-panel,
                #medinet-auto-dock-panel.madp-long {
                    width:min(310px,calc(100vw - 92px)) !important;
                    right:80px !important;
                    bottom:76px !important;
                }
                #medinet-auto-dock-panel .madp-patient-grid { grid-template-columns:92px minmax(0,1fr) !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV761Styles() {
        if (document.getElementById('medinet-auto-v761-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v761-style';
        style.textContent = `
            /* =====================================================
               v7.61 — CLINICAL ALERT INSPECTOR
               Wider, calmer, fewer colors, clearer hierarchy.
               ===================================================== */

            #medinet-auto-dock-panel.madp-long {
                width:min(500px,calc(100vw - 132px)) !important;
                max-width:500px !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                max-height:min(62vh,520px) !important;
                padding:14px 16px 15px !important;
            }
            #medinet-auto-dock-panel.madp-warn {
                background:#ffffff !important;
                border:1px solid #d8e5eb !important;
                border-left:4px solid #d97706 !important;
            }
            #medinet-auto-dock-panel.madp-warn .madp-head {
                background:linear-gradient(90deg,#fff9ef 0%,#ffffff 78%) !important;
                border-bottom:1px solid #ece3d8 !important;
            }

            .madp-inspector {
                display:grid !important;
                gap:13px !important;
                color:#172033 !important;
            }
            .madp-inspector-patient {
                padding-bottom:11px !important;
                border-bottom:1px solid #e5edf1 !important;
            }
            .madp-inspector-name {
                color:#0f172a !important;
                font-size:17px !important;
                line-height:1.25 !important;
                font-weight:900 !important;
                letter-spacing:.05px !important;
                overflow-wrap:anywhere !important;
            }
            .madp-inspector-meta {
                margin-top:5px !important;
                color:#607385 !important;
                font-size:12.8px !important;
                line-height:1.45 !important;
                font-weight:650 !important;
                overflow-wrap:anywhere !important;
            }
            .madp-inspector-summary {
                display:flex !important;
                align-items:center !important;
                flex-wrap:wrap !important;
                gap:7px 10px !important;
                min-height:34px !important;
                padding:8px 11px !important;
                border-radius:10px !important;
                background:#f7fafc !important;
                border:1px solid #e0e9ee !important;
                color:#42596a !important;
                font-size:13px !important;
                font-weight:750 !important;
            }
            .madp-inspector-summary span {
                color:#42596a !important;
                font-size:13px !important;
                font-weight:750 !important;
                white-space:nowrap !important;
            }
            .madp-inspector-summary b {
                color:#9a3412 !important;
                font-size:15px !important;
                font-weight:900 !important;
            }
            .madp-inspector-summary i {
                width:4px !important;
                height:4px !important;
                border-radius:50% !important;
                background:#94a3b8 !important;
                flex:none !important;
            }

            .madp-inspector-section {
                display:grid !important;
                gap:8px !important;
            }
            .madp-inspector-section-title {
                color:#173549 !important;
                font-size:13.5px !important;
                line-height:1.3 !important;
                font-weight:900 !important;
                letter-spacing:.08px !important;
            }
            .madp-inspector-missing {
                padding:10px 11px !important;
                border-radius:10px !important;
                background:#fffaf2 !important;
                border:1px solid #f0dfc7 !important;
            }

            /* Compact horizontal finding cards */
            #medinet-auto-dock-panel .madp-findings-list {
                display:grid !important;
                gap:8px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-row {
                display:grid !important;
                grid-template-columns:58px minmax(0,1fr) !important;
                gap:11px !important;
                padding:11px 12px !important;
                border:1px solid #e3ebef !important;
                border-radius:11px !important;
                background:#fbfdfe !important;
            }
            #medinet-auto-dock-panel .mnm-finding-row:last-of-type {
                border-bottom:1px solid #e3ebef !important;
            }
            #medinet-auto-dock-panel .mnm-badge {
                align-self:start !important;
                min-width:58px !important;
                margin-top:1px !important;
                padding:5px 7px !important;
                border-radius:8px !important;
                font-size:11.5px !important;
                line-height:1.1 !important;
                font-weight:900 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-main {
                min-width:0 !important;
                display:grid !important;
                grid-template-columns:minmax(0,1fr) auto !important;
                grid-template-areas:
                    "label value"
                    "range range"
                    "icd icd" !important;
                column-gap:12px !important;
                row-gap:4px !important;
                align-items:baseline !important;
            }
            #medinet-auto-dock-panel .mnm-finding-label {
                grid-area:label !important;
                min-width:0 !important;
                color:#172033 !important;
                font-size:14.5px !important;
                line-height:1.3 !important;
                font-weight:900 !important;
                margin:0 !important;
                overflow-wrap:anywhere !important;
            }
            #medinet-auto-dock-panel .mnm-finding-number {
                grid-area:value !important;
                margin:0 !important;
                font-size:24px !important;
                line-height:1 !important;
                font-weight:900 !important;
                white-space:nowrap !important;
            }
            #medinet-auto-dock-panel .mnm-finding-range {
                grid-area:range !important;
                display:block !important;
                margin:0 !important;
                color:#657887 !important;
                font-size:12.5px !important;
                line-height:1.35 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-icd {
                grid-area:icd !important;
                width:auto !important;
                max-width:100% !important;
                margin:3px 0 0 !important;
                padding:5px 8px !important;
                border:0 !important;
                border-left:3px solid #f59e0b !important;
                border-radius:5px !important;
                background:#fff9ef !important;
                color:#7c4a19 !important;
                font-size:12px !important;
                line-height:1.38 !important;
                overflow-wrap:anywhere !important;
            }

            #medinet-auto-dock-panel .madp-missing-list {
                gap:6px !important;
            }
            #medinet-auto-dock-panel .madp-missing-chip {
                padding:4px 8px !important;
                font-size:12px !important;
                background:#fff !important;
                border-color:#e9cfaa !important;
            }
            #medinet-auto-dock-panel .mnm-note {
                background:transparent !important;
                border:0 !important;
                padding:0 !important;
                color:#64748b !important;
                font-size:12px !important;
            }
            #medinet-auto-dock-panel .madp-save-reminder {
                margin-top:1px !important;
                background:#eef9fc !important;
                border:1px solid #cae8ef !important;
                border-left:3px solid #0891b2 !important;
                border-radius:8px !important;
                padding:9px 10px !important;
                color:#0c4a6e !important;
                font-size:12.8px !important;
                line-height:1.45 !important;
                font-weight:800 !important;
            }

            /* Tail is only an anchor cue, not a second focal point. */
            #medinet-auto-dock-panel .madp-tail {
                width:11px !important;
                height:11px !important;
                right:24px !important;
                bottom:-6px !important;
                opacity:.85 !important;
            }

            @media(max-width:720px) {
                #medinet-auto-dock-panel.madp-long {
                    width:min(360px,calc(100vw - 90px)) !important;
                }
                #medinet-auto-dock-panel .mnm-finding-main {
                    grid-template-columns:minmax(0,1fr) !important;
                    grid-template-areas:
                        "label"
                        "value"
                        "range"
                        "icd" !important;
                    row-gap:4px !important;
                }
                #medinet-auto-dock-panel .mnm-finding-number {
                    font-size:23px !important;
                }
                .madp-inspector-summary span {
                    white-space:normal !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV762Styles() {
        if (document.getElementById('medinet-auto-v762-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v762-style';
        style.textContent = `
            /* =====================================================
               v7.62 — CONTRAST FIX
               ===================================================== */
            #medinet-auto-dock-panel.madp-long {
                width:min(510px,calc(100vw - 130px)) !important;
            }
            .madp-inspector {
                color:#172033 !important;
            }
            .madp-inspector-summary {
                display:grid !important;
                grid-template-columns:repeat(2,minmax(0,1fr)) !important;
                gap:10px !important;
                padding:0 !important;
                background:transparent !important;
                border:0 !important;
                min-height:0 !important;
            }
            .madp-inspector-pill {
                display:grid !important;
                gap:4px !important;
                align-content:center !important;
                min-height:64px !important;
                padding:10px 12px !important;
                border-radius:12px !important;
                border:1px solid #d8e4ea !important;
                background:#f8fbfc !important;
                box-shadow: inset 0 1px 0 rgba(255,255,255,.8) !important;
            }
            .madp-inspector-pill small {
                display:block !important;
                color:#526374 !important;
                font-size:12.5px !important;
                line-height:1.25 !important;
                font-weight:800 !important;
            }
            .madp-inspector-pill b {
                display:block !important;
                color:#0f172a !important;
                font-size:31px !important;
                line-height:1 !important;
                font-weight:900 !important;
            }
            .madp-inspector-pill.is-warn {
                background:#fff7ef !important;
                border-color:#f2cb9a !important;
            }
            .madp-inspector-pill.is-warn b { color:#b45309 !important; }
            .madp-inspector-pill.is-missing {
                background:#f3f8f7 !important;
                border-color:#c8ddd7 !important;
            }
            .madp-inspector-pill.is-missing b { color:#166534 !important; }
            .madp-inspector-section-title {
                color:#122b3d !important;
                font-size:14px !important;
            }
            #medinet-auto-dock-panel .mnm-finding-row {
                background:#ffffff !important;
                border:1px solid #dbe7ed !important;
                box-shadow: 0 1px 0 rgba(15,23,42,.03) !important;
            }
            #medinet-auto-dock-panel .mnm-badge,
            #medinet-auto-dock-panel .mnm-badge-thap,
            #medinet-auto-dock-panel .mnm-badge-cao {
                color:#ffffff !important;
            }
            #medinet-auto-dock-panel .mnm-badge-thap {
                background:#3558e6 !important;
                box-shadow: inset 0 -1px 0 rgba(0,0,0,.12) !important;
            }
            #medinet-auto-dock-panel .mnm-badge-cao {
                background:#d13a30 !important;
                box-shadow: inset 0 -1px 0 rgba(0,0,0,.12) !important;
            }
            #medinet-auto-dock-panel .mnm-finding-label {
                color:#172033 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-number-thap { color:#3558e6 !important; }
            #medinet-auto-dock-panel .mnm-finding-number-cao { color:#d13a30 !important; }
            #medinet-auto-dock-panel .mnm-finding-range {
                color:#5a6f7e !important;
                font-weight:700 !important;
            }
            #medinet-auto-dock-panel .mnm-finding-icd {
                background:#fff7ec !important;
                border-left-color:#f59e0b !important;
                color:#7c4a19 !important;
            }
            #medinet-auto-dock-panel .madp-inspector-name {
                color:#0f172a !important;
            }
            #medinet-auto-dock-panel .madp-inspector-meta {
                color:#4d6272 !important;
            }
            @media(max-width:720px){
                .madp-inspector-summary {
                    grid-template-columns:1fr !important;
                }
                .madp-inspector-pill b {
                    font-size:28px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV763Styles() {
        if (document.getElementById('medinet-auto-v763-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v763-style';
        style.textContent = `
            /* =====================================================
               v7.63 — DETERMINISTIC CONTRAST / NO MORE INVISIBLE TEXT
               ===================================================== */
            #medinet-auto-dock-panel.madp-long {
                background:#ffffff !important;
                color:#111827 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                background:#ffffff !important;
                color:#111827 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-name {
                color:#0f172a !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-meta {
                color:#475569 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-section-title {
                color:#0f2f43 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-pill small {
                color:#334155 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-pill.is-warn b {
                color:#b45309 !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-inspector-pill.is-missing b {
                color:#166534 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-row {
                background:#ffffff !important;
                color:#111827 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-label {
                color:#111827 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-range {
                color:#526575 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-icd {
                color:#7c3f10 !important;
                background:#fff6e8 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-badge-thap {
                background:#3157d8 !important;
                color:#ffffff !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-badge-cao {
                background:#cf3c32 !important;
                color:#ffffff !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-number-thap {
                color:#3157d8 !important;
            }
            #medinet-auto-dock-panel.madp-long .mnm-finding-number-cao {
                color:#cf3c32 !important;
            }
        `;
        document.head.appendChild(style);
    }

    function promoteFinalAutoStyles() {
        [
            'medinet-auto-v759-style',
            'medinet-auto-v761-style',
            'medinet-auto-v762-style',
            'medinet-auto-v763-style',
            'medinet-auto-v764-style',
            'medinet-auto-v765-style',
            'medinet-auto-v767-style',
            'medinet-auto-v768-style',
            'medinet-auto-v770-style'
        ].forEach(id => {
            const node = document.getElementById(id);
            if (node && node.parentNode) {
                node.parentNode.appendChild(node);
            }
        });
    }

    function applyInspectorContrastHardening(panel) {
        if (!panel || !panel.querySelector('.madp-inspector')) return;

        const force = (selector, props) => {
            panel.querySelectorAll(selector).forEach(el => {
                Object.entries(props).forEach(([name, value]) => {
                    el.style.setProperty(name, value, 'important');
                });
            });
        };

        force('.madp-body', {
            'background': '#ffffff',
            'color': '#111827'
        });
        force('.madp-inspector-name', {
            'color': '#0f172a'
        });
        force('.madp-inspector-meta', {
            'color': '#475569'
        });
        force('.madp-inspector-section-title', {
            'color': '#0f2f43'
        });
        force('.madp-inspector-pill small', {
            'color': '#334155'
        });
        force('.madp-inspector-pill.is-warn b', {
            'color': '#b45309'
        });
        force('.madp-inspector-pill.is-missing b', {
            'color': '#166534'
        });
        force('.mnm-finding-row', {
            'background': '#ffffff',
            'color': '#111827'
        });
        force('.mnm-finding-label', {
            'color': '#111827'
        });
        force('.mnm-finding-range', {
            'color': '#526575'
        });
        force('.mnm-finding-icd', {
            'color': '#7c3f10',
            'background': '#fff6e8'
        });
        force('.mnm-badge-thap', {
            'background': '#3157d8',
            'color': '#ffffff'
        });
        force('.mnm-badge-cao', {
            'background': '#cf3c32',
            'color': '#ffffff'
        });
        force('.mnm-finding-number-thap', {
            'color': '#3157d8'
        });
        force('.mnm-finding-number-cao', {
            'color': '#cf3c32'
        });
    }

    function ensureUnifiedAutoV764Styles() {
        if (document.getElementById('medinet-auto-v764-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v764-style';
        style.textContent = `
            /* v7.64 — isolated report namespace: xai-* only */
            #medinet-auto-dock-panel.madp-long { width:min(520px,calc(100vw - 128px)) !important; }
            #medinet-auto-dock-panel.madp-long .madp-body { background:#fff !important; color:#111827 !important; padding:14px 16px 16px !important; }
            #medinet-auto-dock-panel .xai-report,
            #medinet-auto-dock-panel .xai-report * { box-sizing:border-box !important; }
            #medinet-auto-dock-panel .xai-report { display:grid !important; gap:14px !important; color:#111827 !important; background:#fff !important; }
            #medinet-auto-dock-panel .xai-patient { padding:0 0 12px !important; border-bottom:1px solid #dfe8ed !important; background:#fff !important; }
            #medinet-auto-dock-panel .xai-patient-name { color:#0f172a !important; font:900 17px/1.28 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-patient-meta { margin-top:5px !important; color:#475569 !important; font:700 12.8px/1.45 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-summary { display:grid !important; grid-template-columns:1fr 1fr !important; gap:10px !important; }
            #medinet-auto-dock-panel .xai-stat { min-height:66px !important; padding:10px 12px !important; border-radius:12px !important; border:1px solid !important; display:grid !important; gap:5px !important; align-content:center !important; }
            #medinet-auto-dock-panel .xai-stat span { font:800 12.5px/1.2 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-stat b { font:900 30px/1 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-stat-warn { background:#fff4e8 !important; border-color:#efc38e !important; }
            #medinet-auto-dock-panel .xai-stat-warn span { color:#7c3d08 !important; }
            #medinet-auto-dock-panel .xai-stat-warn b { color:#b45309 !important; }
            #medinet-auto-dock-panel .xai-stat-missing { background:#eef8f3 !important; border-color:#bddccf !important; }
            #medinet-auto-dock-panel .xai-stat-missing span { color:#22543d !important; }
            #medinet-auto-dock-panel .xai-stat-missing b { color:#166534 !important; }
            #medinet-auto-dock-panel .xai-section { display:grid !important; gap:9px !important; }
            #medinet-auto-dock-panel .xai-section-title { color:#173549 !important; font:900 14px/1.3 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-missing { padding:10px 11px !important; border:1px solid #ead7ba !important; background:#fffaf2 !important; border-radius:10px !important; }
            #medinet-auto-dock-panel .xai-chip-list { display:flex !important; flex-wrap:wrap !important; gap:6px !important; }
            #medinet-auto-dock-panel .xai-chip { color:#7c3d08 !important; background:#fff !important; border:1px solid #e8cda7 !important; border-radius:999px !important; padding:5px 9px !important; font:800 12px/1.2 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-findings { display:grid !important; gap:8px !important; }
            #medinet-auto-dock-panel .xai-finding { display:grid !important; grid-template-columns:60px minmax(0,1fr) !important; gap:12px !important; padding:12px !important; border:1px solid #dce7ec !important; background:#fff !important; border-radius:12px !important; }
            #medinet-auto-dock-panel .xai-badge { align-self:start !important; border-radius:8px !important; padding:6px 7px !important; color:#fff !important; text-align:center !important; font:900 11.5px/1.1 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-low .xai-badge { background:#3157d8 !important; }
            #medinet-auto-dock-panel .xai-high .xai-badge { background:#cf3c32 !important; }
            #medinet-auto-dock-panel .xai-finding-main { min-width:0 !important; display:grid !important; grid-template-columns:minmax(0,1fr) auto !important; grid-template-areas:'name value' 'ref ref' 'note note' !important; column-gap:12px !important; row-gap:4px !important; align-items:baseline !important; }
            #medinet-auto-dock-panel .xai-finding-name { grid-area:name !important; color:#111827 !important; font:900 14.5px/1.3 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-finding-value { grid-area:value !important; font:900 24px/1 'Segoe UI',Arial,sans-serif !important; white-space:nowrap !important; }
            #medinet-auto-dock-panel .xai-low .xai-finding-value { color:#3157d8 !important; }
            #medinet-auto-dock-panel .xai-high .xai-finding-value { color:#cf3c32 !important; }
            #medinet-auto-dock-panel .xai-finding-ref { grid-area:ref !important; color:#526575 !important; font:700 12.5px/1.35 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-finding-note { grid-area:note !important; margin-top:3px !important; padding:6px 8px !important; border-left:3px solid #f59e0b !important; border-radius:5px !important; background:#fff6e8 !important; color:#7c3f10 !important; font:600 12px/1.4 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-finding-note span { color:#8a4a19 !important; margin-right:6px !important; }
            #medinet-auto-dock-panel .xai-finding-note b { color:#7c2d12 !important; margin-right:7px !important; }
            #medinet-auto-dock-panel .xai-finding-note em { color:#7c3f10 !important; font-style:normal !important; }
            #medinet-auto-dock-panel .xai-ok { color:#166534 !important; background:#effaf4 !important; border:1px solid #c7e5d5 !important; border-radius:9px !important; padding:9px 10px !important; font:800 13px/1.4 'Segoe UI',Arial,sans-serif !important; }
            #medinet-auto-dock-panel .xai-save { color:#0c4a6e !important; background:#eef9fc !important; border:1px solid #c9e7ef !important; border-left:3px solid #0891b2 !important; border-radius:8px !important; padding:9px 10px !important; font:800 12.8px/1.45 'Segoe UI',Arial,sans-serif !important; }
            @media(max-width:720px){
                #medinet-auto-dock-panel.madp-long { width:min(370px,calc(100vw - 90px)) !important; }
                #medinet-auto-dock-panel .xai-summary { grid-template-columns:1fr !important; }
                #medinet-auto-dock-panel .xai-finding-main { grid-template-columns:1fr !important; grid-template-areas:'name' 'value' 'ref' 'note' !important; }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV765Styles() {
        if (document.getElementById('medinet-auto-v765-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v765-style';
        style.textContent = `
            /* =====================================================
               v7.65 — WIDE REPORT PANEL
               Long CLS reports use the viewport instead of squeezing
               into the gap left of the AUTO reactor.
               ===================================================== */
            #medinet-auto-dock-panel.madp-long {
                right: 18px !important;
                bottom: 98px !important;
                width: min(600px, calc(100vw - 36px)) !important;
                max-width: none !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-body {
                max-height: min(64vh, 560px) !important;
                padding: 15px 17px 17px !important;
            }
            #medinet-auto-dock-panel.madp-long .madp-tail {
                right: 34px !important;
                bottom: -6px !important;
            }
            #medinet-auto-dock-panel .xai-report {
                gap: 12px !important;
            }
            #medinet-auto-dock-panel .xai-patient {
                padding-bottom: 10px !important;
            }
            #medinet-auto-dock-panel .xai-summary {
                grid-template-columns: repeat(2,minmax(0,1fr)) !important;
            }
            #medinet-auto-dock-panel .xai-stat {
                min-height: 58px !important;
                padding: 9px 12px !important;
            }
            #medinet-auto-dock-panel .xai-stat b {
                font-size: 27px !important;
            }
            #medinet-auto-dock-panel .xai-finding {
                grid-template-columns: 62px minmax(0,1fr) !important;
                padding: 11px 12px !important;
            }
            #medinet-auto-dock-panel .xai-finding-main {
                grid-template-columns: minmax(145px,1fr) auto !important;
                grid-template-areas:
                    'name value'
                    'ref value'
                    'note note' !important;
                align-items: center !important;
            }
            #medinet-auto-dock-panel .xai-finding-value {
                align-self:center !important;
                font-size:25px !important;
            }
            #medinet-auto-dock-panel .xai-finding-note {
                margin-top:4px !important;
            }
            @media (max-width: 640px) {
                #medinet-auto-dock-panel.madp-long {
                    left: 12px !important;
                    right: 12px !important;
                    bottom: 92px !important;
                    width: auto !important;
                    max-width: none !important;
                }
                #medinet-auto-dock-panel.madp-long .madp-body {
                    max-height: min(62vh, 520px) !important;
                    padding: 13px 14px 15px !important;
                }
                #medinet-auto-dock-panel.madp-long .madp-tail {
                    right: 28px !important;
                }
                #medinet-auto-dock-panel .xai-summary {
                    grid-template-columns: repeat(2,minmax(0,1fr)) !important;
                }
                #medinet-auto-dock-panel .xai-finding-main {
                    grid-template-columns: minmax(0,1fr) auto !important;
                    grid-template-areas:
                        'name value'
                        'ref ref'
                        'note note' !important;
                }
                #medinet-auto-dock-panel .xai-finding-note {
                    font-size: 11.8px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function hardenXaiReport(panel) {
        if (!panel || !panel.querySelector('.xai-report')) return;
        const set = (sel, prop, val) => panel.querySelectorAll(sel).forEach(el => el.style.setProperty(prop,val,'important'));
        set('.xai-report','color','#111827');
        set('.xai-patient-name','color','#0f172a');
        set('.xai-patient-meta','color','#475569');
        set('.xai-section-title','color','#173549');
        set('.xai-stat-warn span','color','#7c3d08');
        set('.xai-stat-warn b','color','#b45309');
        set('.xai-stat-missing span','color','#22543d');
        set('.xai-stat-missing b','color','#166534');
        set('.xai-low .xai-badge','background','#3157d8');
        set('.xai-high .xai-badge','background','#cf3c32');
        set('.xai-badge','color','#ffffff');
        set('.xai-finding-name','color','#111827');
        set('.xai-low .xai-finding-value','color','#3157d8');
        set('.xai-high .xai-finding-value','color','#cf3c32');
        set('.xai-finding-ref','color','#526575');
        set('.xai-finding-note','color','#7c3f10');
    }


    function measureNaturalInlineWidth(el) {
        if (!el || !el.isConnected) return 0;
        const cs = getComputedStyle(el);
        const probe = document.createElement('span');
        probe.textContent = el.textContent || '';
        Object.assign(probe.style, {
            position: 'fixed',
            left: '-10000px',
            top: '-10000px',
            display: 'inline-block',
            width: 'max-content',
            maxWidth: 'none',
            minWidth: '0',
            whiteSpace: 'nowrap',
            visibility: 'hidden',
            pointerEvents: 'none',
            fontFamily: cs.fontFamily,
            fontSize: cs.fontSize,
            fontWeight: cs.fontWeight,
            fontStyle: cs.fontStyle,
            letterSpacing: cs.letterSpacing,
            lineHeight: cs.lineHeight
        });
        document.body.appendChild(probe);
        const width = Math.ceil(probe.getBoundingClientRect().width);
        probe.remove();
        return width;
    }

    function getAutoDockWidthCandidates(panel) {
        if (!panel) return [];
        const selectors = [
            '.madp-title',
            '.xai-patient-name',
            '.xai-patient-meta',
            '.xai-stat span',
            '.xai-section-title',
            '.xai-finding-name',
            '.xai-finding-ref',
            '.xai-icd-label',
            '.xai-icd-value',
            '.xai-chip',
            '.xai-save'
        ];
        const seen = new Set();
        const result = [];
        selectors.forEach(selector => {
            panel.querySelectorAll(selector).forEach(el => {
                if (!el || seen.has(el)) return;
                seen.add(el);
                result.push(el);
            });
        });
        return result;
    }

    function setAutoDockCandidateWrapping(panel, nowrap) {
        getAutoDockWidthCandidates(panel).forEach(el => {
            el.style.setProperty('white-space', nowrap ? 'nowrap' : 'normal', 'important');
            el.style.setProperty('word-break', 'normal', 'important');
            el.style.setProperty('overflow-wrap', nowrap ? 'normal' : 'break-word', 'important');
            el.style.setProperty('max-width', '100%', 'important');
            el.style.setProperty('min-width', '0', 'important');
            el.querySelectorAll('b, em, span').forEach(child => {
                if (child.classList.contains('xai-icd-label')) return;
                child.style.setProperty('white-space', nowrap ? 'nowrap' : 'normal', 'important');
                child.style.setProperty('word-break', 'normal', 'important');
                child.style.setProperty('overflow-wrap', nowrap ? 'normal' : 'break-word', 'important');
            });
        });
    }

    function measureLongestAutoDockLine(panel) {
        let longest = 0;
        let longestEl = null;
        getAutoDockWidthCandidates(panel).forEach(el => {
            const natural = measureNaturalInlineWidth(el);
            if (natural > longest) {
                longest = natural;
                longestEl = el;
            }
        });
        return { width: longest, element: longestEl };
    }

    function autoDockContentFitsAtWidth(panel, width) {
        if (!panel || !panel.isConnected) return false;
        panel.style.setProperty('width', `${Math.round(width)}px`, 'important');
        panel.style.setProperty('max-width', `${Math.round(width)}px`, 'important');
        setAutoDockCandidateWrapping(panel, true);
        void panel.offsetWidth;

        const tolerance = 2;
        const candidatesFit = getAutoDockWidthCandidates(panel).every(el => {
            const natural = measureNaturalInlineWidth(el);
            const available = Math.floor(el.getBoundingClientRect().width);
            return !natural || natural <= available + tolerance;
        });

        if (!candidatesFit) return false;

        const boxes = panel.querySelectorAll(
            '.madp-body,.xai-report,.xai-patient,.xai-summary,.xai-section,.xai-findings,.xai-finding,.xai-finding-main,.xai-finding-note'
        );
        return Array.from(boxes).every(el => el.scrollWidth <= el.clientWidth + tolerance);
    }

    function measureContentDrivenPanelWidth(panel, viewportWidth) {
        if (!panel) return 0;

        const safeMax = Math.max(300, Math.floor(viewportWidth - 24));
        const safeMin = Math.min(safeMax, 360);

        // Measure every meaningful line first. This is intentionally global:
        // the longest line anywhere in the bubble is allowed to drive width.
        setAutoDockCandidateWrapping(panel, true);
        void panel.offsetWidth;
        const longest = measureLongestAutoDockLine(panel);
        panel.dataset.longestNaturalLine = String(Math.ceil(longest.width || 0));

        // First ask the real DOM whether even the maximum safe width can keep
        // all candidate lines on one row. If not, wrapping is unavoidable.
        if (!autoDockContentFitsAtWidth(panel, safeMax)) {
            setAutoDockCandidateWrapping(panel, false);
            return safeMax;
        }

        // Binary-search the SMALLEST panel width that keeps every candidate
        // line unwrapped. This automatically includes badge/grid/padding gaps
        // because the fit test uses the final rendered DOM, not a guessed formula.
        let low = safeMin;
        let high = safeMax;
        while (high - low > 3) {
            const mid = Math.floor((low + high) / 2);
            if (autoDockContentFitsAtWidth(panel, mid)) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }

        let chosen = high;
        while (chosen < safeMax && !autoDockContentFitsAtWidth(panel, chosen)) {
            chosen += 1;
        }

        // Small visual breathing room after the exact fit point.
        chosen = Math.min(safeMax, chosen + 10);
        autoDockContentFitsAtWidth(panel, chosen);
        return chosen;
    }

    function applySafeIcdWrapping(panel, preferSingleLine = false) {
        if (!panel) return;
        // Kept for compatibility with earlier call sites. Wrapping is now
        // controlled for ALL candidate lines, not just ICD.
        setAutoDockCandidateWrapping(panel, !!preferSingleLine);
    }

    function layoutAutoDockPanel(panel) {
        if (!panel || !panel.isConnected) return;
        if (panel.__autoLayoutBusy) return;
        panel.__autoLayoutBusy = true;

        try {
            const body = panel.querySelector('.madp-body');
            const head = panel.querySelector('.madp-head');
            if (!body || !head) return;

            const vv = window.visualViewport;
            const vw = Math.max(300, (vv && vv.width) || window.innerWidth || document.documentElement.clientWidth || 0);
            const vh = Math.max(300, (vv && vv.height) || window.innerHeight || document.documentElement.clientHeight || 0);
            const isLong = panel.classList.contains('madp-long');
        const isXaiReport = !!panel.querySelector('.xai-report');
        panel.dataset.layoutMode = isXaiReport ? 'xai-content-driven' : (isLong ? 'long' : 'compact');
            const sideGap = vw < 640 ? 10 : 12;
            const bottomGap = isLong ? (vw < 640 ? 88 : 96) : (vw < 640 ? 78 : 84);
            const safeMax = Math.max(300, vw - sideGap * 2);

            panel.style.setProperty('display', 'flex', 'important');
            panel.style.setProperty('flex-direction', 'column', 'important');
            panel.style.setProperty('box-sizing', 'border-box', 'important');
            panel.style.setProperty('overflow', 'hidden', 'important');

            body.style.setProperty('max-height', 'none', 'important');
            body.style.setProperty('height', 'auto', 'important');
            body.style.setProperty('overflow', 'visible', 'important');

            let width;
            if (isLong || isXaiReport) {
                // Start at maximum available width so measurement is never
                // polluted by text that was already wrapped in a narrow panel.
                panel.style.setProperty('width', `${safeMax}px`, 'important');
                panel.style.setProperty('max-width', `${safeMax}px`, 'important');
                setAutoDockCandidateWrapping(panel, true);
                void panel.offsetWidth;
                width = measureContentDrivenPanelWidth(panel, vw);
            } else {
                setAutoDockCandidateWrapping(panel, false);
                panel.style.setProperty('width', `${Math.min(350, safeMax)}px`, 'important');
                panel.style.setProperty('max-width', `${safeMax}px`, 'important');
                void panel.offsetWidth;
                width = Math.min(Math.max(300, panel.scrollWidth + 8), safeMax);
            }

            width = Math.max(Math.min(width, safeMax), Math.min(320, safeMax));
            panel.style.setProperty('width', `${Math.round(width)}px`, 'important');
            panel.style.setProperty('max-width', `${Math.round(width)}px`, 'important');
            void panel.offsetWidth;

            // If the chosen width keeps all lines intact, keep nowrap. If the
            // viewport itself is too narrow, allow safe wrapping everywhere.
            const contentDriven = isLong || isXaiReport;
            const allFit = contentDriven ? autoDockContentFitsAtWidth(panel, width) : true;
            setAutoDockCandidateWrapping(panel, contentDriven && allFit);
            void panel.offsetWidth;

            const left = Math.max(sideGap, Math.round(vw - width - sideGap));
            panel.style.setProperty('left', `${left}px`, 'important');
            panel.style.setProperty('right', 'auto', 'important');
            panel.style.setProperty('bottom', `${bottomGap}px`, 'important');

            // Height is measured only AFTER final width and wrapping state.
            body.style.setProperty('max-height', 'none', 'important');
            body.style.setProperty('height', 'auto', 'important');
            body.style.setProperty('overflow-y', 'visible', 'important');
            body.style.setProperty('overflow-x', 'hidden', 'important');
            void body.offsetHeight;

            const naturalBodyHeight = Math.ceil(body.scrollHeight);
            const headHeight = Math.ceil(head.getBoundingClientRect().height);
            const availablePanelHeight = Math.max(210, vh - bottomGap - 14);
            const availableBodyHeight = Math.max(140, availablePanelHeight - headHeight);
            const fitsHeight = naturalBodyHeight <= availableBodyHeight;

            panel.style.setProperty('height', 'auto', 'important');
            panel.style.setProperty('max-height', `${availablePanelHeight}px`, 'important');
            body.style.setProperty('flex', '0 1 auto', 'important');
            body.style.setProperty('min-height', '0', 'important');
            body.style.setProperty('height', fitsHeight ? 'auto' : `${availableBodyHeight}px`, 'important');
            body.style.setProperty('max-height', fitsHeight ? 'none' : `${availableBodyHeight}px`, 'important');
            body.style.setProperty('overflow-y', fitsHeight ? 'visible' : 'auto', 'important');

            const tail = panel.querySelector('.madp-tail');
            if (tail) {
                tail.style.setProperty('right', '28px', 'important');
                tail.style.setProperty('bottom', '-6px', 'important');
            }
        } finally {
            panel.__autoLayoutBusy = false;
        }
    }

    function installAutoDockContentResizeObserver(panel) {
        if (!panel || panel.__contentResizeObserverInstalled || typeof ResizeObserver !== 'function') return;
        panel.__contentResizeObserverInstalled = true;
        let timer = 0;
        const ro = new ResizeObserver(() => {
            clearTimeout(timer);
            timer = setTimeout(() => {
                if (panel.isConnected) layoutAutoDockPanel(panel);
            }, 40);
        });
        const body = panel.querySelector('.madp-body');
        if (body) ro.observe(body);
        panel.__contentResizeObserver = ro;
    }


    function ensureUnifiedAutoV768Styles() {
        if (document.getElementById('medinet-auto-v768-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v768-style';
        style.textContent = `
            /* =====================================================
               v7.68 — COMPACT WORDING + TIGHTER LAYOUT
               ===================================================== */
            #medinet-auto-dock-panel.madp-long .madp-body {
                padding: 12px 14px 14px !important;
            }
            #medinet-auto-dock-panel .xai-report {
                gap: 10px !important;
            }
            #medinet-auto-dock-panel .xai-patient {
                padding-bottom: 8px !important;
            }
            #medinet-auto-dock-panel .xai-patient-name {
                font-size: 16px !important;
                line-height: 1.22 !important;
            }
            #medinet-auto-dock-panel .xai-patient-meta {
                margin-top: 3px !important;
                font-size: 12.5px !important;
                line-height: 1.35 !important;
            }
            #medinet-auto-dock-panel .xai-summary {
                gap: 8px !important;
            }
            #medinet-auto-dock-panel .xai-stat {
                min-height: 54px !important;
                padding: 8px 10px !important;
                gap: 3px !important;
            }
            #medinet-auto-dock-panel .xai-stat span {
                font-size: 12px !important;
                line-height: 1.15 !important;
            }
            #medinet-auto-dock-panel .xai-stat b {
                font-size: 26px !important;
            }
            #medinet-auto-dock-panel .xai-section {
                gap: 7px !important;
            }
            #medinet-auto-dock-panel .xai-section-title {
                font-size: 13px !important;
                line-height: 1.2 !important;
            }
            #medinet-auto-dock-panel .xai-findings {
                gap: 7px !important;
            }
            #medinet-auto-dock-panel .xai-finding {
                gap: 10px !important;
                padding: 9px 10px !important;
                border-radius: 11px !important;
            }
            #medinet-auto-dock-panel .xai-badge {
                padding: 5px 7px !important;
                font-size: 11px !important;
            }
            #medinet-auto-dock-panel .xai-finding-main {
                grid-template-areas: 'name value' 'ref value' 'note note' !important;
                row-gap: 3px !important;
                column-gap: 10px !important;
                align-items: center !important;
            }
            #medinet-auto-dock-panel .xai-finding-name {
                font-size: 13.5px !important;
                line-height: 1.22 !important;
            }
            #medinet-auto-dock-panel .xai-finding-value {
                font-size: 22px !important;
                line-height: 1 !important;
                align-self: center !important;
            }
            #medinet-auto-dock-panel .xai-finding-ref {
                font-size: 12px !important;
                line-height: 1.25 !important;
            }
            #medinet-auto-dock-panel .xai-finding-note {
                margin-top: 2px !important;
                padding: 5px 7px !important;
                font-size: 11.5px !important;
                line-height: 1.32 !important;
            }
            #medinet-auto-dock-panel .xai-finding-note span {
                margin-right: 5px !important;
                font-weight: 800 !important;
            }
            #medinet-auto-dock-panel .xai-finding-note b {
                white-space: nowrap !important;
            }
            #medinet-auto-dock-panel .xai-finding-note b {
                margin-right: 4px !important;
            }
            #medinet-auto-dock-panel .xai-finding-note em {
                font-style: normal !important;
            }
            #medinet-auto-dock-panel .xai-save {
                padding: 8px 10px !important;
                font-size: 12.2px !important;
                line-height: 1.35 !important;
            }
            @media (max-width: 640px) {
                #medinet-auto-dock-panel .xai-finding-main {
                    grid-template-areas: 'name value' 'ref ref' 'note note' !important;
                }
                #medinet-auto-dock-panel .xai-finding-value {
                    font-size: 21px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV770Styles() {
        if (document.getElementById('medinet-auto-v770-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v770-style';
        style.textContent = `
            /* =====================================================
               v7.70 — ICD TWO-LINE LAYOUT + TRUE CONTENT RESIZE
               ===================================================== */
            #medinet-auto-dock-panel .xai-finding-note {
                display:grid !important;
                grid-template-columns:1fr !important;
                gap:2px !important;
                padding:6px 8px !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-label {
                display:block !important;
                margin:0 !important;
                color:#8a4a19 !important;
                font:800 11.5px/1.25 'Segoe UI',Arial,sans-serif !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value {
                display:block !important;
                min-width:0 !important;
                color:#7c3f10 !important;
                font:600 12px/1.35 'Segoe UI',Arial,sans-serif !important;
                overflow-wrap:anywhere !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value b {
                color:#7c2d12 !important;
                font-weight:900 !important;
                margin:0 !important;
                white-space:nowrap !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value em {
                color:#7c3f10 !important;
                font-style:normal !important;
                margin:0 !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV771Styles() {
        if (document.getElementById('medinet-auto-v771-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v771-style';
        style.textContent = `
            /* =====================================================
               v7.71 — WIDTH AUTO-SIZE BY LONGEST ICD LINE
               ===================================================== */
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value {
                white-space: nowrap !important;
                overflow-wrap: normal !important;
                word-break: normal !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value em {
                white-space: nowrap !important;
            }
            @media (max-width: 639px) {
                #medinet-auto-dock-panel .xai-finding-note .xai-icd-value,
                #medinet-auto-dock-panel .xai-finding-note .xai-icd-value em {
                    white-space: normal !important;
                    overflow-wrap: anywhere !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV772Styles() {
        if (document.getElementById('medinet-auto-v772-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v772-style';
        style.textContent = `
            /* =====================================================
               v7.72 — SAFE RESPONSIVE REPORT
               Expand first; wrap only when viewport really cannot fit.
               Never allow text to escape a card.
               ===================================================== */
            #medinet-auto-dock-panel,
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .xai-report,
            #medinet-auto-dock-panel .xai-finding,
            #medinet-auto-dock-panel .xai-finding-main,
            #medinet-auto-dock-panel .xai-finding-note,
            #medinet-auto-dock-panel .xai-icd-value {
                box-sizing:border-box !important;
            }
            #medinet-auto-dock-panel .xai-finding,
            #medinet-auto-dock-panel .xai-finding-main,
            #medinet-auto-dock-panel .xai-finding-note {
                min-width:0 !important;
                max-width:100% !important;
            }
            #medinet-auto-dock-panel .xai-finding-note {
                width:100% !important;
                overflow:hidden !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value {
                display:block !important;
                width:100% !important;
                max-width:100% !important;
                min-width:0 !important;
                white-space:nowrap !important;
                overflow:visible !important;
                overflow-wrap:normal !important;
                word-break:normal !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value.xai-wrap {
                white-space:normal !important;
                overflow:visible !important;
                overflow-wrap:break-word !important;
                word-break:normal !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value.xai-wrap em {
                white-space:normal !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV773Styles() {
        if (document.getElementById('medinet-auto-v773-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v773-style';
        style.textContent = `
            /* =====================================================
               v7.73 — NEVER CROP REPORT TEXT
               Grow when possible; wrap safely when necessary.
               ===================================================== */
            #medinet-auto-dock-panel .xai-finding,
            #medinet-auto-dock-panel .xai-finding-main,
            #medinet-auto-dock-panel .xai-finding-note,
            #medinet-auto-dock-panel .xai-icd-value {
                min-width:0 !important;
                max-width:100% !important;
                box-sizing:border-box !important;
            }
            #medinet-auto-dock-panel .xai-finding-note {
                width:100% !important;
                overflow:visible !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value,
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value.xai-wrap,
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value em,
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value.xai-wrap em {
                display:block !important;
                width:auto !important;
                max-width:100% !important;
                white-space:normal !important;
                overflow:visible !important;
                overflow-wrap:break-word !important;
                word-break:normal !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value b {
                display:inline !important;
                white-space:nowrap !important;
            }
            #medinet-auto-dock-panel .xai-finding-note .xai-icd-value em {
                display:inline !important;
            }
        `;
        document.head.appendChild(style);
    }

    let medinetAutoDockResizeBound = false;

    function ensureAutoDockResizeWatcher() {
        if (medinetAutoDockResizeBound) return;
        medinetAutoDockResizeBound = true;
        window.addEventListener('resize', () => {
            const panel = document.getElementById('medinet-auto-dock-panel');
            if (panel) {
                requestAnimationFrame(() => layoutAutoDockPanel(panel));
            }
        }, { passive: true });
    }
    function ensureUnifiedAutoV774Styles() {
        if (document.getElementById('medinet-auto-v774-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v774-style';
        style.textContent = `
            /* v7.74 — true content-driven bubble sizing */
            #medinet-auto-dock-panel,
            #medinet-auto-dock-panel .madp-body,
            #medinet-auto-dock-panel .xai-report,
            #medinet-auto-dock-panel .xai-finding,
            #medinet-auto-dock-panel .xai-finding-main,
            #medinet-auto-dock-panel .xai-finding-note,
            #medinet-auto-dock-panel .xai-icd-value {
                box-sizing:border-box !important;
                min-width:0 !important;
            }
            #medinet-auto-dock-panel .xai-finding-note,
            #medinet-auto-dock-panel .xai-icd-value {
                max-width:100% !important;
                overflow:visible !important;
                text-overflow:clip !important;
            }
            #medinet-auto-dock-panel .xai-icd-value,
            #medinet-auto-dock-panel .xai-icd-value em {
                white-space:normal !important;
                word-break:normal !important;
                overflow-wrap:normal !important;
            }
            #medinet-auto-dock-panel .madp-body {
                min-height:0 !important;
                overflow-x:hidden !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV775Styles() {
        if (document.getElementById('medinet-auto-v775-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v775-style';
        style.textContent = `
            /* v7.75 — exact content geometry for ICD line */
            #medinet-auto-dock-panel .xai-finding-note {
                display:grid !important;
                grid-template-columns:minmax(0,1fr) !important;
                gap:3px !important;
                width:100% !important;
                min-width:0 !important;
                max-width:100% !important;
            }
            #medinet-auto-dock-panel .xai-icd-label {
                display:block !important;
                width:100% !important;
                margin:0 !important;
                line-height:1.2 !important;
            }
            #medinet-auto-dock-panel .xai-icd-value {
                display:block !important;
                width:100% !important;
                min-width:0 !important;
                max-width:100% !important;
                margin:0 !important;
                line-height:1.3 !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV776Styles() {
        if (document.getElementById('medinet-auto-v776-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v776-style';
        style.textContent = `
            /* v7.76 — JS decides width/wrapping from actual rendered content */
            #medinet-auto-dock-panel .xai-icd-value,
            #medinet-auto-dock-panel .xai-icd-value em,
            #medinet-auto-dock-panel .xai-finding-name,
            #medinet-auto-dock-panel .xai-finding-ref,
            #medinet-auto-dock-panel .xai-patient-name,
            #medinet-auto-dock-panel .xai-patient-meta,
            #medinet-auto-dock-panel .xai-section-title,
            #medinet-auto-dock-panel .xai-chip,
            #medinet-auto-dock-panel .xai-save {
                word-break:normal !important;
                text-overflow:clip !important;
                overflow:visible !important;
            }
        `;
        document.head.appendChild(style);
    }

    function ensureUnifiedAutoV767Styles() {
        if (document.getElementById('medinet-auto-v767-style')) return;
        const style = document.createElement('style');
        style.id = 'medinet-auto-v767-style';
        style.textContent = `
            /* =====================================================
               v7.67 — CLOSEABLE BUBBLE
               ===================================================== */
            #medinet-auto-dock-panel .madp-head {
                display:flex !important;
                align-items:center !important;
                gap:8px !important;
                padding-right:8px !important;
            }
            #medinet-auto-dock-panel .madp-title {
                flex:1 1 auto !important;
                min-width:0 !important;
            }
            #medinet-auto-dock-panel .madp-close {
                flex:0 0 auto !important;
                width:32px !important;
                height:32px !important;
                display:flex !important;
                align-items:center !important;
                justify-content:center !important;
                padding:0 !important;
                margin-left:auto !important;
                border:1px solid #cbd5e1 !important;
                border-radius:9px !important;
                background:#ffffff !important;
                color:#334155 !important;
                font:900 20px/1 'Segoe UI',Arial,sans-serif !important;
                cursor:pointer !important;
                box-shadow:0 1px 2px rgba(15,23,42,.06) !important;
                transition:background .12s ease,border-color .12s ease,transform .12s ease !important;
            }
            #medinet-auto-dock-panel .madp-close:hover {
                background:#f1f5f9 !important;
                border-color:#94a3b8 !important;
            }
            #medinet-auto-dock-panel .madp-close:active {
                transform:scale(.95) !important;
            }
            #medinet-auto-dock-panel.madp-warn .madp-close {
                background:#fffaf4 !important;
                border-color:#edc79b !important;
                color:#92400e !important;
            }
            #medinet-auto-dock-panel.madp-error .madp-close {
                background:#fff5f5 !important;
                border-color:#fecaca !important;
                color:#b91c1c !important;
            }
            @media(max-width:640px){
                #medinet-auto-dock-panel .madp-close {
                    width:34px !important;
                    height:34px !important;
                    font-size:21px !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    let medinetAutoDockEscapeBound = false;

    function ensureAutoDockEscapeWatcher() {
        if (medinetAutoDockEscapeBound) return;
        medinetAutoDockEscapeBound = true;
        document.addEventListener('keydown', (event) => {
            if (event.key !== 'Escape') return;
            const panel = document.getElementById('medinet-auto-dock-panel');
            if (!panel) return;
            event.preventDefault();
            closeAutoDockPanel();
        });
    }

    let medinetRandomPlasmaTimer = null;
    let medinetRandomPlasmaHideTimers = [];

    function ensureLightningSvg(button) {
        if (!button) return null;
        let svg = button.querySelector('.mau-lightning-svg');
        if (svg) return svg;
        const ns = 'http://www.w3.org/2000/svg';
        svg = document.createElementNS(ns,'svg');
        svg.setAttribute('class','mau-lightning-svg');
        svg.setAttribute('viewBox','0 0 160 160');
        svg.setAttribute('aria-hidden','true');
        const main = document.createElementNS(ns,'polyline');
        main.setAttribute('class','mau-lightning-main');
        svg.appendChild(main);
        for (let i=0;i<7;i++) {
            const branch = document.createElementNS(ns,'polyline');
            branch.setAttribute('class','mau-lightning-branch');
            branch.dataset.branchIndex = String(i);
            svg.appendChild(branch);
        }
        button.appendChild(svg);
        return svg;
    }

    function stopRandomPlasmaBursts() {
        if (medinetRandomPlasmaTimer) {
            clearTimeout(medinetRandomPlasmaTimer);
            medinetRandomPlasmaTimer = null;
        }
        medinetRandomPlasmaHideTimers.forEach(t => clearTimeout(t));
        medinetRandomPlasmaHideTimers = [];
        const btn = document.getElementById('medinet-auto-unified');
        if (!btn) return;
        const svg = ensureLightningSvg(btn);
        if (!svg) return;
        svg.querySelectorAll('.mau-lightning-main,.mau-lightning-branch').forEach(el => {
            el.style.opacity = '0';
        });
    }

    function makeLightningPoints(angleDeg, length, wobble, segments) {
        const cx = 80, cy = 80;
        const a = angleDeg * Math.PI / 180;
        const startR = 37;
        const sx = cx + Math.cos(a) * startR;
        const sy = cy + Math.sin(a) * startR;
        const nx = -Math.sin(a), ny = Math.cos(a);
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const baseX = sx + Math.cos(a) * length * t;
            const baseY = sy + Math.sin(a) * length * t;
            const falloff = Math.sin(Math.PI * t);
            const jitter = i === 0 || i === segments ? 0 : ((Math.random() * 2 - 1) * wobble * (.45 + .55 * falloff));
            pts.push([baseX + nx * jitter, baseY + ny * jitter]);
        }
        return pts;
    }

    function pointsToString(points) {
        return points.map(([x,y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    }

    function fireLightningFlash(button) {
        if (!button || !button.isConnected || !button.classList.contains('mau-running')) return;
        const svg = ensureLightningSvg(button);
        if (!svg) return;
        const main = svg.querySelector('.mau-lightning-main');
        const branches = Array.from(svg.querySelectorAll('.mau-lightning-branch'));

        const angle = Math.random() * 360;
        const length = 62 + Math.random() * 42;
        const segments = 12 + Math.floor(Math.random()*5);
        const mainPts = makeLightningPoints(angle,length,8.8,segments);
        main.setAttribute('points',pointsToString(mainPts));

        branches.forEach(b=>{ b.style.opacity='0'; b.setAttribute('points',''); });
        const branchCount = 4 + Math.floor(Math.random()*3); // 4–6 branches
        for (let bi=0; bi<branchCount; bi++) {
            const branch = branches[bi];
            if (!branch) continue;
            const minIdx = Math.max(2, Math.floor(segments*.25));
            const maxIdx = Math.min(segments-2, Math.floor(segments*.82));
            const branchStartIndex = minIdx + Math.floor(Math.random()*Math.max(1,maxIdx-minIdx+1));
            const [bx,by] = mainPts[branchStartIndex];
            const sign = Math.random()<.5 ? -1 : 1;
            const branchAngle = angle + sign*(24 + Math.random()*48);
            const ba = branchAngle*Math.PI/180;
            const blen = 20 + Math.random()*32;
            const bseg = 4 + Math.floor(Math.random()*3);
            const bnx=-Math.sin(ba), bny=Math.cos(ba);
            const bpts=[[bx,by]];
            for(let i=1;i<=bseg;i++){
                const t=i/bseg;
                const j=(Math.random()*2-1)*(3.4+2.2*Math.sin(Math.PI*t));
                bpts.push([
                    bx+Math.cos(ba)*blen*t+bnx*j,
                    by+Math.sin(ba)*blen*t+bny*j
                ]);
            }
            branch.setAttribute('points',pointsToString(bpts));
            branch.style.opacity=String(.58+Math.random()*.34);
        }

        main.style.opacity='1';
        const visibleMs = 260 + Math.floor(Math.random()*150);
        const hide1=setTimeout(()=>{
            if (!main.isConnected) return;
            main.style.opacity='0';
            branches.forEach(b=>b.style.opacity='0');
        },visibleMs);
        medinetRandomPlasmaHideTimers.push(hide1);

        // Electrical after-flash: same direction, new jagged path, slightly dimmer.
        if (Math.random() < .72) {
            const reflash=setTimeout(()=>{
                if (!button.classList.contains('mau-running') || !main.isConnected) return;
                const pts2=makeLightningPoints(angle+(Math.random()*8-4),length*(.92+Math.random()*.16),6.4,segments);
                main.setAttribute('points',pointsToString(pts2));
                main.style.opacity='.82';
                branches.forEach((b,i)=>{
                    if (i<branchCount) b.style.opacity=String(.35+Math.random()*.35);
                });
                const hide2=setTimeout(()=>{
                    if (main.isConnected) main.style.opacity='0';
                    branches.forEach(b=>{ if(b.isConnected) b.style.opacity='0'; });
                },130+Math.floor(Math.random()*95));
                medinetRandomPlasmaHideTimers.push(hide2);
            },120+Math.floor(Math.random()*110));
            medinetRandomPlasmaHideTimers.push(reflash);
        }
    }

    function randomPlasmaBurstTick(button) {
        if (!button || !button.isConnected || !button.classList.contains('mau-running')) {
            stopRandomPlasmaBursts();
            return;
        }
        // One electrical strike at a time; occasional quick second strike.
        fireLightningFlash(button);
        medinetRandomPlasmaTimer=setTimeout(
            ()=>randomPlasmaBurstTick(button),
            280+Math.floor(Math.random()*720)
        );
    }

    function installRandomPlasmaController(button) {
        if (!button || button.__randomPlasmaInstalled) return;
        button.__randomPlasmaInstalled=true;
        ensureLightningSvg(button);
        const sync=()=>{
            stopRandomPlasmaBursts();
            if (button.classList.contains('mau-running')) {
                medinetRandomPlasmaTimer=setTimeout(()=>randomPlasmaBurstTick(button),80+Math.floor(Math.random()*180));
            }
        };
        const observer=new MutationObserver(sync);
        observer.observe(button,{attributes:true,attributeFilter:['class']});
        sync();
    }

    function closeAutoDockPanel() {
        const old = document.getElementById('medinet-auto-dock-panel');
        if (old) {
            if (old.__contentResizeObserver) {
                try { old.__contentResizeObserver.disconnect(); } catch (e) {}
            }
            old.remove();
        }
    }

    function showAutoDockPanel(title, bodyHtml, type = 'info', autoCloseMs = 0) {
        ensureUnifiedAutoStyles();
        ensureUnifiedAutoV742Styles();
        ensureUnifiedAutoV744Styles();
        ensureUnifiedAutoV745Styles();
        ensureUnifiedAutoV746Styles();
        ensureUnifiedAutoV747Styles();
        ensureUnifiedAutoV748Styles();
        ensureUnifiedAutoV749Styles();
        ensureUnifiedAutoV750Styles();
        ensureUnifiedAutoV751Styles();
        ensureUnifiedAutoV752Styles();
        ensureUnifiedAutoV753Styles();
        ensureUnifiedAutoV754Styles();
        ensureUnifiedAutoV755Styles();
        ensureUnifiedAutoV756Styles();
        ensureUnifiedAutoV757Styles();
        ensureUnifiedAutoV758Styles();
        ensureUnifiedAutoSpeechBubbleStyles();
        ensureUnifiedAutoV759Styles();
        ensureUnifiedAutoV761Styles();
        ensureUnifiedAutoV762Styles();
        ensureUnifiedAutoV763Styles();
        ensureUnifiedAutoV764Styles();
        ensureUnifiedAutoV765Styles();
        ensureUnifiedAutoV767Styles();
        ensureUnifiedAutoV768Styles();
        ensureUnifiedAutoV770Styles();
        ensureUnifiedAutoV771Styles();
        ensureUnifiedAutoV772Styles();
        ensureUnifiedAutoV773Styles();
        ensureUnifiedAutoV774Styles();
        ensureUnifiedAutoV775Styles();
        ensureUnifiedAutoV776Styles();
        promoteFinalAutoStyles();
        ensureAutoDockContextWatcher();
        ensureAutoDockResizeWatcher();
        ensureAutoDockEscapeWatcher();
        closeAutoDockPanel();

        const panel = document.createElement('div');
        panel.id = 'medinet-auto-dock-panel';
        panel.className = `madp-${type}`;
        if (isLongAutoDockContent(bodyHtml)) {
            panel.classList.add('madp-long');
        }
        panel.dataset.contextKey = getAutoUiContextKey();
        panel.innerHTML =
            '<div class="madp-head">' +
                '<span class="madp-pulse"></span>' +
                '<div class="madp-title"></div>' +
                '<button type="button" class="madp-close" aria-label="Đóng thông báo" title="Đóng">×</button>' +
            '</div>' +
            '<div class="madp-body"></div>' +
            '<span class="madp-tail" aria-hidden="true"></span>';

        panel.querySelector('.madp-title').textContent = String(title || 'Thông báo');
        panel.querySelector('.madp-body').innerHTML = String(bodyHtml || '');
        if (panel.querySelector('.xai-report')) {
            panel.classList.add('madp-long');
        }
        const closeButton = panel.querySelector('.madp-close');
        if (closeButton) {
            closeButton.style.setProperty('display', 'flex', 'important');
            closeButton.style.setProperty('visibility', 'visible', 'important');
            closeButton.style.setProperty('opacity', '1', 'important');
            closeButton.style.setProperty('pointer-events', 'auto', 'important');
            closeButton.style.setProperty('position', 'relative', 'important');
            closeButton.style.setProperty('z-index', '50', 'important');
            closeButton.addEventListener('pointerdown', event => event.stopPropagation());
            closeButton.addEventListener('click', event => {
                event.preventDefault();
                event.stopPropagation();
                closeAutoDockPanel();
            });
        }
        document.body.appendChild(panel);
        applyInspectorContrastHardening(panel);
        hardenXaiReport(panel);
        installAutoDockContentResizeObserver(panel);
        requestAnimationFrame(() => {
            layoutAutoDockPanel(panel);
            requestAnimationFrame(() => layoutAutoDockPanel(panel));
            panel.classList.add('madp-show');
        });

        if (autoCloseMs > 0) {
            setTimeout(() => {
                if (panel.isConnected) panel.remove();
            }, autoCloseMs);
        }
        return panel;
    }


    function autoAlert(message) {

        ensureUnifiedAutoStyles();
        ensureUnifiedAutoSpeechBubbleStyles();
        ensureUnifiedAutoV759Styles();
        ensureUnifiedAutoV761Styles();
        ensureUnifiedAutoV762Styles();
        ensureUnifiedAutoV763Styles();
        ensureUnifiedAutoV764Styles();
        ensureUnifiedAutoV765Styles();
        ensureUnifiedAutoV744Styles();
        ensureUnifiedAutoV745Styles();
        ensureUnifiedAutoV746Styles();
        ensureUnifiedAutoV747Styles();
        ensureUnifiedAutoV748Styles();
        ensureUnifiedAutoV749Styles();
        ensureUnifiedAutoV750Styles();
        ensureUnifiedAutoV751Styles();
        ensureUnifiedAutoV752Styles();
        ensureUnifiedAutoV753Styles();
        ensureUnifiedAutoV754Styles();
        ensureUnifiedAutoV755Styles();
        ensureUnifiedAutoV756Styles();
        ensureUnifiedAutoV757Styles();

        message = normalizeAutoMessageModel(
            message
        );

        if (unifiedAutoRuntime.running) {
            unifiedAutoRuntime.lastMessage =
                String(message || '');
            showRunningSpeechBubble(message);
            return;
        }

        const parsed = parseAutoNoticeMessage(message, 'Thông báo');
        const fallbackBody =
            parsed.type === 'ok'
                ? 'Đã xử lý xong. Kiểm tra nhanh trước khi lưu.'
                : parsed.type === 'warn'
                    ? 'Có mục cần kiểm tra lại trước khi tiếp tục.'
                    : 'AUTO gặp lỗi. Kiểm tra lại thông tin và thử lại.';

        showAutoDockPanel(
            parsed.title,
            renderSpeechBodyHtml(parsed.body || fallbackBody),
            parsed.type,
            parsed.type === 'ok'
                ? 4200
                : parsed.type === 'warn'
                    ? 7000
                    : 8000
        );
    }


    function hasCurrentCanLamSangWarning() {

        if (!lastCanLamSangReport) {
            return false;
        }

        if (isModelListPage()) {
            return false;
        }

        const currentPatientKey = getCurrentPatientKey();
        if (
            lastCanLamSangReportPatientKey &&
            currentPatientKey &&
            lastCanLamSangReportPatientKey !== currentPatientKey
        ) {
            return false;
        }

        return !!(
            (lastCanLamSangReport.findings &&
                lastCanLamSangReport.findings.length) ||
            (lastCanLamSangReport.missingLabels &&
                lastCanLamSangReport.missingLabels.length)
        );
    }

    function updateUnifiedAutoButton() {

        const button =
            document.getElementById(
                'medinet-auto-unified'
            );

        if (!button) {
            return;
        }

        const model =
            getCurrentMedinetModel();

        const modelEl =
            button.querySelector(
                '.mau-model'
            );

        const warning =
            hasCurrentCanLamSangWarning();

        modelEl.textContent =
            model || '—';

        button.classList.toggle(
            'mau-unknown',
            !model
        );

        button.classList.toggle(
            'mau-has-warning',
            warning
        );

        button.title =
            model
                ? (
                    `AUTO ${model}` +
                    (warning ? ' • Có nội dung cần kiểm tra' : '')
                )
                : 'Chưa nhận diện được M2-M6. Hãy mở từ trang danh sách mẫu.';
    }

    async function runAutoM2Unified() {

        const tabTitle =
            getCurrentTabTitleM2();

        const bodyTextM2 =
            norm(
                document.body.innerText
            );

        if (
            tabTitle.includes(
                'tiền sử bệnh nhân dưới 18 tuổi'
            )
        ) {

            await autoM2TienSuDuoi18();

        } else if (
            tabTitle.includes(
                'đánh giá sức khỏe tâm thần'
            ) ||
            bodyTextM2.includes(
                'đánh giá sức khỏe tâm thần'
            )
        ) {

            await autoM2DanhGiaTamThan();

        } else if (
            tabTitle.includes(
                'thông tin khám bệnh nhân dưới 18 tuổi'
            ) ||
            bodyTextM2.includes(
                'thông tin khám bệnh nhân dưới 18 tuổi'
            )
        ) {

            await autoM2KhamLamSang();

        } else {

            autoAlert(
                '⚠️ AUTO M2 chưa hỗ trợ tab này.\n\n' +
                'Tab hiện tại: ' +
                (tabTitle || '(không xác định)')
            );
        }
    }

    async function runAutoM3Unified() {

        const bodyText =
            norm(
                document.body.innerText
            );

        if (
            bodyText.includes(
                'kết quả xét nghiệm máu'
            )
        ) {

            await autoCanLamSang();

        } else if (
            bodyText.includes(
                'chưa phát hiện bất thường'
            )
        ) {

            await autoM3KhamLamSang();

        } else {

            await autoM3TienSu();
        }
    }

    async function runAutoM4Unified() {

        const tabTitle =
            getCurrentTabTitle();

        const bodyTextM4 =
            norm(
                document.body.innerText
            );

        if (
            bodyTextM4.includes(
                'kết quả xét nghiệm máu'
            )
        ) {

            await autoCanLamSang();

        } else if (
            tabTitle.includes(
                'hỏi bệnh và khám lâm sàng'
            )
        ) {

            await autoM4HoiBenhKhamLamSang();

        } else if (
            tabTitle.includes(
                'thông tin khám'
            )
        ) {

            await autoM3KhamLamSang();

        } else {

            await autoM4TienSu();
        }
    }

    async function runAutoByDetectedModel(model) {

        switch (model) {

            case 'M2':
                await runAutoM2Unified();
                return;

            case 'M3':
                await runAutoM3Unified();
                return;

            case 'M4':
                await runAutoM4Unified();
                return;

            case 'M5':
            case 'M6':
                await autoM5M6();
                return;

            default:
                throw new Error(
                    'Không xác định được mẫu M2-M6.'
                );
        }
    }

    function buildUnifiedCompletionMessage(model) {

        const report = lastCanLamSangReport;
        const abnormalCount = report && report.findings ? report.findings.length : 0;
        const missingCount = report && report.missingLabels ? report.missingLabels.length : 0;

        let warning = '';
        if (abnormalCount || missingCount) {
            warning = `\n⚠️ ${abnormalCount} bất thường` +
                (missingCount ? ` · ${missingCount} thông số thiếu` : '') +
                '. Bấm dấu ! để xem chi tiết.';
        }

        return (
            `⚠️ ${model} xong rồi · CHƯA LƯU\n` +
            `💾 Bấm “Lưu thay đổi” trước khi chuyển tab.` +
            warning
        );
    }


    function createUnifiedAutoButton() {

        if (
            document.getElementById(
                'medinet-auto-unified'
            )
        ) {

            updateUnifiedAutoButton();
            return;
        }

        ensureUnifiedAutoStyles();
        ensureUnifiedAutoV742Styles();
        ensureUnifiedAutoV744Styles();
        ensureUnifiedAutoV745Styles();
        ensureUnifiedAutoV746Styles();
        ensureUnifiedAutoV747Styles();
        ensureUnifiedAutoV748Styles();
        ensureUnifiedAutoV749Styles();
        ensureUnifiedAutoV750Styles();
        ensureUnifiedAutoV751Styles();
        ensureUnifiedAutoV752Styles();
        ensureUnifiedAutoV753Styles();
        ensureUnifiedAutoV754Styles();
        ensureUnifiedAutoV755Styles();
        ensureUnifiedAutoV756Styles();
        ensureUnifiedAutoV757Styles();
        ensureUnifiedAutoV758Styles();
        ensureUnifiedAutoSpeechBubbleStyles();
        ensureUnifiedAutoV759Styles();
        ensureUnifiedAutoV761Styles();
        ensureUnifiedAutoV762Styles();
        ensureUnifiedAutoV763Styles();
        ensureUnifiedAutoV764Styles();
        ensureUnifiedAutoV765Styles();

        const button =
            document.createElement(
                'button'
            );

        button.id =
            'medinet-auto-unified';

        button.type =
            'button';

        button.setAttribute(
            'aria-label',
            'Medinet AUTO'
        );

        button.innerHTML =
            '<span class="mau-shell"></span>' +
            '<span class="mau-ring"></span>' +
            '<span class="mau-ring2"></span>' +
            '<span class="mau-energy" aria-hidden="true"></span>' +
            '<span class="mau-sparks" aria-hidden="true">' +
                '<i></i><i></i><i></i><i></i><i></i>' +
            '</span>' +
            '<span class="mau-flames" aria-hidden="true">' +
                '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>' +
            '</span>' +
            '<span class="mau-core">' +
                '<span class="mau-model">—</span>' +
                '<span class="mau-auto">AUTO</span>' +
            '</span>' +
            '<span class="mau-warning" role="button" aria-label="Xem cảnh báo" title="Xem cảnh báo"></span>';

        const warningButton =
            button.querySelector(
                '.mau-warning'
            );

        const stopWarningBubble =
            function (event) {
                event.preventDefault();
                event.stopPropagation();
            };

        warningButton.addEventListener(
            'pointerdown',
            stopWarningBubble
        );

        warningButton.addEventListener(
            'touchstart',
            stopWarningBubble,
            { passive: false }
        );

        warningButton.addEventListener(
            'click',
            function (event) {

                event.preventDefault();
                event.stopPropagation();

                xemLaiCanhBao();
            }
        );

        button.addEventListener(
            'click',
            async function () {

                if (button.disabled) {
                    return;
                }

                // Khi có cảnh báo, toàn bộ reactor đỏ trở thành nút XEM LẠI.
                // Người dùng lớn tuổi không cần nhấn chính xác vào dấu chấm than.
                if (hasCurrentCanLamSangWarning()) {
                    xemLaiCanhBao();
                    return;
                }

                const model =
                    getCurrentMedinetModel();

                if (!model) {

                    showToast(
                        '⚠️ Chưa nhận diện được mẫu. Hãy mở hồ sơ từ danh sách M2-M6.',
                        4200
                    );

                    updateUnifiedAutoButton();
                    return;
                }

                if (isModelListPage()) {

                    showToast(
                        `✓ Đã nhận diện ${model}. Mở hồ sơ cần nhập rồi bấm AUTO.`,
                        3200
                    );

                    return;
                }

                button.disabled =
                    true;

                button.classList.add(
                    'mau-running'
                );

                unifiedAutoRuntime.running =
                    true;

                unifiedAutoRuntime.model =
                    model;

                unifiedAutoRuntime.lastMessage =
                    '';

                unifiedAutoRuntime.blocked =
                    false;

                unifiedAutoRuntime.reportShown =
                    false;

                // Giữ cảnh báo xét nghiệm khi chuyển sang các mục khác
                // của cùng bệnh nhân. Chỉ đóng bubble đang mở; dữ liệu cảnh báo
                // được xóa khi quay về danh sách hoặc sang bệnh nhân khác.
                closeAutoDockPanel();

                showRunningSpeechBubble(`⏳ ${model} · Đang tự động điền\nHệ thống đang xử lý. Giữ nguyên trang này đến khi hoàn tất.`);

                let completed =
                    false;

                try {

                    await runAutoByDetectedModel(
                        model
                    );

                    completed =
                        true;

                } catch (e) {

                    console.error(
                        LOG,
                        e
                    );

                    unifiedAutoRuntime.lastMessage =
                        `❌ Lỗi AUTO ${model}.\n\n` +
                        'Mở F12 → Console để xem chi tiết.';

                } finally {

                    unifiedAutoRuntime.running =
                        false;

                    button.disabled =
                        false;

                    button.classList.remove(
                        'mau-running'
                    );

                    updateUnifiedAutoButton();

                    if (
                        completed &&
                        !unifiedAutoRuntime.blocked &&
                        unifiedAutoRuntime.reportShown
                    ) {
                        // Báo cáo xét nghiệm đã tự bật ngay khi lấy xong dữ liệu.
                        // Không ghi đè nó bằng bubble "AUTO hoàn tất".
                    } else if (completed && !unifiedAutoRuntime.blocked) {
                        autoAlert(
                            buildUnifiedCompletionMessage(
                                model
                            )
                        );
                    } else {
                        autoAlert(
                            unifiedAutoRuntime.lastMessage ||
                            `❌ Lỗi AUTO ${model}.`
                        );
                    }

                    unifiedAutoRuntime.model =
                        '';

                    unifiedAutoRuntime.lastMessage =
                        '';

                    unifiedAutoRuntime.blocked =
                        false;

                    unifiedAutoRuntime.reportShown =
                        false;
                }
            }
        );

        document.body.appendChild(
            button
        );

        installRandomPlasmaController(button);
        restoreLastCanLamSangReport();
        updateUnifiedAutoButton();
    }

    function installModelRouteWatcher() {

        if (
            window.__medinetUnifiedAutoWatcherInstalled
        ) {
            return;
        }

        window.__medinetUnifiedAutoWatcherInstalled =
            true;

        let lastHref =
            location.href;

        const refresh =
            () => {

                if (isModelListPage()) {
                    // Chỉ khi quay lại danh sách để chọn ca mới mới xóa cảnh báo.
                    if (lastCanLamSangReport || lastCanLamSangReportPatientKey) {
                        clearLastCanLamSangReport();
                    }
                } else {
                    const currentPatientKey = getCurrentPatientKey();
                    if (
                        lastCanLamSangReportPatientKey &&
                        currentPatientKey &&
                        lastCanLamSangReportPatientKey !== currentPatientKey
                    ) {
                        // Trường hợp hiếm: mở thẳng sang bệnh nhân khác mà không qua danh sách.
                        clearLastCanLamSangReport();
                    } else {
                        restoreLastCanLamSangReport();
                    }
                }

                const currentModel =
                    detectModelFromUrl(
                        location.href
                    );

                if (currentModel) {
                    rememberDetectedModel(
                        currentModel
                    );
                }

                updateUnifiedAutoButton();
            };

        window.addEventListener(
            'popstate',
            refresh
        );

        window.addEventListener(
            'hashchange',
            refresh
        );

        setInterval(
            () => {

                if (
                    location.href !== lastHref
                ) {

                    lastHref =
                        location.href;

                    refresh();
                }
            },
            700
        );

        refresh();
    }

    // =========================================================
    // KHỞI ĐỘNG
    // =========================================================

    function init() {

        ensureToolbarStyles();

        createUnifiedAutoButton();

        installModelRouteWatcher();

        // Cảnh báo đã tích hợp trực tiếp vào nút AUTO tròn.

        log(
            '================================'
        );

        log(
            '✅ MEDINET AUTO M2-M6 UNIFIED READY v7.42'
        );

        log(
            '✓ M3: click không scroll'
        );

        log(
            '✓ M4: click không scroll'
        );

        log(
            '✓ Không tự lưu'
        );

        log(
            '✓ Không tự chuyển tab'
        );

        log(
            '================================'
        );
    }


    init();

})();
