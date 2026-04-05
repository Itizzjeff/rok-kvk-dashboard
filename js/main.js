/**
 * main.js — Application entry point and screen orchestration
 *
 * Snapshot model:
 *   snapshots = [{ id, label, filename, data: Governor[] }, …]
 *   compareFromIdx / compareToIdx — indices into snapshots[]
 *
 * The dashboard always shows the delta between snapshots[compareFromIdx]
 * and snapshots[compareToIdx].  When only one snapshot exists, it shows
 * a plain snapshot view (no delta).
 */

import { t, setLang, getLang, initLang }                                from './i18n.js';
import { parseCSV, parseXLSX }                                          from './csv-parser.js';
import { processData, computeStats, computeMaxValues, generateDemoData } from './data.js';
import { initTable, refreshTable, applyFilters, buildAllianceFilter, sortBy, setSortCol } from './table.js';
import { buildCharts, updateChartTitles }                               from './charts.js';
import { encodeAndShare, decodeFromUrl, displaySharedUrl, copyDisplayedUrl, clearUrlParam } from './share.js';

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------

/** @type {{ id: number, label: string, filename: string, data: import('./csv-parser.js').Governor[] }[]} */
let snapshots = [];

let snapshotCounter  = 0;
let compareFromIdx   = 0;
let compareToIdx     = 1;

/** @type {import('./data.js').ProcessedGovernor[]} */
let processed = [];

let kvkName     = '';
let chartsBuilt = false;
let activeTab   = 'rankings';

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initLang();
  renderUploadScreen();
  setupLangToggle();

  document.getElementById('file-picker').addEventListener('change', onFilePicked);

  window.__table = { sortBy, setSortCol, applyFilters };

  // Restore from shared URL
  const payload = decodeFromUrl();
  if (payload) {
    kvkName   = payload.name ?? '';
    snapshots = (payload.snapshots ?? []).map((s, i) => ({ ...s, id: i }));
    snapshotCounter = snapshots.length;
    document.getElementById('kvk-name-input').value = kvkName;
    renderSnapshotList();
    updateCompareSelectors();
    updateShowButton();
    if (snapshots.length >= 1) showDashboard();
  }
});

// ----------------------------------------------------------------
// Upload screen rendering
// ----------------------------------------------------------------

function renderUploadScreen() {
  document.getElementById('upload-title').textContent       = t('upload.title');
  document.getElementById('upload-subtitle').textContent    = t('upload.subtitle');
  document.getElementById('kvk-name-label').textContent     = t('upload.kvkLabel');
  document.getElementById('kvk-name-input').placeholder     = t('upload.kvkPlaceholder');
  document.getElementById('snapshot-section-label').textContent = t('upload.snapshots');
  document.getElementById('btn-add-snapshot').textContent   = t('upload.addSnapshot');
  document.getElementById('snapshot-empty-text').textContent = t('upload.snapEmpty');
  document.getElementById('compare-label').textContent      = t('upload.compare');
  document.getElementById('btn-show').textContent           = t('upload.btnShow');
  document.getElementById('btn-demo').textContent           = t('upload.btnDemo');
  document.getElementById('upload-sep').textContent         = t('upload.or');
  document.getElementById('url-box-label').textContent      = t('upload.urlLabel');
  document.getElementById('btn-copy-url').textContent       = t('share.copy');
  updateShowButton();
}

// ----------------------------------------------------------------
// Snapshot management
// ----------------------------------------------------------------

function onFilePicked(e) {
  const file = e.target.files[0];
  if (!file) return;

  const label    = suggestLabel();
  const isXlsx   = file.name.toLowerCase().endsWith('.xlsx');
  const reader   = new FileReader();

  reader.onload = (ev) => {
    const data = isXlsx ? parseXLSX(ev.target.result) : parseCSV(ev.target.result);
    const snap = { id: snapshotCounter++, label, filename: file.name, data };
    snapshots.push(snap);
    e.target.value = ''; // reset so the same file can be re-selected

    // Default compare: first vs last
    compareFromIdx = 0;
    compareToIdx   = snapshots.length - 1;

    renderSnapshotList();
    updateCompareSelectors();
    updateComparePreview();
    updateShowButton();
  };

  if (isXlsx) reader.readAsArrayBuffer(file);
  else         reader.readAsText(file);
}

/** Default label for each uploaded snapshot: Pass 1, Pass 2, … */
function suggestLabel() {
  return getLang() === 'ja'
    ? `パス ${snapshots.length + 1}`
    : `Pass ${snapshots.length + 1}`;
}

window.removeSnapshot = function (id) {
  snapshots = snapshots.filter((s) => s.id !== id);
  // Clamp indices
  compareFromIdx = Math.min(compareFromIdx, Math.max(0, snapshots.length - 2));
  compareToIdx   = Math.min(compareToIdx,   Math.max(1, snapshots.length - 1));
  if (compareFromIdx === compareToIdx && snapshots.length > 1) compareFromIdx = compareToIdx - 1;

  renderSnapshotList();
  updateCompareSelectors();
  updateComparePreview();
  updateShowButton();
};

