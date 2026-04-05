# ⚔️ RoK KvK Dashboard

A free, open-source performance dashboard for **Rise of Kingdoms** KvK (Kingdom vs. Kingdom) events.
No account, no backend, no cost — just upload your CSV exports and share the link.

[![GitHub Pages](https://img.shields.io/badge/Live%20Demo-GitHub%20Pages-blue?style=flat-square)](https://YOUR_USERNAME.github.io/rok-kvk-dashboard/)

---

## Features

| Feature | Details |
|---------|---------|
| **Delta tracking** | Upload a KvK-start and KvK-end CSV to see exactly how much each governor contributed |
| **Snapshot mode** | Works with a single CSV too |
| **Rankings table** | Sortable by Kill Points, T5 Kills, T4 Kills, Deaths, Power, K/D |
| **Progress bars** | Visual relative-performance bars per cell |
| **K/D ratio** | Auto-calculated with colour coding (green / yellow / red) |
| **Charts** | Top-10 horizontal bar charts for all key metrics |
| **URL sharing** | Data is compressed into the URL — share a single link and everyone sees the same data |
| **EN / 日本語** | Full English and Japanese UI with one-click toggle |
| **Alliance filter** | Filter the table by alliance |
| **No dependencies** | Pure static site; CDN libraries loaded from cloudflare |

---

## Getting Started

### Using the live site

1. Open the dashboard URL
2. *(Optional)* Enter a KvK name / season label
3. Export your **Kingdom Member Data** CSV from inside the game at **KvK start** and **KvK end**
4. Upload both files
5. Click **Show Dashboard**
6. Use **Share** to generate a URL you can send to alliance members

### Running locally

No build step required — open `index.html` directly in your browser.

```bash
git clone https://github.com/YOUR_USERNAME/rok-kvk-dashboard.git
cd rok-kvk-dashboard
open index.html        # macOS
# or: python3 -m http.server 8080   # serve via local HTTP
```

> **Note:** Because the JS files use ES modules (`import`/`export`), browsers block
> them when opened as `file://`. Use the `python3 -m http.server` approach or any
> other local HTTP server.

---

## Deploying to GitHub Pages

1. Fork / push this repo to your GitHub account
2. Go to **Settings → Pages**
3. Set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)`
4. Save — GitHub will publish the site at `https://YOUR_USERNAME.github.io/rok-kvk-dashboard/`

---

## CSV Format

The dashboard auto-detects column names. It recognises the standard
**Kingdom Member Data** export from Rise of Kingdoms, including common
column name variations across game locales.

| Detected columns | Internal field |
|-----------------|---------------|
| Governor ID / ID | `id` |
| Governor Name / Name / Nickname | `name` |
| Alliance Name / Alliance | `alliance` |
| Power | `power` |
| Kill Points / Killpoints | `kp` |
| T5 Kills / T5kills / Tier5 Kills | `t5kills` |
| T4 Kills / T4kills / Tier4 Kills | `t4kills` |
| Deaths / Dead / Troops Lost | `deaths` |

Any extra columns are safely ignored.

---

## Project Structure

```
rok-kvk-dashboard/
├── index.html          # HTML shell — structure only, no inline logic
├── css/
│   └── styles.css      # All styles (dark theme, components)
├── js/
│   ├── i18n.js         # EN / JP translations
│   ├── csv-parser.js   # CSV parsing & column normalisation
│   ├── data.js         # Delta calculation, K/D, stat aggregation
│   ├── table.js        # Table render, sort, filter
│   ├── charts.js       # Chart.js bar charts
│   ├── share.js        # URL encode / decode (lz-string)
│   └── main.js         # App entry point & screen orchestration
├── .gitignore
├── LICENSE
└── README.md
```

---

## License

[MIT](LICENSE) — free to use, modify, and distribute.
