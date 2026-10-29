# FlyPig 🐷✨
> **Personal finance web application for people managing their money for the first time.**

FlyPig helps young adults, university students, expats, and first-time earners answer the essential question:
> **“How am I doing financially this month, and how much can I actually afford to spend right now?”**

Unlike traditional budgeting apps that scold users after money is already spent, FlyPig provides **forward-looking, non-judgmental financial clarity** with dynamic daily pacing, safe purchase simulations, and clear distinction between planned savings and leftover cash.

---

## 🚀 Quick Start (Running Locally)

**Zero build step. Zero installations. 100% offline.**

### 1. Direct Double-Click (Recommended & Easiest)
Simply double-click [`index.html`](file:///c:/Users/Usuario/Documents/Miguel/FlyPig/index.html) in your file manager to open it in any browser (Chrome, Edge, Firefox, Safari).
It works immediately out of the box with `file:///` without any CORS restrictions!

### 2. Optional: Local HTTP Server
If you prefer running through a local web server:
```bash
# Option A: Python 3
python -m http.server 8000

# Option B: Node.js (npx)
npx serve .
```
Then visit `http://localhost:8000`.

---

## 📦 Dependency Policy

**External Dependencies: ZERO.**

* **No frameworks** (no React, Vue, Angular, Svelte).
* **No external CSS/Font CDNs** (all styling, responsive rules, and SVG icons are natively self-contained).
* **No external chart libraries** (crisp, lightweight CSS and SVG visualizations).
* **No backend or cloud APIs** required. Everything runs locally in the client.

---

## 🗄️ How Data is Stored

FlyPig uses the browser's native **`localStorage`** under the key `FLYPIG_DATA_V1`.

* **Privacy First:** Your financial numbers never leave your computer.
* **Persistent:** Data remains saved when you close the tab or reboot your device.
* **Integer Cents Representation:** All monetary amounts are stored and calculated internally as integer cents (e.g., €150.00 is stored as `15000`) to completely eliminate JavaScript floating-point rounding errors (`0.1 + 0.2 != 0.3`).
* **Backup & Migration:** Built-in JSON export and import options allow users to back up their data or move it between devices.

### How to Reset Local Data
* **In the App:** Navigate to **Plan & Setup** &rarr; click **Reset All Data**.
* **Via DevTools:** Open your browser console (`F12`) and run:
  ```javascript
  localStorage.removeItem('FLYPIG_DATA_V1');
  location.reload();
  ```

---

## 📁 Project Structure

```text
FlyPig/
├── index.html                           # Semantic markup, 5 app views, dialogs & modals
├── style.css                            # Clean, mobile-first design system & fluid layout
├── js/
│   ├── calculations.js                  # Pure financial math (cents-accurate, pace, simulator)
│   ├── store.js                         # Persistence, month CRUD, and store autocomplete
│   ├── ui.js                            # DOM presentation, reactive updates, formatters
│   └── app.js                           # Event controllers, quick entry, and onboarding flow
├── tests/
│   └── test_calculations_and_store.mjs  # Automated Node test suite verifying 43 test assertions
└── README.md                            # Documentation & architecture guide
```

---

## 💡 Important Product Principles & Design Decisions

1. **Non-Judgmental Guidance:**
   * Spending is never moralized. FlyPig explains the consequence (*“You can afford this, but it reduces your daily margin to €6.20/day”*) rather than forbidding purchases.
2. **Planned Savings $\neq$ Leftover Cash:**
   * Planned savings are allocated upfront:
     $$\text{Variable Budget} = \text{Income} - \text{Fixed Bills} - \text{Planned Essentials} - \text{Planned Savings}$$
   * Money remaining at the end of the month is treated as unspent surplus, not accidental savings.
3. **Dynamic Daily Pace:**
   * If a user spends less than their recommended pace today, the unspent capacity naturally rolls forward to future days without friction.
4. **Extraordinary & Emergency Expenses are Not Failures:**
   * Unexpected life events (urgent dental visit, laptop repair) can be flagged as `Extraordinary` or `Emergency`. FlyPig accounts for them as absorbed by savings or buffer rather than declaring a "failed budget."
5. **No-Risk "What-If" Purchase Simulator:**
   * Users can test purchases (e.g. *“Weekend trip to Paris for €280”*) to see the exact before-and-after impact on their daily pace and savings without modifying real expense data.
6. **Future Price Intelligence Ready:**
   * Every expense records an associated store/place (`REWE`, `Penny`, `Lidl`, `dm`, `Amazon`), laying the architectural foundation for future price comparisons across retailers.

---

## 🧪 Automated Testing

An automated test suite is included in `tests/test_calculations_and_store.mjs` covering:
* Cents-level rounding and floating-point bug prevention.
* Comma and period decimal string normalization (`8,50` $\rightarrow$ `850`).
* Dynamic pace and remaining days calculation.
* Extraordinary/Emergency expense isolation.
* What-if simulation isolation (asserting zero mutations on real expense arrays).
* Month transition, month copying, and historical month preservation.
* Edge cases: €0 expenses, zero income, zero planned savings, and massive purchases.

Run the tests anytime using Node.js:
```bash
node tests/test_calculations_and_store.mjs
```

---

## ⚠️ Known MVP Limitations

* **Single Browser Profile:** Since data lives in `localStorage`, data is specific to the browser profile where it was entered (export/import is provided for cross-device migration).
* **Manual Entry:** In line with the MVP specification, there is no direct bank synchronization or automated SMS scraping.
* **Single Active Currency per Month:** Changing currency updates the display symbol for all entries in that workspace.

---

## 🔮 Roadmap & Future Improvements

1. **Price Intelligence Engine:** Suggesting the cheapest recorded supermarket for repeat staples (e.g., Milk at Penny vs. REWE).
2. **Receipt Scanning (OCR):** Quick photo upload that automatically extracts retailer, line items, and totals.
3. **Specific Goal Buckets:** Sinking funds for targeted goals (e.g., *Summer Vacation*, *MacBook Fund*, *Emergency Buffer*).
4. **End-of-Month Rollover Allocations:** Interactive flow at month close prompting the user where to assign leftover cash.
5. **PWA (Progressive Web App):** Installable to home screens with full offline manifest and service worker.
