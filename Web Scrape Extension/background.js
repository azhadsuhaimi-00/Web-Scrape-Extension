/**
 * Shopee to Threads Script Generator - background.js
 * Service Worker Manifest V3 untuk Chrome/Edge Extension
 * Mengendalikan panggilan Google Gemini API v1beta (gemini-3.6-flash & fallbacks)
 */

console.log('[Racun Social v1.0.1] Service Worker dimulakan dengan model gemini-3.6-flash.');

/**
 * Dapatkan API key yang sah:
 * 1. Muatkan daripada fail konfigurasi tempatan (config.js) jika wujud
 * 2. Atau semak chrome.storage.local jika pengguna memasukkan melalui Popup Settings
 */
async function getEffectiveApiKey() {
  // 1. Cuba dapatkan daripada fail tempatan config.js
  try {
    const config = await import('./config.js');
    if (config && config.GEMINI_API_KEY && typeof config.GEMINI_API_KEY === 'string') {
      const trimmed = config.GEMINI_API_KEY.trim();
      if (
        trimmed !== '' &&
        trimmed !== 'MASUKKAN_API_KEY_ANDA_DI_SINI' &&
        !trimmed.includes('MASUKKAN_API_KEY') &&
        !trimmed.includes('YOUR_GEMINI_API_KEY')
      ) {
        return trimmed;
      }
    }
  } catch (_) {
    // config.js pilihan sahaja (tidak dijumpai jika belum disalin daripada config.example.js)
  }

  // 2. Semak jika pengguna memasukkan API Key melalui antaramuka Popup Settings
  const stored = await chrome.storage.local.get(['custom_gemini_api_key']);
  if (stored.custom_gemini_api_key && stored.custom_gemini_api_key.trim().length > 5) {
    return stored.custom_gemini_api_key.trim();
  }

  return null;
}

/**
 * Bina System Prompt dan User Prompt mengikut spesifikasi ketat 'Racun Social'
 */
