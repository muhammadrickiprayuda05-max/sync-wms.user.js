// ==UserScript==
// @name         Auto Sync Scanner V10 ke QianYi Weigh & Ship
// @namespace    http://tampermonkey.net
// @version      1.3
// @description  Meneruskan resi VALID dari Scanner Filter V10 ke QianYi WMS secara otomatis
// @match        *://*.github.io/*
// @match        *://*.best-inc.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    const currentUrl = window.location.href;

    // =========================================================================
    // BAGIAN 1: PENGIRIM DARI TAB SCANNER FILTER V10
    // =========================================================================
    if (currentUrl.includes('github.io')) {
        let lastSentKey = '';

        // Abaikan riwayat lama saat halaman baru dibuka
        setTimeout(() => {
            const initRows = document.querySelectorAll('table tbody tr');
            if (initRows.length > 0) {
                const cells = initRows.item(0).querySelectorAll('td');
                if (cells.length >= 2) {
                    lastSentKey = cells.item(0).innerText.trim() + '_' + cells.item(1).innerText.trim();
                }
            }
        }, 800);

        setInterval(() => {
            const rows = document.querySelectorAll('table tbody tr');
            if (rows.length > 0) {
                const latestRow = rows.item(0);
                const cells = latestRow.querySelectorAll('td');

                if (cells.length >= 3) {
                    const waktu = cells.item(0).innerText.trim();
                    const noResi = cells.item(1).innerText.trim();
                    const status = cells.item(2).innerText.trim().toUpperCase();
                    const uniqueKey = waktu + '_' + noResi;

                    if (status.includes('VALID') && noResi !== '' && uniqueKey !== lastSentKey) {
                        lastSentKey = uniqueKey;
                        GM_setValue('resi_valid_terbaru', JSON.stringify({
                            resi: noResi,
                            id: Date.now()
                        }));
                    }
                }
            }
        }, 200);
    }

    // =========================================================================
    // BAGIAN 2: PENERIMA DI TAB QIANYI WMS (POLLING AKTIF SETIAP 200ms)
    // =========================================================================
    if (currentUrl.includes('best-inc.com')) {
        let lastProcessedId = 0;

        // Buat kotak status kecil di pojok kanan bawah layar WMS agar terlihat saat resi masuk
        const badge = document.createElement('div');
        badge.style.cssText = 'position:fixed;bottom:15px;right:15px;background:#16a34a;color:#fff;padding:8px 14px;border-radius:6px;font-size:13px;font-weight:bold;z-index:99999;box-shadow:0 2px 8px rgba(0,0,0,0.3);';
        badge.innerText = '🟢 Bridge V10 Aktif - Menunggu Scan...';
        document.body.appendChild(badge);

        setInterval(() => {
            const rawData = GM_getValue('resi_valid_terbaru', '');
            if (!rawData) return;

            let data;
            try { data = JSON.parse(rawData); } catch (e) { return; }

            if (!data || !data.resi || data.id === lastProcessedId) return;
            if (lastProcessedId === 0) {
                lastProcessedId = data.id;
                return;
            }

            lastProcessedId = data.id;
            const resiMasuk = data.resi;
            badge.style.background = '#2563eb';
            badge.innerText = '📥 Menginput Resi: ' + resiMasuk;

            // Cari kotak input paling lebar yang aktif (kotak Tracking#)
            const inputs = Array.from(document.querySelectorAll('input'));
            const targetInput = inputs.find(inp =>
                !inp.disabled &&
                !inp.readOnly &&
                inp.offsetParent !== null &&
                inp.offsetWidth > 220 &&
                inp.value !== 'SHIPPING01' &&
                !inp.value.startsWith('LOAD')
            );

            if (targetInput) {
                targetInput.focus();
                const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
                nativeSetter.call(targetInput, resiMasuk);
                targetInput.dispatchEvent(new Event('input', { bubbles: true }));
                targetInput.dispatchEvent(new Event('change', { bubbles: true }));

                setTimeout(() => {
                    const enterOpts = { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true, cancelable: true };
                    targetInput.dispatchEvent(new KeyboardEvent('keydown', enterOpts));
                    targetInput.dispatchEvent(new KeyboardEvent('keypress', enterOpts));
                    targetInput.dispatchEvent(new KeyboardEvent('keyup', enterOpts));
                    badge.style.background = '#16a34a';
                    badge.innerText = '✅ Terkirim ke WMS: ' + resiMasuk;
                }, 150);
            } else {
                badge.style.background = '#dc2626';
                badge.innerText = '❌ Kotak Tracking# tidak ditemukan!';
            }
        }, 200);
    }
})();
