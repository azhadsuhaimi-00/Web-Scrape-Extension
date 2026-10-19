# ⚡ Shopee to Threads Script Generator (Racun Social AI)

> A high-performance **Chrome & Edge Extension (Manifest V3)** that scrapes Shopee Malaysia product listings and automatically crafts viral, high-converting **3-Step Instagram Threads marketing scripts** powered by **Google Gemini Flash AI**.

---

## 🌟 Overview

**Shopee to Threads Script Generator** (internally branded as *"Racun Social"*) is built for affiliate marketers, content creators, and social media managers who want to turn standard Shopee product links into viral social media content effortlessly.

Unlike generic AI generators that output stiff, formal, or robotic marketing copy, this extension utilizes a finely tuned system prompt designed to speak in authentic, conversational **Malaysian colloquial slang** (*bahasa santai lepak mamak*). It grabs reader attention, highlights real everyday pain points, and seamlessly drives traffic to affiliate links without triggering aggressive sales resistance.

---

## 🚀 Key Features

- **⚡ Resilient Shopee Web Scraper (`content.js`)**
  - Extracts rich structured metadata using Schema.org `application/ld+json`.
  - Multi-tier fallback selectors for dynamic Shopee DOM layouts (product title, technical specifications, description, and canonical URL).
  - Automatically filters and cleans messy tracking query strings from product URLs.

- **🧠 Google Gemini Flash AI Engine (`background.js`)**
  - Primary model: **`gemini-3.6-flash`** for ultra-fast response times and high contextual comprehension.
  - Multi-model fallback chain: Automatically cascades to `gemini-3.5-flash`, `gemini-2.5-flash-lite`, and `gemini-flash-latest` in case of rate limits or service interruptions.
  - Strict JSON schema enforcement ensuring clean, guaranteed fields (`hook`, `solution`, `cta`, `fullThread`).

- **🎯 Proven 3-Step Social Content Formula**
  - **Step 1 (Hook):** Relatable storytelling, funny daily complaints, or situational humor that stops the doomscroll. *Strictly zero prices or affiliate links.*
  - **Step 2 (Solution):** Breakdown of how the product fixes the issue based on real specs, written in friendly, witty banter.
  - **Step 3 (Call to Action):** Direct, playful prompt to check out the product with dynamic `[Link Affiliate]` injection.

- **🛡️ Strict Negative Constraints (Anti-Ban & Natural Feel)**
  - **No Pricing:** Never reveals prices (no RM, cents, or price estimates) to evoke curiosity and maintain affiliate compliance.
  - **Banned Words Filter:** Enforces a ban on cliché/overused phrases (e.g., *"barang sampai"*, *"skodeng"*, *"usap"*).

- **🔒 Flexible & Secure Key Management**
  - Supports private configuration via `config.js` (excluded from git via `.gitignore`).
  - Built-in Settings Drawer in the popup with `chrome.storage.local` persistence, visibility toggles, and live API connection testing.

- **💾 Auto-Save State & Clipboard Shortcuts**
  - Preserves your generated thread in local storage so you never lose work if the popup window closes accidentally.
  - One-click copy buttons for individual steps or the complete combined thread.

- **🎨 Modern Glassmorphism Neon Interface**
  - Built with custom Vanilla CSS featuring a cyberpunk dark aesthetic, smooth micro-animations, loading skeletons, and real-time page detection status.

---

## 📂 Project Architecture

```plaintext
Web Scrape Extension/
├── manifest.json         # Chrome Extension Manifest V3 configuration
├── background.js         # Service Worker handling Gemini API & fallback engine
├── content.js            # Content script injecting scraper into Shopee pages
├── popup.html            # Extension popup user interface
├── popup.js              # UI controller, state persistence, & tab communication
├── styles.css            # Custom CSS styling (Neon Glassmorphism design)
├── config.example.js     # Template for private configuration
├── config.js             # Local API configuration (gitignored, keep secret!)
├── .gitignore            # Git exclusion rules for private keys & OS files
├── generate_icons.js     # Standalone script to generate PNG extension icons
├── icons/                # Extension icon assets (16x16, 48x48, 128x128)
└── README.md             # Project documentation
```

---

## 🛠️ Installation & Setup

