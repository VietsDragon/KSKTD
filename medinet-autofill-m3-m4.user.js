// ==UserScript==
// @name         Auto KSK TD
// @namespace    medinet-autofill-m3-m4
// @version      7.20
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


        alert(
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

        alert(
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


    alert(
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

                        alert(
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


                    alert(
                        '❌ Lỗi AUTO M2.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );


                } finally {

                    hideStatusBar();

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


        alert(
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


        alert(
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


                    alert(
                        '❌ Lỗi AUTO M3.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );

                } finally {

                    hideStatusBar();

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
    // GIAO DIỆN MODAL TÙY CHỈNH (thay cho alert()/confirm() thô
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


        alert(
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

        alert(
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


                    alert(
                        '❌ Lỗi AUTO M4.\n\n' +
                        'Mở F12 → Console để xem chi tiết.'
                    );


                } finally {

                    hideStatusBar();

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

        alert(
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

        let listText =
            `Tìm thấy ${matches.length} kết quả khớp với ${searchDesc}:\n\n`;

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

                listText +=
                    `${i + 1}. ${ten} - ${tuoi} tuổi, ${gtText} - ` +
                    `SID ${sidVal} - Ngày XN ${ngay}\n`;
            }
        );

        listText +=
            `\nNhập số thứ tự (1-${matches.length}) để chọn, ` +
            'để trống/Cancel để huỷ:';

        const choice =
            prompt(
                listText
            );

        if (
            !choice ||
            !choice.trim()
        ) {

            return null;
        }

        const idx =
            parseInt(
                choice.trim(),
                10
            );

        if (
            isNaN(idx) ||
            idx < 1 ||
            idx > matches.length
        ) {

            alert(
                '⚠️ Lựa chọn không hợp lệ.\n\n' +
                KHOA_XN_CONTACT_MSG
            );

            return null;
        }

        return matches[idx - 1];
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

        const displayVal =
            rounded.replace(
                '.',
                ','
            );

        await dispatchInputValue(
            input,
            displayVal
        );

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

        if (
            !isNaN(n) &&
            n === 0
        ) {

            // Thử điền chữ "Negative" trước, KHÔNG cần biết
            // trước ô này có chấp nhận chữ hay không (role có
            // thể đổi bất cứ lúc nào). Điền xong tự đọc lại -
            // nếu ô KHÔNG nhận chữ (ô số thuần, chỉ nhận số),
            // giá trị "Negative" sẽ không "dính" -> tự động
            // chuyển sang điền số "0" thay thế.
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

            // Ô không nhận chữ -> điền số 0 thay thế
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

        alert(
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

                    alert(
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
                findLabelElements(
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
            min: 3.8, max: 5.6,
            maleMin: 3.8, maleMax: 5.6,
            femaleMin: 3.8, femaleMax: 5.6,
            low: { code: 'D64.9', name: 'Thiếu máu chưa xác định' },
            high: { code: 'D75.1', name: 'Đa hồng cầu thứ phát' }
        },
        {
            column: 'HGB', label: 'Huyết sắc tố',
            min: 120, max: 180,
            maleMin: 120, maleMax: 180,
            femaleMin: 120, femaleMax: 180,
            low: { code: 'D64.9', name: 'Thiếu máu' }
        },
        {
            column: 'HCT', label: 'Hematocrit',
            min: 0.35, max: 0.52,
            maleMin: 0.35, maleMax: 0.52,
            femaleMin: 0.35, femaleMax: 0.52,
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
        { column: 'MCHC', label: 'MCHC', min: 310, max: 360 },
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
            min: 3.9, max: 5.5,
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
            min: 45, max: 80,
            maleMin: 45, maleMax: 80,
            femaleMin: 45, femaleMax: 80,
            high: { code: 'R94.4', name: 'Chức năng thận bất thường' }
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
                pickFromMultipleMatches(
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

    function ensureStatusBarStyles() {

        if (
            document.getElementById(
                'medinet-statusbar-style'
            )
        ) {

            return;
        }

        const style =
            document.createElement(
                'style'
            );

        style.id =
            'medinet-statusbar-style';

        style.textContent = `
            #medinet-status-bar {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                z-index: 9999999;
                background: #0f172a;
                color: #fff;
                font-family: 'Segoe UI', Roboto, Arial, sans-serif;
                font-size: 13.5px;
                font-weight: 600;
                text-align: center;
                padding: 9px 16px;
                box-shadow: 0 2px 10px rgba(0,0,0,.3);
                display: none;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            #medinet-status-bar .medinet-spin {
                display: inline-block;
                width: 13px;
                height: 13px;
                border: 2px solid rgba(255,255,255,.35);
                border-top-color: #fff;
                border-radius: 50%;
                animation: medinet-spin-anim .7s linear infinite;
            }
            @keyframes medinet-spin-anim {
                to { transform: rotate(360deg); }
            }
        `;

        document.head.appendChild(
            style
        );
    }

    function showStatusBar(
        message
    ) {

        ensureStatusBarStyles();

        let bar =
            document.getElementById(
                'medinet-status-bar'
            );

        if (!bar) {

            bar =
                document.createElement(
                    'div'
                );

            bar.id =
                'medinet-status-bar';

            document.body.appendChild(
                bar
            );
        }

        bar.innerHTML =
            '<span class="medinet-spin"></span>' +
            '<span>' +
            message +
            '</span>';

        bar.style.display =
            'flex';
    }

    function hideStatusBar() {

        const bar =
            document.getElementById(
                'medinet-status-bar'
            );

        if (bar) {

            bar.style.display =
                'none';
        }
    }


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
    // KHỞI ĐỘNG
    // =========================================================

    function init() {

        ensureToolbarStyles();

        createM2Button();

        createM3Button();

        createM4Button();

        createM5M6Button();

        createXemCanhBaoButton();

        log(
            '================================'
        );

        log(
            '✅ MEDINET AUTO M3 + M4 READY'
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
