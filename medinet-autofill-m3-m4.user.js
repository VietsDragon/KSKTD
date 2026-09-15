// ==UserScript==
// @name         Auto KSK TD
// @namespace    medinet-autofill-m3-m4
// @version      7.38
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

        ensureModalStyles();

        const toast =
            document.createElement(
                'div'
            );

        toast.className =
            'mnm-toast';

        toast.textContent =
            message;

        document.body.appendChild(
            toast
        );

        requestAnimationFrame(
            () => {

                toast.classList.add(
                    'mnm-toast-show'
                );
            }
        );

        setTimeout(
            () => {

                toast.classList.remove(
                    'mnm-toast-show'
                );

                setTimeout(
                    () => {

                        if (
                            toast.parentNode
                        ) {

                            toast.parentNode.removeChild(
                                toast
                            );
                        }
                    },
                    300
                );
            },
            durationMs || 3000
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
                            : 'BẤT<br>THƯỜNG';

                    return (
                        '<div class="mnm-finding-row">' +
                        `<span class="mnm-badge ${badgeClass}">${badgeText}</span>` +
                        '<div class="mnm-finding-main">' +
                        `<div class="mnm-finding-label">${f.label}</div>` +
                        '<div class="mnm-finding-value-row">' +
                        `<span class="mnm-finding-number ${numberClass}">${f.value}</span>` +
                        `<span class="mnm-finding-range">(bình thường: ${f.rangeText})</span>` +
                        '</div>' +
                        `<div class="mnm-finding-icd">${f.code} - ${f.name}</div>` +
                        '</div>' +
                        '</div>'
                    );
                }
            ).join(
                ''
            );

        return (
            rows +
            '<div class="mnm-note">⚠️ Chỉ mang tính tham khảo - ' +
            'KHÔNG thay thế chẩn đoán của bác sĩ.</div>'
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
                `<div>Không tìm thấy kết quả khớp với ${searchDesc}.</div>` +
                `<div class="mnm-note">${KHOA_XN_CONTACT_MSG}</div>`,
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
        // NẾU CÓ THÔNG SỐ THIẾU (sheet chưa trả đủ kết quả) ->
        // cảnh báo liên hệ Khoa Xét nghiệm. Nếu điền đủ hết thì
        // thôi, không hiện gì (như yêu cầu).
        // -----------------------------------------------------

        if (
            missingLabels.length
        ) {

            await infoModal(
                `⚠️ ${tenBenhNhan} - Thiếu thông số xét nghiệm`,
                '<div>Các thông số sau chưa có kết quả trong sheet:</div>' +
                '<ul style="margin:10px 0 0;padding-left:20px;">' +
                missingLabels.map(
                    l =>
                        `<li>${l}</li>`
                ).join(
                    ''
                ) +
                '</ul>' +
                `<div class="mnm-note">${KHOA_XN_CONTACT_MSG}</div>`,
                'mnm-warn'
            );
        }


        // -----------------------------------------------------
        // CHỈ hiện cảnh báo khi có kết quả bất thường.
        // Bình thường thì thôi, không hiện gì thêm.
        // -----------------------------------------------------

        if (
            findings.length
        ) {

            await infoModal(
                `⚠️ ${tenBenhNhan} - Có kết quả bất thường`,
                renderFindingsHtml(
                    findings
                ) +
                '<div class="mnm-note">💡 Bấm nút "📋 XEM CẢNH BÁO" ' +
                'bất cứ lúc nào để xem lại, không cần tìm lại.</div>',
                'mnm-warn'
            );

        } else {

            log(
                'Không phát hiện kết quả bất thường (theo khoảng tham khảo).'
            );

            showToast(
                `✓ ${tenBenhNhan} - Đã điền xong, không có kết quả bất thường`
            );
        }
    }


    // -----------------------------------------------------------
    // XEM LẠI CẢNH BÁO GẦN NHẤT (không cần nhập lại SID/tên)
    // -----------------------------------------------------------

    function xemLaiCanhBao() {

        if (
            !lastCanLamSangReport
        ) {

            infoModal(
                'Chưa có báo cáo',
                '<div>Chưa có báo cáo nào trong phiên này.<br><br>' +
                'Vui lòng bấm AUTO M3/AUTO M4 ở trang Khám cận ' +
                'lâm sàng trước.</div>'
            );

            return;
        }

        const r =
            lastCanLamSangReport;

        const missingHtml =
            r.missingLabels &&
            r.missingLabels.length
                ? (
                    '<div style="margin-bottom:14px;">' +
                    '<div style="font-weight:700;color:#b45309;margin-bottom:6px;">' +
                    '⚠️ Thiếu thông số:</div>' +
                    '<ul style="margin:0;padding-left:20px;">' +
                    r.missingLabels.map(
                        l =>
                            `<li>${l}</li>`
                    ).join(
                        ''
                    ) +
                    '</ul>' +
                    `<div class="mnm-note">${KHOA_XN_CONTACT_MSG}</div>` +
                    '</div>'
                )
                : '';

        const bodyHtml =
            '<div class="mnm-patient-card" style="margin-bottom:14px;">' +
            `<span>SID</span><b>${r.sidThat}</b>` +
            `<span>Họ tên</span><b>${r.tenBenhNhan}</b>` +
            `<span>Tuổi</span><b>${r.tuoi}</b>` +
            `<span>Giới tính</span><b>${r.gioiTinh}</b>` +
            '</div>' +
            missingHtml +
            renderFindingsHtml(
                r.findings
            );

        infoModal(
            `📋 Báo cáo gần nhất`,
            bodyHtml,
            r.findings.length ||
            (r.missingLabels && r.missingLabels.length)
                ? 'mnm-warn'
                : 'mnm-ok'
        );
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

            /* Notice v7.38: độ tương phản cao, nhỏ hơn và né nút mặc định */
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


    const unifiedAutoRuntime = {
        running: false,
        model: '',
        lastMessage: ''
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

    function autoAlert(message) {

        ensureUnifiedAutoStyles();

        message = normalizeAutoMessageModel(
            message
        );

        // Khi đang chạy từ nút AUTO hợp nhất, giữ thông báo nội bộ
        // lại để cuối quy trình chỉ hiện 1 thẻ kết quả + trạng thái lưu.
        if (unifiedAutoRuntime.running) {
            unifiedAutoRuntime.lastMessage =
                String(message || '');
            return;
        }

        const raw =
            String(message || '').trim();

        const firstLine =
            raw.split('\n')[0] || 'Thông báo';

        const lower =
            norm(raw);

        let type = 'ok';
        let icon = '✓';

        if (
            firstLine.includes('❌') ||
            lower.includes('lỗi')
        ) {
            type = 'error';
            icon = '×';
        } else if (
            firstLine.includes('⚠️') ||
            lower.includes('cảnh báo') ||
            lower.includes('chưa hỗ trợ') ||
            lower.includes('không tìm thấy')
        ) {
            type = 'warn';
            icon = '!';
        }

        const title =
            firstLine
                .replace(/[✅⚠️❌📋🚀]/g, '')
                .trim() ||
            (
                type === 'ok'
                    ? 'AUTO hoàn tất'
                    : type === 'warn'
                        ? 'Cần kiểm tra'
                        : 'AUTO gặp lỗi'
            );

        const body =
            raw
                .split('\n')
                .slice(1)
                .join('\n')
                .replace(/^\s+|\s+$/g, '')
                .replace(/Vui Lòng/gi, 'Vui lòng');

        let notice =
            document.getElementById(
                'medinet-auto-notice'
            );

        if (notice) {
            notice.remove();
        }

        notice =
            document.createElement(
                'div'
            );

        notice.id =
            'medinet-auto-notice';

        notice.className =
            type === 'warn'
                ? 'man-warn'
                : type === 'error'
                    ? 'man-error'
                    : 'man-ok';

        const accent =
            document.createElement(
                'div'
            );

        accent.className =
            'man-accent';

        const wrap =
            document.createElement(
                'div'
            );

        wrap.className =
            'man-wrap';

        const iconEl =
            document.createElement(
                'div'
            );

        iconEl.className =
            'man-icon';

        iconEl.textContent =
            icon;

        const content =
            document.createElement(
                'div'
            );

        const titleEl =
            document.createElement(
                'div'
            );

        titleEl.className =
            'man-title';

        titleEl.textContent =
            title;

        const bodyEl =
            document.createElement(
                'div'
            );

        bodyEl.className =
            'man-body';

        bodyEl.textContent =
            body || (
                type === 'ok'
                    ? 'Đã xử lý xong. Vui lòng kiểm tra trước khi lưu.'
                    : 'Vui lòng kiểm tra lại dữ liệu.'
            );

        const close =
            document.createElement(
                'button'
            );

        close.type =
            'button';

        close.className =
            'man-close';

        close.setAttribute(
            'aria-label',
            'Đóng'
        );

        close.textContent =
            '×';

        content.appendChild(
            titleEl
        );

        content.appendChild(
            bodyEl
        );

        wrap.appendChild(
            iconEl
        );

        wrap.appendChild(
            content
        );

        wrap.appendChild(
            close
        );

        notice.appendChild(
            accent
        );

        notice.appendChild(
            wrap
        );

        document.body.appendChild(
            notice
        );

        requestAnimationFrame(
            () => {
                notice.classList.add(
                    'mau-show'
                );
            }
        );

        let timer =
            null;

        const closeNotice =
            () => {

                if (timer) {
                    clearTimeout(
                        timer
                    );
                }

                notice.classList.remove(
                    'mau-show'
                );

                setTimeout(
                    () => {
                        if (
                            notice &&
                            notice.parentNode
                        ) {
                            notice.parentNode.removeChild(
                                notice
                            );
                        }
                    },
                    180
                );
            };

        close.addEventListener(
            'click',
            closeNotice
        );

        // Thành công tự ẩn; cảnh báo/lỗi giữ lâu hơn.
        timer =
            setTimeout(
                closeNotice,
                type === 'ok'
                    ? 5200
                    : 9000
            );
    }


    function hasCurrentCanLamSangWarning() {

        if (!lastCanLamSangReport) {
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
                    (warning ? ' • Có cảnh báo, bấm dấu ! để xem' : '')
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

    function findVisibleSaveButton() {

        const candidates = [
            ...document.querySelectorAll(
                'button, [role="button"], .dx-button'
            )
        ];

        const isVisible =
            el => {
                if (!el) return false;
                const style = getComputedStyle(el);
                const rect = el.getBoundingClientRect();
                return (
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    rect.width > 0 &&
                    rect.height > 0
                );
            };

        const exact =
            candidates.find(
                el =>
                    isVisible(el) &&
                    norm(el.innerText || el.textContent) === 'lưu thay đổi' &&
                    !el.disabled &&
                    el.getAttribute('aria-disabled') !== 'true'
            );

        if (exact) {
            return exact;
        }

        return candidates.find(
            el =>
                isVisible(el) &&
                norm(el.innerText || el.textContent).includes('lưu thay đổi') &&
                !el.disabled &&
                el.getAttribute('aria-disabled') !== 'true'
        ) || null;
    }

    async function autoSaveCurrentForm() {

        await sleep(
            220
        );

        const saveButton =
            findVisibleSaveButton();

        if (!saveButton) {
            return {
                clicked: false,
                reason: 'not-found'
            };
        }

        robustClick(
            saveButton
        );

        await sleep(
            300
        );

        return {
            clicked: true,
            reason: 'clicked'
        };
    }

    function buildUnifiedCompletionMessage(model, saveResult) {

        let detail =
            String(
                unifiedAutoRuntime.lastMessage || ''
            )
            .split('\n')
            .slice(1)
            .join('\n')
            .trim();

        // Bỏ các câu nhắc lưu cũ vì quy trình mới tự bấm Lưu thay đổi.
        detail = detail
            .replace(/Vui lòng kiểm tra trước khi lưu\.?/gi, '')
            .replace(/Vui Lòng Kiểm Tra Trước Khi Lưu\.?/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();

        const saveLine =
            saveResult && saveResult.clicked
                ? '✓ Đã bấm Lưu thay đổi.'
                : '⚠️ AUTO đã xong nhưng không tìm thấy nút Lưu thay đổi.';

        return (
            (saveResult && saveResult.clicked ? '✅' : '⚠️') +
            ` ${model} - AUTO hoàn tất\n\n` +
            (detail ? detail + '\n' : '') +
            saveLine
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
            '<span class="mau-sparks" aria-hidden="true">' +
                '<i></i><i></i><i></i><i></i><i></i>' +
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

                let completed =
                    false;

                let saveResult =
                    null;

                try {

                    await runAutoByDetectedModel(
                        model
                    );

                    completed =
                        true;

                    // AUTO xong -> bấm Lưu thay đổi ngay, tránh người dùng
                    // chuyển trang trước khi lưu dữ liệu vừa điền.
                    saveResult =
                        await autoSaveCurrentForm();

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

                    if (completed) {
                        autoAlert(
                            buildUnifiedCompletionMessage(
                                model,
                                saveResult
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
                }
            }
        );

        document.body.appendChild(
            button
        );

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
            '✅ MEDINET AUTO M2-M6 UNIFIED READY'
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