function buildGeminiPayload(productData) {
  const { title, specifications, description, productUrl } = productData;

  const systemInstruction = `
Anda ialah pencipta kandungan (content creator) profesional di sebalik akaun Threads popular bernama "Racun Social".

PERWATAKAN & GAYA BAHASA:
- Bahasa: Bahasa Melayu pasar harian yang SANGAT SANTAI (gaya lepak borak dengan kawan rapat kat kedai mamak waktu malam).
- Nada: Bersahaja, kelakar, usik-mengusik, bersahabat, sedikit provokatif tapi mesra (contoh: "Korang ada tak perangai macam ni...", "Weyh sumpah aku baru perasan...", "Aku ingatkan aku sorang je kena...").
- JANGAN SEKALI-KALI nampak skema, formal, kaku, atau bunyi seperti ayat bot/AI korporat.
- Guna singkatan dan slanga Melayu santai yang lazim digunakan di media sosial (cth: korang, kitorang, weyh, dorang, min, member, serabut, auto, layan, ngam, padu).

SYARAT KETAT (CRITICAL RULES):
1. DILARANG SAMA SEKALI sebut atau paparkan sebarang harga produk (tiada RM, tiada sen, tiada anggaran harga).
2. DILARANG KERAS menggunakan perkataan "barang sampai", perkataan "skodeng", atau perkataan "usap".
3. Struktur wajib adalah FORMAT 3-STEP THREAD:
   - MESEJ 1 (HOOK): Fokus kepada penceritaan masalah harian, emosi serabut, atau perangai kelakar/relatable manusia yang biasa dialami. JANGAN sebut link affiliate dan JANGAN sebut harga di sini.
   - MESEJ 2 (SOLUTION): Kupas bagaimana barang ini menyelesaikan masalah tadi berasaskan fungsi dan spesifikasinya secara santai. Selitkan usikan atau humor relatable.
   - MESEJ 3 (CTA): Gaya direct & mengusik untuk ajak pembaca tekan link affiliate. Letakkan tag [Link Affiliate] di hujung ayat CTA. Contoh: "Mana yang selalu [nyatakan masalah] & nak [kelebihan barang], klik link kat sini sebelum stok habis: [Link Affiliate]".

FORMAT OUTPUT WAJIB:
Sila kembalikan jawapan HANYA dalam format JSON tulen (tanpa sebarang teks markdown di luar blok JSON) dengan format objek berikut:
{
  "hook": "Teks Mesej 1 (Hook relatable santai)",
  "solution": "Teks Mesej 2 (Penerangan fungsi/spesifikasi bersahaja)",
  "cta": "Teks Mesej 3 (CTA direct + [Link Affiliate])",
  "fullThread": "Gabungan penuh Mesej 1, Mesej 2, dan Mesej 3 yang disusun kemas dengan pemisah line break berganda"
}
`.trim();

  const userPrompt = `
Sila jana skrip Threads 3-Step Racun Social untuk produk Shopee Malaysia berikut:

[TAJUK PRODUK]:
${title}

[SPESIFIKASI PRODUK]:
${specifications}

[DESKRIPSI PRODUK]:
${description}

[LINK PRODUK ASAL]:
${productUrl}

Ingat syarat wajib:
1. Tiada harga langsung.
2. Tiada perkataan "barang sampai", "skodeng", atau "usap".
3. Ikuti format JSON yang diminta.
`.trim();

  return {
    contents: [
      {
        role: "user",
        parts: [
          { text: `${systemInstruction}\n\n---\n\n${userPrompt}` }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.85,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
      responseSchema: {
        type: "OBJECT",
        properties: {
          hook: { type: "STRING", description: "Teks Mesej 1 (Hook relatable santai tanpa link atau harga)" },
          solution: { type: "STRING", description: "Teks Mesej 2 (Penerangan fungsi & spesifikasi bersahaja + usikan)" },
          cta: { type: "STRING", description: "Teks Mesej 3 (CTA direct ajak klik + [Link Affiliate])" },
          fullThread: { type: "STRING", description: "Gabungan penuh Mesej 1, 2, dan 3 yang disusun kemas" }
        },
        required: ["hook", "solution", "cta", "fullThread"]
      }
    }
  };
}

/**
 * Senarai model Gemini mengikut keutamaan (Google telah menamatkan sokongan 1.5 dan mengesyorkan 3.6-flash)
 */
const SUPPORTED_MODELS = [
  "gemini-3.6-flash",
  "gemini-3.5-flash",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest"
];

/**
 * Fungsi Pengurai (Parser) Tahan Lasak untuk menjamin Hook, Solution & CTA sentiasa terhasil
 */
function parseGeminiResponse(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return { hook: "", solution: "", cta: "", fullThread: "" };
  }

  // 1. Buang sebarang markdown code block fences (cth: ```json ... ```)
  const cleaned = rawText
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  // 2. Percubaan JSON.parse secara terus
  try {
    const obj = JSON.parse(cleaned);
    if (obj && (obj.hook || obj.solution || obj.cta)) {
      return {
        hook: obj.hook || "",
        solution: obj.solution || "",
        cta: obj.cta || "",
        fullThread: obj.fullThread || `${obj.hook || ""}\n\n${obj.solution || ""}\n\n${obj.cta || ""}`.trim()
      };
    }
  } catch (_) {}

  // 3. Ekstrak blok JSON { ... } jika ada teks pengenalan di luar
  const firstBrace = cleaned.indexOf("{");
  const lastBrace = cleaned.lastIndexOf("}");
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = cleaned.slice(firstBrace, lastBrace + 1);
    try {
      const obj = JSON.parse(candidate);
      if (obj && (obj.hook || obj.solution || obj.cta)) {
        return {
          hook: obj.hook || "",
          solution: obj.solution || "",
          cta: obj.cta || "",
          fullThread: obj.fullThread || `${obj.hook || ""}\n\n${obj.solution || ""}\n\n${obj.cta || ""}`.trim()
        };
      }
    } catch (_) {
      // Baiki unescaped literal newlines dalam nilai string JSON
      try {
        const fixedJson = candidate.replace(/"([^"\\]*(?:\\.[^"\\]*)*)"/gs, (match) => {
          return match.replace(/\r?\n/g, "\\n");
        });
        const obj = JSON.parse(fixedJson);
        if (obj && (obj.hook || obj.solution || obj.cta)) {
          return {
            hook: obj.hook || "",
            solution: obj.solution || "",
            cta: obj.cta || "",
            fullThread: obj.fullThread || `${obj.hook || ""}\n\n${obj.solution || ""}\n\n${obj.cta || ""}`.trim()
          };
        }
      } catch (_) {}
    }
  }

  // 4. Fallback Ekstraksi Regex khusus untuk kunci "hook", "solution", "cta"
  // Boleh mengekstrak nilai teks bersih walaupun tanda kurungan atau penutup string terpotong
  const extractField = (key, text) => {
    const reg = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)(?=(?:",\\s*"[a-zA-Z]+"|",?\\s*\\}|$))`, 'i');
    const match = text.match(reg);
    if (match && match[1]) {
      return match[1]
        .replace(/\\n/g, '\n')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
    }
    return '';
  };

  const h = extractField('hook', cleaned);
  const s = extractField('solution', cleaned);
  const c = extractField('cta', cleaned);

  if (h || s || c) {
    return {
      hook: h,
      solution: s,
      cta: c,
      fullThread: `${h}\n\n${s}\n\n${c}`.trim()
    };
  }

  // 5. Fallback pembahagian mengikut penanda Step / Mesej (cth: Mesej 1:, Step 1:)
  const stepParts = cleaned.split(/(?:Mesej|Step|Langkah)\s*[1-3]\s*[:\-\)]/i).map(p => p.trim()).filter(Boolean);
  if (stepParts.length >= 3) {
    return {
      hook: stepParts[0],
      solution: stepParts[1],
      cta: stepParts[2],
      fullThread: `${stepParts[0]}\n\n${stepParts[1]}\n\n${stepParts[2]}`
    };
  }

  // 6. Fallback pembersihan teks mentah (buang tanda JSON jika ada)
  const sanitizedFallback = cleaned
    .replace(/^\{[\s\S]*?"hook"\s*:\s*"/i, '')
    .replace(/"\s*\}?$/i, '')
    .trim();

  // 7. Fallback perenggan teks biasa jika model membalas perenggan bebas
  const paragraphs = sanitizedFallback.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
  if (paragraphs.length >= 3) {
    return {
      hook: paragraphs[0],
      solution: paragraphs.slice(1, paragraphs.length - 1).join("\n\n"),
      cta: paragraphs[paragraphs.length - 1],
      fullThread: sanitizedFallback
    };
  }

  return {
    hook: sanitizedFallback,
    solution: "",
    cta: "",
    fullThread: sanitizedFallback
  };
}

/**
 * Panggil Google Gemini API v1beta generateContent dengan sokongan fallback automatik
 */
async function callGeminiApi(payload, apiKey) {
  let lastError = null;

  for (const model of SUPPORTED_MODELS) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        let errorDetail = `HTTP Error ${response.status}`;
        try {
          const errJson = await response.json();
          if (errJson.error && errJson.error.message) {
            errorDetail = errJson.error.message;
          }
        } catch (_) {}
        lastError = new Error(`Ralat Gemini API (${model}): ${errorDetail}`);
        console.warn(`[Background] Model ${model} gagal, mencuba fallback seterusnya...`, errorDetail);
        continue;
      }

      const data = await response.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!rawText) {
        lastError = new Error(`Model ${model} tidak mengembalikan sebarang teks.`);
        continue;
      }

      // Gunakan parser kalis ralat
      const parsedResult = parseGeminiResponse(rawText);
      return parsedResult;
    } catch (netErr) {
      lastError = netErr;
      console.warn(`[Background] Ralat rangkaian pada model ${model}:`, netErr.message);
    }
  }

  throw lastError || new Error("Semua model Gemini yang disokong gagal dihubungi.");
}

/**
 * Listener arahan daripada popup.js
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "GENERATE_THREADS_SCRIPT") {
    (async () => {
      try {
        const apiKey = await getEffectiveApiKey();

        if (!apiKey) {
          sendResponse({
            success: false,
            error: "Gemini API Key belum dimasukkan! Sila masukkan API Key di dalam fail config.js atau masukkan dalam menu Tetapan di popup."
          });
          return;
        }

        const productData = request.payload;
        if (!productData || !productData.title) {
          sendResponse({
            success: false,
            error: "Data produk tidak lengkap untuk dihantar ke Gemini AI."
          });
          return;
        }

        const geminiPayload = buildGeminiPayload(productData);
        const result = await callGeminiApi(geminiPayload, apiKey);

        // Pastikan link asal Shopee digantikan ke dalam tag [Link Affiliate] jika perlu
        const affiliateLink = productData.affiliateUrl || productData.productUrl;
        if (result.cta && result.cta.includes('[Link Affiliate]')) {
          result.cta = result.cta.replace(/\[Link Affiliate\]/g, affiliateLink);
        }
        if (result.fullThread && result.fullThread.includes('[Link Affiliate]')) {
          result.fullThread = result.fullThread.replace(/\[Link Affiliate\]/g, affiliateLink);
        }

        sendResponse({
          success: true,
          data: result
        });
      } catch (err) {
        console.error("[Background Service Worker] Ralat penjanaan skrip:", err);
        sendResponse({
          success: false,
          error: err.message || "Ralat tidak diketahui semasa memanggil Gemini API."
        });
      }
    })();

    return true; // Asynchronous sendResponse
  }

  if (request.action === "VALIDATE_API_KEY") {
    (async () => {
      try {
        const testKey = request.apiKey || (await getEffectiveApiKey());
        if (!testKey) {
          sendResponse({ success: false, error: "Tiada API Key dikesan." });
          return;
        }

        // Panggilan ringan untuk mengesahkan kunci API
        const testUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash?key=${testKey}`;
        const resp = await fetch(testUrl);
        if (resp.ok) {
          sendResponse({ success: true });
        } else {
          const err = await resp.json();
          sendResponse({ success: false, error: err?.error?.message || "Kunci API tidak sah." });
        }
      } catch (e) {
        sendResponse({ success: false, error: e.message });
      }
    })();
    return true;
  }
});
