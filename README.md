# CFTC Commitment of Traders (COT) Reports & Orderflow Analytics [TypeScript] 📈

A high-performance, serverless **Apify Actor** built with **TypeScript & Node.js** that scrapes, cleans, and analyzes weekly **Commitment of Traders (COT)** reports from the official [U.S. Commodity Futures Trading Commission (CFTC)](https://www.cftc.gov/).

Designed for Forex traders, Crypto analysts, Commodity funds, and Algorithmic trading systems seeking **Smart Money Orderflow** data.

---

## 🚀 Features

- **Multi-Asset Coverage (20+ Assets):**
  - **Forex:** EUR, JPY, GBP, AUD, NZD, CAD, CHF, USD, MXN, BRL, ZAR.
  - **Cryptocurrencies:** Bitcoin (BTC), Ethereum (ETH).
  - **Metals & Energy:** Gold (GOLD), Silver (SILVER), Copper (COPPER), Crude Oil (OIL), Natural Gas (GAS).
  - **Indices:** S&P 500, NASDAQ-100, Dow Jones.
- **Smart Money Metrics:**
  - `long_positions` & `short_positions` (Non-Commercial positions).
  - `change_long` & `change_short` (Weekly position injection/unwinding).
  - `net_position` ($Long - Short$).
- **Institutional Orderflow Rankings:** Computes weekly institutional buying/selling pressure rankings against historical records.
- **AI & MCP Ready:** Fully compatible with Claude, Cursor, and AI agents via the **Model Context Protocol (MCP)**.
- **Output Formats:** JSON, CSV, Excel, XML.

---

## 📥 Input Configuration

```json
{
  "assets": ["GOLD", "EUR", "BTC", "OIL"],
  "categories": ["ALL"],
  "years": [2025, 2026],
  "includeRankings": true,
  "outputFormat": "flat_records"
}
```

---

## 🤖 Using with Apify Client in JavaScript / TypeScript

```typescript
import { ApifyClient } from 'apify-client';

const client = new ApifyClient({
    token: 'YOUR_APIFY_TOKEN',
});

// Start the Actor and wait for it to finish
const run = await client.actor('khalid-naami/cftc-cot-reports-ts').call({
    assets: ['GOLD', 'EUR', 'BTC'],
    years: [2025, 2026],
});

// Fetch results
const { items } = await client.dataset(run.defaultDatasetId).listItems();
console.log(items);
```

---

## 🛠️ Local Development

```bash
# 1. Install dependencies
npm install

# 2. Run locally in dev mode
npm run start:dev

# 3. Build production bundle
npm run build
```