### Prerequisites
1. **Google Chrome**, **Microsoft Edge**, or **Brave Browser** (Chromium-based).
2. A free **Google Gemini API Key** from [Google AI Studio](https://aistudio.google.com/).

---

### Step 1: Clone or Download the Project
```bash
git clone https://github.com/azhadsuhaimi-00/Web-Scrape-Extension.git
cd "Web Scrape Extension"
```

---

### Step 2: Configure Your Gemini API Key

You can configure your API key in **either** of two ways:

#### Option A: Local Config File (Recommended for Developers)
1. Copy `config.example.js` to create `config.js`:
   ```bash
   cp config.example.js config.js
   ```
2. Open `config.js` and paste your Gemini API key:
   ```javascript
   export const GEMINI_API_KEY = "AIzaSyYourActualKeyHere...";
   ```
   *(Note: `config.js` is automatically ignored by Git via `.gitignore`, keeping your key safe from public commits).*

#### Option B: Extension Popup Settings (No Coding Required)
1. Open the extension popup in your browser.
2. Click the gear icon (**⚙️**) in the top right corner.
3. Paste your Gemini API key into the input field.
4. Click **Uji Sambungan** to verify the key, then click **Simpan Kunci**.

---

### Step 3: Load the Extension into Chromium

1. Open your browser and navigate to `chrome://extensions/` (or `edge://extensions/`).
2. Toggle on **Developer mode** (usually in the top right corner).
3. Click the **Load unpacked** button.
4. Select the folder: `c:\Users\User\PulseLabs\Web Scrape Extension` (or your repository folder).
5. The **Shopee to Threads Script Generator** icon will appear in your extensions bar!

---

## 📖 How to Use

1. **Browse Shopee:** Navigate to any product listing page on [Shopee Malaysia](https://shopee.com.my/) (e.g., `https://shopee.com.my/product/...`).
2. **Open Extension:** Click the **Racun Social** icon in your browser toolbar.
3. **Verify Product:** The extension automatically scans the active tab and displays the detected product title.
4. **Add Affiliate Link (Optional):** Paste your custom Shopee Affiliate shortlink into the input field. If left blank, the original clean product link is used.
5. **Generate Script:** Click the neon **"Jana Skrip Threads (3-Step)"** button.
6. **Review & Copy:**
   - Review **Mesej 1 (Hook)**, **Mesej 2 (Solution)**, and **Mesej 3 (CTA)**.
   - Click **Salin** on any individual card or click **Salin Semua Skrip Threads** to copy the formatted thread directly to your clipboard.
7. **Post to Threads:** Paste the content directly onto [Threads.net](https://threads.net) as a sequential 3-part thread!

---

## 🔒 Security & Git Push Protection

If you previously encountered a GitHub error stating:
> `remote: error: GH013: Repository rule violations found for refs/heads/main.`  
> `remote: - GITHUB PUSH PROTECTION: Detected Google AI / Gemini API Key`

This occurs when an API key was committed into Git history. To fix this:

1. Ensure your secret key is in `config.js` (and `config.js` is in `.gitignore`).
2. Verify that `background.js` does **not** contain any hardcoded API key.
3. Amend your previous commit to remove the key from Git history:
   ```bash
   git add .
   git commit --amend -m "Initial commit with secure config and documentation"
   git push -u origin main --force
   ```

---

## ⚙️ Technical Specifications

| Parameter | Detail |
| :--- | :--- |
| **Manifest Version** | Manifest V3 |
| **Language** | Vanilla JavaScript (ES Modules), HTML5, CSS3 |
| **Target Website** | `https://shopee.com.my/*` |
| **AI Model Support** | `gemini-3.6-flash`, `gemini-3.5-flash`, `gemini-2.5-flash-lite`, `gemini-flash-latest` |
| **Permissions** | `activeTab`, `scripting`, `storage`, `clipboardWrite` |
| **Host Permissions** | `https://*.shopee.com.my/*`, `https://generativelanguage.googleapis.com/*` |

---

## 📄 License & Disclaimer

This project is open-source and intended for educational, personal productivity, and marketing automation purposes. 

*Shopee* is a trademark of Shopee Pte. Ltd. This extension is an independent tool and is not officially affiliated with, endorsed by, or connected to Shopee or Meta (Threads). Always adhere to Shopee's affiliate terms of service and social media community guidelines.