window.onSnapshotLabelChange = function (id, value) {
  const snap = snapshots.find((s) => s.id === id);
  if (snap) snap.label = value;
  updateCompareSelectors();
  updateComparePreview();
};

function renderSnapshotList() {
  const list  = document.getElementById('snapshot-list');
  const empty = document.getElementById('snapshot-empty');

  if (!snapshots.length) {
    empty.style.display = '';
    list.innerHTML = '';
    list.appendChild(empty);
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = snapshots.map((snap, i) => `
    <div class="snapshot-row">
      <div class="snapshot-index">${i + 1}</div>
      <input
        class="snapshot-label-input"
        type="text"
        value="${escHtml(snap.label)}"
        onchange="onSnapshotLabelChange(${snap.id}, this.value)"
        oninput="onSnapshotLabelChange(${snap.id}, this.value)"
      />
      <div class="snapshot-filename">${escHtml(snap.filename)}</div>
      <div class="snapshot-count">${snap.data.length} gov.</div>
      <button class="snapshot-remove" onclick="removeSnapshot(${snap.id})" title="Remove">✕</button>
    </div>
  `).join('');

  const compareRow = document.getElementById('compare-row');
  compareRow.style.display = snapshots.length >= 2 ? 'flex' : 'none';
}

function updateCompareSelectors() {
  ['compare-from', 'compare-to', 'dash-compare-from', 'dash-compare-to'].forEach((id) => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = id.includes('from') ? compareFromIdx : compareToIdx;
    sel.innerHTML = snapshots.map((s, i) =>
      `<option value="${i}" ${i === current ? 'selected' : ''}>${escHtml(s.label)}</option>`
    ).join('');
  });
}

window.updateComparePreview = function () {
  compareFromIdx = parseInt(document.getElementById('compare-from')?.value ?? 0, 10);
  compareToIdx   = parseInt(document.getElementById('compare-to')?.value   ?? 1, 10);

  const from = snapshots[compareFromIdx];
  const to   = snapshots[compareToIdx];
  const el   = document.getElementById('compare-preview');
  if (el && from && to) {
    el.textContent = t('upload.compareHint', { a: from.label, b: to.label, n: to.data.length });
  }
  updateCompareSelectors();
};

function updateShowButton() {
  document.getElementById('btn-show').disabled = snapshots.length < 1;
}

// ----------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------

window.showDashboard = function () {
  kvkName = document.getElementById('kvk-name-input').value.trim() || 'KvK Dashboard';
  renderDashboard();
};

function renderDashboard() {
  const fromSnap = snapshots[compareFromIdx] ?? null;
  const toSnap   = snapshots[compareToIdx]   ?? null;
  const base     = toSnap ?? fromSnap;
  const hasDelta = !!(fromSnap && toSnap && fromSnap !== toSnap);

  processed = processData(hasDelta ? fromSnap.data : null, base?.data ?? []);

  const stats   = computeStats(processed);
  const maxVals = computeMaxValues(processed);

  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('dashboard').style.display     = 'block';

  // Header
  document.getElementById('header-logo').textContent = t('header.logo');
  document.getElementById('header-sub').textContent  = `${processed.length} governors`;

  // Banner
  document.getElementById('kvk-bar-name').textContent = kvkName;
  document.getElementById('kvk-bar-tag').textContent  = hasDelta ? t('banner.tagDelta') : t('banner.tagSnapshot');
  document.getElementById('kvk-bar-meta').textContent = hasDelta
    ? `${fromSnap.label}  →  ${toSnap.label}`
    : `${base?.label ?? ''}  ·  ${processed.length} governors`;

  // Snapshot selectors in banner (visible only when >1 snapshot)
  const bannerCompare = document.getElementById('banner-compare');
  bannerCompare.style.display = snapshots.length >= 2 ? 'flex' : 'none';
  updateCompareSelectors();

  renderStatCards(stats);
  buildAllianceFilter(processed);
  initTable(processed, maxVals);

  chartsBuilt = false;
  switchTab('rankings', document.getElementById('tab-btn-rankings'));
}

window.onDashCompareChange = function () {
  compareFromIdx = parseInt(document.getElementById('dash-compare-from').value, 10);
  compareToIdx   = parseInt(document.getElementById('dash-compare-to').value,   10);
  chartsBuilt    = false;
  renderDashboard();
};

window.resetAll = function () {
  snapshots       = [];
  snapshotCounter = 0;
  compareFromIdx  = 0;
  compareToIdx    = 1;
  processed       = [];
  chartsBuilt     = false;
  activeTab       = 'rankings';

  document.getElementById('snapshot-list').innerHTML = '';
  document.getElementById('snapshot-list').appendChild(document.getElementById('snapshot-empty'));
  document.getElementById('snapshot-empty').style.display = '';
  document.getElementById('compare-row').style.display    = 'none';
  document.getElementById('url-box').classList.remove('visible');
  document.getElementById('upload-screen').style.display  = 'block';
  document.getElementById('dashboard').style.display      = 'none';
  clearUrlParam();
};

