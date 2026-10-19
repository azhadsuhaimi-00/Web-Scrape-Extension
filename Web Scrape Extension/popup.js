/**
 * Shopee to Threads Script Generator - popup.js
 * Logik Pengendali Antaramuka Popup Extension
 * Komunikasi dengan Active Tab, Content Script & Background Service Worker
 * Dilengkapi dengan Auto-Save State (Skrip kekal walaupun popup ditutup)
 */

document.addEventListener('DOMContentLoaded', async () => {
  // Elemen DOM - Status & Halaman
  const statusDot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  const notShopeeWarning = document.getElementById('notShopeeWarning');
  const productPreviewSection = document.getElementById('productPreviewSection');
  const productTitleDisplay = document.getElementById('productTitleDisplay');
  const inputAffiliateLink = document.getElementById('inputAffiliateLink');
  const btnRescrape = document.getElementById('btnRescrape');
  const btnGenerateScript = document.getElementById('btnGenerateScript');
  const btnGenerateText = document.getElementById('btnGenerateText');

  // Elemen DOM - Loading & Output
  const loadingSkeleton = document.getElementById('loadingSkeleton');
  const errorCard = document.getElementById('errorCard');
  const errorMessage = document.getElementById('errorMessage');
  const outputSection = document.getElementById('outputSection');
  const contentStep1 = document.getElementById('contentStep1');
  const contentStep2 = document.getElementById('contentStep2');
  const contentStep3 = document.getElementById('contentStep3');
  const btnCopyAll = document.getElementById('btnCopyAll');
  const btnClearSaved = document.getElementById('btnClearSaved');
  const savedTag = document.getElementById('savedTag');

  // Elemen DOM - Tetapan Drawer
  const btnSettingsToggle = document.getElementById('btnSettingsToggle');
  const settingsDrawer = document.getElementById('settingsDrawer');
  const inputCustomApiKey = document.getElementById('inputCustomApiKey');
  const btnToggleKeyVisibility = document.getElementById('btnToggleKeyVisibility');
  const btnSaveApiKey = document.getElementById('btnSaveApiKey');
  const btnTestApiKey = document.getElementById('btnTestApiKey');
  const apiKeyStatusMessage = document.getElementById('apiKeyStatusMessage');

  // Toast Notification
  const toastNotification = document.getElementById('toastNotification');
  const toastMessage = document.getElementById('toastMessage');

  // Keadaan Tempatan (Local State)
  let currentProductData = null;
  let activeTabId = null;
  let fullThreadContent = '';

  // ========================================================================
  // 1. Permulaan & Pemulihan Skrip Yang Disimpan
  // ========================================================================
  await loadSavedApiKey();
  const hasSaved = await loadSavedScript();
  await checkActiveTabAndScrape(hasSaved);

  /**
   * Muatkan skrip sebelum ini dari chrome.storage.local supaya tidak hilang jika popup ditutup
   */
  async function loadSavedScript() {
    try {
      const stored = await chrome.storage.local.get(['saved_threads_script']);
      if (stored.saved_threads_script && stored.saved_threads_script.data) {
        const saved = stored.saved_threads_script;
        displayResults(saved.data, false); // Papar tanpa notifikasi toast

        if (saved.productTitle) {
          productTitleDisplay.textContent = saved.productTitle;
          productTitleDisplay.title = saved.productTitle;
          productPreviewSection.classList.remove('hidden');
        }

        if (saved.affiliateUrl && !inputAffiliateLink.value.trim()) {
          inputAffiliateLink.value = saved.affiliateUrl;
        }

        if (savedTag) savedTag.classList.remove('hidden');
        return true;
      }
    } catch (err) {
      console.warn('Gagal memuatkan skrip simpanan:', err);
    }
    return false;
  }

  // ========================================================================
  // 2. Fungsi Semakan Tab Aktif & Pengikisan (Scraping)
  // ========================================================================
  async function checkActiveTabAndScrape(hasSavedScript = false) {
    updateStatus('checking', 'Memeriksa tab Shopee...');

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab || !tab.url) {
        handleNonShopeeView(hasSavedScript, 'Tiada tab aktif dikesan.');
        return;
      }

      activeTabId = tab.id;
      const url = new URL(tab.url);

      if (!url.hostname.includes('shopee.com.my')) {
        handleNonShopeeView(hasSavedScript, 'Sila buka Shopee Malaysia (shopee.com.my).');
        return;
      }

      // Pengguna berada di Shopee Malaysia
      notShopeeWarning.classList.add('hidden');
      btnGenerateText.textContent = '⚡ Jana Skrip Threads (3-Step)';

      // Pastikan content script sedia ada
      await ensureContentScriptInjected(activeTabId);

      // Mula mengikis data produk dari DOM Shopee
      await performScrape(activeTabId);

    } catch (err) {
      console.error('Ralat ketika memulakan popup:', err);
      handleNonShopeeView(hasSavedScript, `Ralat: ${err.message || 'Gagal menyambung ke halaman'}`);
    }
  }

  /**
   * Mengendalikan paparan apabila pengguna berada di luar tab Shopee (cth: tab Threads)
   */
  function handleNonShopeeView(hasSavedScript, fallbackMessage) {
    if (hasSavedScript) {
      // Jika ada skrip tersimpan, JANGAN sembunyikan! Kekalkan untuk pengguna salin ke Threads
      updateStatus('ready', '📌 Paparan Skrip Tersimpan (Sedia Disalin)');
      notShopeeWarning.classList.add('hidden');
      btnGenerateScript.disabled = true;
      btnGenerateText.textContent = 'Buka Tab Shopee Untuk Jana Baru';
      btnRescrape.disabled = true;
    } else {
      setNonShopeeState(fallbackMessage);
    }
  }

  /**
   * Suntik content.js jika halaman telah dibuka sebelum extension dipasang
   */
  async function ensureContentScriptInjected(tabId) {
    try {
      await chrome.tabs.sendMessage(tabId, { action: 'GET_PRODUCT_INFO' });
    } catch (err) {
      console.log('Menyuntik content.js secara programatik...');
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ['content.js']
      });
      await new Promise(r => setTimeout(r, 200));
    }
  }

  /**
   * Menjalankan scraping melalui penghantaran mesej ke content script
   */
  async function performScrape(tabId) {
    updateStatus('checking', 'Sedang mengikis data produk Shopee...');
    btnRescrape.disabled = true;

    try {
      const response = await chrome.tabs.sendMessage(tabId, { action: 'SCRAPE_SHOPEE_PRODUCT' });

      if (response && response.success && response.data) {
        currentProductData = response.data;
        showProductPreview(currentProductData);
        updateStatus('ready', 'Shopee Malaysia Bersedia');
        btnGenerateScript.disabled = false;
        btnRescrape.disabled = false;
        hideError();
      } else {
        const errorMsg = response?.error || 'Gagal mengekstrak maklumat produk. Pastikan halaman Shopee siap dimuatkan.';
        updateStatus('error', 'Gagal Mengikis Halaman');
        showError('Pengikisan Gagal', errorMsg);
        btnRescrape.disabled = false;
      }
    } catch (err) {
      console.error('Ralat komunikasi content.js:', err);
      updateStatus('error', 'Ralat Sambungan Tab');
      showError('Ralat Sambungan', 'Sila refresh halaman produk Shopee dan buka semula extension ini.');
      btnRescrape.disabled = false;
    }
  }

  function showProductPreview(data) {
    notShopeeWarning.classList.add('hidden');
    productPreviewSection.classList.remove('hidden');

    productTitleDisplay.textContent = data.title || 'Tajuk produk tidak ditemui';
    productTitleDisplay.title = data.title;

    if (!inputAffiliateLink.value.trim()) {
      inputAffiliateLink.value = data.productUrl || '';
    }
  }

  function setNonShopeeState(msg) {
    updateStatus('error', msg || 'Bukan Shopee Malaysia');
    notShopeeWarning.classList.remove('hidden');
    productPreviewSection.classList.add('hidden');
    btnGenerateScript.disabled = true;
    btnRescrape.disabled = true;
  }

  function updateStatus(type, message) {
    statusDot.className = 'status-dot';
    if (type === 'checking') statusDot.classList.add('dot-checking');
    if (type === 'ready') statusDot.classList.add('dot-ready');
    if (type === 'error') statusDot.classList.add('dot-error');
    statusText.textContent = message;
  }

  // ========================================================================
  // 3. Logik Penjanaan Skrip Threads (Panggilan ke background.js)
  // ========================================================================
  btnGenerateScript.addEventListener('click', async () => {
    if (!currentProductData) {
      showError('Data Hilang', 'Tiada data produk untuk dijana. Sila imbas semula.');
      return;
    }

    const customAffiliate = inputAffiliateLink.value.trim();
    const payload = {
      ...currentProductData,
      affiliateUrl: customAffiliate || currentProductData.productUrl
    };

    hideError();
    outputSection.classList.add('hidden');
    loadingSkeleton.classList.remove('hidden');
    btnGenerateScript.disabled = true;
    btnGenerateText.textContent = 'Menjana Idea Mamak...';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'GENERATE_THREADS_SCRIPT',
        payload
      });

      loadingSkeleton.classList.add('hidden');
      btnGenerateScript.disabled = false;
      btnGenerateText.textContent = '⚡ Jana Skrip Threads (3-Step)';

      if (response && response.success && response.data) {
        // Paparkan hasil
        displayResults(response.data, true);

        // Simpan secara automatik ke chrome.storage.local supaya tidak hilang jika popup ditutup
        await chrome.storage.local.set({
          saved_threads_script: {
            data: response.data,
            productTitle: currentProductData.title || '',
            affiliateUrl: payload.affiliateUrl || '',
            timestamp: Date.now()
          }
        });

        if (savedTag) savedTag.classList.remove('hidden');
      } else {
        const errMsg = response?.error || 'Gemini API gagal memberikan jawapan.';
        showError('Gagal Menjana Skrip', errMsg);
      }
    } catch (err) {
      loadingSkeleton.classList.add('hidden');
      btnGenerateScript.disabled = false;
      btnGenerateText.textContent = '⚡ Jana Skrip Threads (3-Step)';
      showError('Ralat Sistem', err.message || 'Gagal berkomunikasi dengan background service worker.');
    }
  });

  /**
   * Paparkan hasil 3-Step Thread ke dalam UI
   */
  function displayResults(data, notify = true) {
    contentStep1.textContent = data.hook || '';
    contentStep2.textContent = data.solution || '';
    contentStep3.textContent = data.cta || '';

    fullThreadContent = data.fullThread || `${data.hook || ''}\n\n${data.solution || ''}\n\n${data.cta || ''}`.trim();

    outputSection.classList.remove('hidden');

    if (notify) {
      outputSection.scrollIntoView({ behavior: 'smooth' });
      showToast('Skrip Threads berjaya dijana & disimpan!');
    }
  }

  // ========================================================================
  // 4. Logik Padam / Kosongkan Skrip Tersimpan
  // ========================================================================
  if (btnClearSaved) {
    btnClearSaved.addEventListener('click', async () => {
      await chrome.storage.local.remove(['saved_threads_script']);
      contentStep1.textContent = '';
      contentStep2.textContent = '';
      contentStep3.textContent = '';
      fullThreadContent = '';
      outputSection.classList.add('hidden');
      if (savedTag) savedTag.classList.add('hidden');
      showToast('Skrip simpanan telah dikosongkan.');

      // Jika di Shopee, pulihkan teks butang jana
      if (currentProductData) {
        btnGenerateScript.disabled = false;
        btnGenerateText.textContent = '⚡ Jana Skrip Threads (3-Step)';
      }
    });
  }

  // ========================================================================
  // 5. Logik Salin (Copy to Clipboard)
  // ========================================================================
  // Salin setiap langkah individu
  document.querySelectorAll('.btn-copy-step').forEach(btn => {
    btn.addEventListener('click', async () => {
      const targetId = btn.getAttribute('data-target');
      const targetEl = document.getElementById(targetId);
      if (!targetEl) return;

      const textToCopy = targetEl.textContent.trim();
      if (!textToCopy) return;

      await copyTextToClipboard(textToCopy);

      const originalText = btn.textContent;
      btn.textContent = 'Disalin! ✓';
      btn.style.color = '#00ff87';

      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.color = '';
      }, 2000);

      showToast('Langkah ini disalin ke clipboard!');
    });
  });

  // Salin Keseluruhan Thread (Full 3-Step)
  btnCopyAll.addEventListener('click', async () => {
    if (!fullThreadContent) {
      const p1 = contentStep1.textContent.trim();
      const p2 = contentStep2.textContent.trim();
      const p3 = contentStep3.textContent.trim();
      fullThreadContent = `${p1}\n\n${p2}\n\n${p3}`.trim();
    }

    if (!fullThreadContent.trim()) return;

    await copyTextToClipboard(fullThreadContent.trim());

    const originalText = btnCopyAll.textContent;
    btnCopyAll.textContent = '✓ Semua Mesej Disalin!';
    btnCopyAll.style.background = '#00ff87';
    btnCopyAll.style.color = '#080c14';

    setTimeout(() => {
      btnCopyAll.textContent = originalText;
      btnCopyAll.style.background = '';
      btnCopyAll.style.color = '';
    }, 2500);

    showToast('Semua 3 Mesej disalin serentak!');
  });

  async function copyTextToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
  }

  // ========================================================================
  // 6. Imbas Semula (Re-scrape)
  // ========================================================================
  btnRescrape.addEventListener('click', async () => {
    if (activeTabId) {
      await performScrape(activeTabId);
    } else {
      await checkActiveTabAndScrape();
    }
  });

  // ========================================================================
  // 7. Pengurusan Tetapan & Google Gemini API Key
  // ========================================================================
  btnSettingsToggle.addEventListener('click', () => {
    settingsDrawer.classList.toggle('hidden');
  });

  btnToggleKeyVisibility.addEventListener('click', () => {
    const isPassword = inputCustomApiKey.type === 'password';
    inputCustomApiKey.type = isPassword ? 'text' : 'password';
    btnToggleKeyVisibility.textContent = isPassword ? '🔒' : '👁️';
  });

  async function loadSavedApiKey() {
    const data = await chrome.storage.local.get(['custom_gemini_api_key']);
    if (data.custom_gemini_api_key) {
      inputCustomApiKey.value = data.custom_gemini_api_key;
    }
  }

  btnSaveApiKey.addEventListener('click', async () => {
    const keyVal = inputCustomApiKey.value.trim();
    await chrome.storage.local.set({ custom_gemini_api_key: keyVal });

    setApiKeyStatus('Kunci API disimpan!', 'success');
    showToast('Tetapan API berjaya disimpan.');
    setTimeout(() => {
      apiKeyStatusMessage.textContent = '';
    }, 3000);
  });

  btnTestApiKey.addEventListener('click', async () => {
    const keyVal = inputCustomApiKey.value.trim();
    setApiKeyStatus('Menguji sambungan...', '');

    try {
      const resp = await chrome.runtime.sendMessage({
        action: 'VALIDATE_API_KEY',
        apiKey: keyVal
      });

      if (resp && resp.success) {
        setApiKeyStatus('Sambungan Gemini API Berjaya! 🚀', 'success');
      } else {
        setApiKeyStatus(`Gagal: ${resp?.error || 'Kunci tidak sah'}`, 'error');
      }
    } catch (e) {
      setApiKeyStatus(`Ralat: ${e.message}`, 'error');
    }
  });

  function setApiKeyStatus(msg, stateClass) {
    apiKeyStatusMessage.textContent = msg;
    apiKeyStatusMessage.className = `status-msg ${stateClass}`;
  }

  // ========================================================================
  // 8. Notifikasi Ralat & Toast
  // ========================================================================
  function showError(title, msg) {
    document.getElementById('errorTitle').textContent = title;
    errorMessage.textContent = msg;
    errorCard.classList.remove('hidden');
    errorCard.scrollIntoView({ behavior: 'smooth' });
  }

  function hideError() {
    errorCard.classList.add('hidden');
  }

  let toastTimer = null;
  function showToast(msg) {
    toastMessage.textContent = msg;
    toastNotification.classList.remove('hidden');

    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toastNotification.classList.add('hidden');
    }, 2800);
  }
});
