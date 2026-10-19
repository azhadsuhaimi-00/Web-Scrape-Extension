/**
 * Shopee to Threads Script Generator - content.js
 * Skrip Web Scraper Tahan Lasak untuk Shopee Malaysia
 * Mengekstrak Tajuk Produk, Spesifikasi, Deskripsi, dan URL Bersih
 */

(function () {
  // Elakkan pendaftaran berulang jika script di-inject lebih sekali
  if (window.__SHOPEE_THREADS_SCRAPER_INITIALIZED__) {
    return;
  }
  window.__SHOPEE_THREADS_SCRAPER_INITIALIZED__ = true;

  console.log('[Racun Social Scraper] Content script sedia berkhidmat di Shopee Malaysia.');

  /**
   * Ekstrak maklumat daripada structured data (Schema.org JSON-LD)
   * Kaedah paling tepat dan kebal daripada perubahan class CSS Shopee
   */
  function scrapeFromJsonLd() {
    const scripts = document.querySelectorAll('script[type="application/ld+json"]');
    for (const script of scripts) {
      try {
        const json = JSON.parse(script.textContent || '{}');
        const items = Array.isArray(json) ? json : [json];

        for (const item of items) {
          if (item['@type'] === 'Product') {
            return {
              title: item.name ? item.name.trim() : '',
              description: item.description ? item.description.trim() : '',
              brand: typeof item.brand === 'object' ? item.brand.name : (item.brand || '')
            };
          }
        }
      } catch (err) {
        // Abaikan ralat parse script yang bukan format JSON sah
      }
    }
    return null;
  }

  /**
   * Ekstrak Tajuk Produk menggunakan pelbagai fallback selector moden & legasi
   */
  function scrapeTitle() {
    // 1. Semak JSON-LD dahulu
    const jsonLd = scrapeFromJsonLd();
    if (jsonLd && jsonLd.title && jsonLd.title.length > 5) {
      return jsonLd.title;
    }

    // 2. Senarai selector DOM mengikut prioriti
    const titleSelectors = [
      'h1.product-title',
      'h1',
      'div[data-sqe="item-name"]',
      'div.WB201N span',
      'div.WB201N',
      'div[class*="WB201N"] span',
      'div[class*="product-briefing"] span',
      'div[class*="product-briefing"] h1',
      'div.fM439j',
      'div._44qnta span',
      'div[class*="title"] h1',
      'div[class*="name"]'
    ];

    for (const selector of titleSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 5) {
        return el.innerText.trim();
      }
    }

    // 3. Fallback ke Meta OpenGraph Tag
    const ogTitle = document.querySelector('meta[property="og:title"]')?.getAttribute('content');
    if (ogTitle && ogTitle.trim().length > 5) {
      return ogTitle.replace(/\|\s*Shopee\s*Malaysia.*$/i, '').trim();
    }

    // 4. Fallback terakhir ke document.title
    if (document.title && document.title.length > 5) {
      return document.title.replace(/\|\s*Shopee\s*Malaysia.*$/i, '').trim();
    }

    return 'Produk Shopee Tanpa Tajuk';
  }

  /**
   * Ekstrak Spesifikasi / Maklumat Terperinci Produk
   */
  function scrapeSpecifications() {
    const specs = [];

    // Strategi 1: Cari kontena 'Spesifikasi Produk' / 'Product Specifications'
    const sectionHeaders = document.querySelectorAll('h2, h3, div, span');
    let specContainer = null;

    for (const el of sectionHeaders) {
      const text = (el.innerText || '').trim().toLowerCase();
      if (text === 'product specifications' || text === 'spesifikasi produk') {
        // Cari parent card atau wrapper container terdekat
        specContainer = el.closest('div[class*="product-detail"]') ||
                        el.closest('div.page-product__detail') ||
                        el.parentElement?.parentElement;
        break;
      }
    }

    if (specContainer) {
      // Ambil label dan nilai pasangan (cth: Jenama, Waranti, Bahan, Stok)
      const rows = specContainer.querySelectorAll('div[class*="spec-row"], div.G27Sh4, div._2h7W8v, div[class*="row"]');
      rows.forEach(row => {
        const text = row.innerText.trim();
        if (text && text.includes('\n')) {
          const parts = text.split('\n').map(s => s.trim()).filter(Boolean);
          if (parts.length >= 2) {
            specs.push(`${parts[0]}: ${parts.slice(1).join(', ')}`);
          }
        }
      });
    }

    // Strategi 2: Jika spesifikasi masih kosong, semak data-table / label-value am
    if (specs.length === 0) {
      const allLabels = document.querySelectorAll('label, div[class*="label"], span[class*="label"]');
      allLabels.forEach(label => {
        const labelText = label.innerText.trim();
        const valueEl = label.nextElementSibling;
        if (labelText && valueEl && valueEl.innerText.trim() && labelText.length < 30) {
          specs.push(`${labelText}: ${valueEl.innerText.trim()}`);
        }
      });
    }

    // Strategi 3: Sertakan Jenama dari JSON-LD jika wujud
    const jsonLd = scrapeFromJsonLd();
    if (jsonLd && jsonLd.brand) {
      const brandAlreadyPresent = specs.some(s => s.toLowerCase().includes('brand') || s.toLowerCase().includes('jenama'));
      if (!brandAlreadyPresent) {
        specs.unshift(`Brand/Jenama: ${jsonLd.brand}`);
      }
    }

    return specs.slice(0, 15).join('\n'); // Hadkan kepada 15 spesifikasi utama
  }

  /**
   * Ekstrak Deskripsi Produk
   */
  function scrapeDescription() {
    // 1. Cari kontena teks deskripsi berasaskan heading
    const allHeadings = document.querySelectorAll('h2, h3, div, span');
    let descContainer = null;

    for (const el of allHeadings) {
      const text = (el.innerText || '').trim().toLowerCase();
      if (text === 'product description' || text === 'deskripsi produk') {
        descContainer = el.parentElement?.parentElement || el.closest('div');
        break;
      }
    }

    if (descContainer) {
      // Ambil elemen teks di bawah deskripsi
      const descText = descContainer.innerText
        .replace(/product description/gi, '')
        .replace(/deskripsi produk/gi, '')
        .trim();

      if (descText.length > 20) {
        return cleanDescription(descText);
      }
    }

    // 2. Senarai selector khusus teks deskripsi Shopee
    const descSelectors = [
      'div.e8beHG',
      'div._3y754H',
      'div.product-detail__description',
      'div[class*="product-detail__description"]',
      'div[class*="description"]',
      'div.f7X1G7'
    ];

    for (const selector of descSelectors) {
      const el = document.querySelector(selector);
      if (el && el.innerText && el.innerText.trim().length > 30) {
        return cleanDescription(el.innerText.trim());
      }
    }

    // 3. Fallback ke JSON-LD description
    const jsonLd = scrapeFromJsonLd();
    if (jsonLd && jsonLd.description && jsonLd.description.length > 20) {
      return cleanDescription(jsonLd.description);
    }

    // 4. Fallback ke Meta Description
    const metaDesc = document.querySelector('meta[name="description"]')?.getAttribute('content') ||
                     document.querySelector('meta[property="og:description"]')?.getAttribute('content');
    if (metaDesc && metaDesc.trim().length > 20) {
      return cleanDescription(metaDesc.trim());
    }

    return 'Deskripsi tidak dapat diekstrak sepenuhnya dari halaman ini.';
  }

  /**
   * Membersihkan teks deskripsi daripada kekotoran whitespace dan menghadkan saiz token
   */
  function cleanDescription(rawText) {
    if (!rawText) return '';
    return rawText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n')
      .slice(0, 2500); // Truncate hingga 2500 aksara untuk kawal saiz prompt Gemini
  }

  /**
   * Dapatkan URL produk yang bersih tanpa parameter tracking berlebihan
   */
  function getCleanProductUrl() {
    try {
      const url = new URL(window.location.href);
      // Simpan pathname bersih cth: /Nama-Produk-i.1234567.89101112
      return `${url.origin}${url.pathname}`;
    } catch (e) {
      return window.location.href.split('?')[0];
    }
  }

  /**
   * Fungsi utama pengumpulan data produk
   */
  function scrapeShopeeProductData() {
    const isShopee = window.location.hostname.includes('shopee.com.my');

    if (!isShopee) {
      return {
        success: false,
        error: 'Sila buka halaman produk rasmi Shopee Malaysia (shopee.com.my).'
      };
    }

    const title = scrapeTitle();
    const specifications = scrapeSpecifications();
    const description = scrapeDescription();
    const productUrl = getCleanProductUrl();

    // Semak sama ada halaman betul-betul halaman produk
    const hasValidContent = (title && title.length > 5) || (description && description.length > 20);

    if (!hasValidContent) {
      return {
        success: false,
        error: 'Gagal mengekstrak maklumat produk. Pastikan halaman produk Shopee telah selesai dimuatkan (loaded).'
      };
    }

    return {
      success: true,
      data: {
        title,
        specifications: specifications || 'Tiada spesifikasi terperinci dijumpai.',
        description: description || 'Tiada deskripsi dijumpai.',
        productUrl,
        pageTitle: document.title,
        scrapedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Listener untuk menerima arahan 'SCRAPE_SHOPEE_PRODUCT' dari popup atau background
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'SCRAPE_SHOPEE_PRODUCT' || request.action === 'GET_PRODUCT_INFO') {
      try {
        const result = scrapeShopeeProductData();
        sendResponse(result);
      } catch (err) {
        console.error('[Racun Social Scraper] Ralat ketika mengekstrak:', err);
        sendResponse({
          success: false,
          error: `Ralat Scraper: ${err.message || 'Ralat tidak diketahui'}`
        });
      }
    }
    // Return true menandakan asynchronous response handler sedia digunakan
    return true;
  });

})();