window.loadDemo = function () {
  const demo = generateDemoData();
  const langJa = getLang() === 'ja';

  snapshots = [
    { id: snapshotCounter++, label: langJa ? 'KvK 開始' : 'KvK Start',  filename: 'demo_start.xlsx', data: demo.startData },
    { id: snapshotCounter++, label: langJa ? 'パス4'   : 'Pass 4',      filename: 'demo_pass4.xlsx', data: demo.midData   },
    { id: snapshotCounter++, label: langJa ? 'KvK 終了' : 'KvK End',    filename: 'demo_end.xlsx',   data: demo.endData   },
  ];
  compareFromIdx = 0;
  compareToIdx   = 2;

  document.getElementById('kvk-name-input').value = langJa ? 'KvKシーズン5 — デモ' : 'KvK Season 5 — Demo';
  kvkName = document.getElementById('kvk-name-input').value;

  renderSnapshotList();
  updateCompareSelectors();
  showDashboard();
};

// ----------------------------------------------------------------
// Stat cards
// ----------------------------------------------------------------

function fmtNum(n) {
  n = parseInt(n) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function renderStatCards(stats) {
  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.governors')}</div>
      <div class="stat-card-value text-accent">${stats.total}</div>
      <div class="stat-card-sub">${t('stat.total')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.kp')}</div>
      <div class="stat-card-value text-purple">${fmtNum(stats.totalKp)}</div>
      <div class="stat-card-sub">${t('stat.kpTotal')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.t5')}</div>
      <div class="stat-card-value text-orange">${fmtNum(stats.totalT5)}</div>
      <div class="stat-card-sub">${t('stat.kpTotal')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.t4')}</div>
      <div class="stat-card-value text-green">${fmtNum(stats.totalT4)}</div>
      <div class="stat-card-sub">${t('stat.kpTotal')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.deaths')}</div>
      <div class="stat-card-value text-red">${fmtNum(stats.totalDeaths)}</div>
      <div class="stat-card-sub">${t('stat.kpTotal')}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.topKp')}</div>
      <div class="stat-card-value name-value text-purple">${stats.topKp?.name ?? '—'}</div>
      <div class="stat-card-sub">${fmtNum(stats.topKp?.dKp ?? 0)} KP</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.topT5')}</div>
      <div class="stat-card-value name-value text-orange">${stats.topT5?.name ?? '—'}</div>
      <div class="stat-card-sub">${fmtNum(stats.topT5?.dT5kills ?? 0)} T5</div>
    </div>
  `;
}

// ----------------------------------------------------------------
// Tabs
// ----------------------------------------------------------------

window.switchTab = function (tab, el) {
  activeTab = tab;
  document.querySelectorAll('.tab').forEach((t) => t.classList.remove('active'));
  if (el) el.classList.add('active');
  document.getElementById('tab-rankings').style.display = tab === 'rankings' ? '' : 'none';
  document.getElementById('tab-charts').style.display   = tab === 'charts'   ? '' : 'none';
  if (tab === 'charts' && !chartsBuilt) {
    buildCharts(processed);
    chartsBuilt = true;
  }
};

// ----------------------------------------------------------------
// Language toggle
// ----------------------------------------------------------------

function setupLangToggle() {
  const lang = getLang();
  document.querySelectorAll('.lang-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.lang === lang);
  });
}

window.switchLang = function (lang) {
  setLang(lang);
  document.querySelectorAll('.lang-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.lang === lang);
  });

  renderUploadScreen();
  renderSnapshotList();

  if (document.getElementById('dashboard').style.display !== 'none') {
    document.getElementById('header-logo').textContent = t('header.logo');
    document.getElementById('btn-share').textContent   = t('header.share');
    document.getElementById('btn-back').textContent    = t('header.back');
    const stats = computeStats(processed);
    renderStatCards(stats);
    document.getElementById('tab-btn-rankings').textContent = t('tab.rankings');
    document.getElementById('tab-btn-charts').textContent   = t('tab.charts');
    refreshTable();
    buildAllianceFilter(processed);
    if (chartsBuilt) updateChartTitles();
  }
};

// ----------------------------------------------------------------
// Share
// ----------------------------------------------------------------

window.shareKvK = function () {
  const payload = {
    name:      kvkName,
    snapshots: snapshots.map(({ label, filename, data }) => ({ label, filename, data })),
    fromIdx:   compareFromIdx,
    toIdx:     compareToIdx,
  };
  const url = encodeAndShare(payload);
  displaySharedUrl(url);
  showToast(t('share.copied'));
};

window.copySharedUrl = function () {
  copyDisplayedUrl();
  showToast(t('share.copied'));
};

// ----------------------------------------------------------------
// Toast
// ----------------------------------------------------------------

function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// ----------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------

function escHtml(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
