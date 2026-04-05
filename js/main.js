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
import { initTable, refreshTable, applyFilters, buildAllianceFilter, sortBy, setSortCol, setViewMode } from './table.js';
import { buildCharts, updateChartTitles }                               from './charts.js';
import { encodeAndShare, decodeFromUrl, clearUrlParam } from './share.js';
import { saveToCloud, loadFromCloud, getApiKey, setApiKey, getSavedDashboards, addSavedDashboard, removeSavedDashboard } from './cloud.js';

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

let kvkName      = '';
let chartsBuilt  = false;
let activeTab    = 'rankings';
let isSharedView = false; // true when loaded via ?bin= or ?d= URL

// ----------------------------------------------------------------
// Init
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initLang();
  renderUploadScreen();
  renderSavedDashboards();
  setupLangToggle();

  document.getElementById('file-picker').addEventListener('change', onFilePicked);

  window.__table = { sortBy, setSortCol, applyFilters, setViewMode };

  // Browser back/forward button support
  window.addEventListener('popstate', (e) => {
    if (e.state?.view === 'dashboard') {
      _showDashboardView();
    } else {
      _showUploadView();
    }
  });

  // 1a. Cloud bin (?bin=ID)
  const binId = new URLSearchParams(location.search).get('bin');
  if (binId) {
    showLoading('Loading shared dashboard…');
    loadFromCloud(binId)
      .then((payload) => {
        isSharedView = true;
        restoreFromPayload(payload);
        history.replaceState({ view: 'dashboard' }, '');
        _showDashboardView();
      })
      .catch(() => showToast('❌ Could not load shared dashboard'))
      .finally(() => hideLoading());
    return;
  }

  // 1b. Try embedded URL payload (?d=…)
  const urlPayload = decodeFromUrl();
  if (urlPayload) {
    isSharedView = true;
    restoreFromPayload(urlPayload);
    history.replaceState({ view: 'dashboard' }, '');
    _showDashboardView();
    return;
  }

  // 2. Try sessionStorage (survives back-navigation within the tab)
  const session = loadSession();
  if (session) {
    restoreFromPayload(session);
    // If user was on dashboard, show it again
    if (session.onDashboard) {
      history.replaceState({ view: 'dashboard' }, '');
      _showDashboardView();
    }
  }
});

// ----------------------------------------------------------------
// Session persistence (survives back-navigation within the tab)
// ----------------------------------------------------------------

const SESSION_KEY = 'rok-kvk-session';

function saveSession(onDashboard = false) {
  try {
    const payload = {
      name:          kvkName,
      snapshots:     snapshots.map(({ label, filename, data }) => ({ label, filename, data })),
      fromIdx:       compareFromIdx,
      toIdx:         compareToIdx,
      onDashboard,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(payload));
  } catch { /* quota exceeded or private mode — silently ignore */ }
}

function loadSession() {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function clearSession() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

function restoreFromPayload(payload) {
  kvkName        = payload.name ?? '';
  snapshots      = (payload.snapshots ?? []).map((s, i) => ({ ...s, id: i }));
  snapshotCounter = snapshots.length;
  compareFromIdx = payload.fromIdx ?? 0;
  compareToIdx   = payload.toIdx   ?? Math.max(0, snapshots.length - 1);
  document.getElementById('kvk-name-input').value = kvkName;
  renderSnapshotList();
  updateCompareSelectors();
  updateShowButton();
}

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
  updateShowButton();
}

// ----------------------------------------------------------------
// Saved dashboards list
// ----------------------------------------------------------------

function renderSavedDashboards() {
  const list = getSavedDashboards();
  const container = document.getElementById('saved-dashboards');
  if (!container) return;

  if (!list.length) {
    container.style.display = 'none';
    return;
  }
  container.style.display = '';
  container.querySelector('.saved-list').innerHTML = list.map(d => {
    const date = new Date(d.savedAt).toLocaleDateString();
    return `
      <div class="saved-row">
        <div class="saved-info">
          <div class="saved-name">${escHtml(d.name)}</div>
          <div class="saved-date">${date}</div>
        </div>
        <a class="btn btn-primary saved-load" href="?bin=${encodeURIComponent(d.binId)}">Load</a>
        <button class="snapshot-remove" onclick="deleteSaved('${escHtml(d.binId)}')" title="Remove">✕</button>
      </div>`;
  }).join('');
}

window.deleteSaved = function (binId) {
  removeSavedDashboard(binId);
  renderSavedDashboards();
};

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
    showLoading('Parsing file…');
    // Defer parsing so the loading overlay renders first
    setTimeout(() => {
      try {
        const data = isXlsx ? parseXLSX(ev.target.result) : parseCSV(ev.target.result);
        const snap = { id: snapshotCounter++, label, filename: file.name, data };
        snapshots.push(snap);
        e.target.value = '';

        compareFromIdx = 0;
        compareToIdx   = snapshots.length - 1;

        renderSnapshotList();
        updateCompareSelectors();
        updateComparePreview();
        updateShowButton();
        showToast(`✓ ${data.length} governors loaded`);
      } finally {
        hideLoading();
      }
    }, 30);
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

  // Remove old snapshot rows but keep the empty placeholder in the DOM
  list.querySelectorAll('.snapshot-row').forEach((el) => el.remove());

  if (!snapshots.length) {
    empty.style.display = '';
    document.getElementById('compare-row').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  list.insertAdjacentHTML('beforeend', snapshots.map((snap, i) => `
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
  `).join(''));

  document.getElementById('compare-row').style.display = snapshots.length >= 2 ? 'flex' : 'none';
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
  saveSession(true);
  history.pushState({ view: 'dashboard' }, '');
  showLoading('Building dashboard…');
  setTimeout(() => { _showDashboardView(); hideLoading(); }, 30);
};

function _showDashboardView() {
  renderDashboard();
}

function _showUploadView() {
  saveSession(false);
  document.getElementById('upload-screen').style.display = 'block';
  document.getElementById('dashboard').style.display     = 'none';
}

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
  saveSession(true);

  // Header
  document.getElementById('header-logo').textContent = t('header.logo');
  document.getElementById('header-sub').textContent  = `${processed.length} governors`;
  updateLangSwitchBtn();
  const viewerOnly = isSharedView && !getApiKey();
  document.getElementById('btn-cloud-save').style.display = viewerOnly ? 'none' : '';
  document.getElementById('btn-share').style.display      = viewerOnly ? 'none' : '';

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
  // Owner viewing a shared dashboard: keep snapshots so they can add more
  const ownerSharedView = isSharedView && !!getApiKey();

  if (!ownerSharedView) {
    snapshots       = [];
    snapshotCounter = 0;
    compareFromIdx  = 0;
    compareToIdx    = 1;
    processed       = [];
  }

  chartsBuilt  = false;
  activeTab    = 'rankings';
  isSharedView = false;

  renderSnapshotList();
  updateCompareSelectors();
  updateShowButton();
  clearSession();
  clearUrlParam();
  history.pushState({ view: 'upload' }, '');
  _showUploadView();
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

  kvkName = langJa ? 'KvKシーズン5 — デモ' : 'KvK Season 5 — Demo';
  document.getElementById('kvk-name-input').value = kvkName;

  renderSnapshotList();
  updateCompareSelectors();
  saveSession(true);
  history.pushState({ view: 'dashboard' }, '');
  showLoading('Loading demo…');
  setTimeout(() => { _showDashboardView(); hideLoading(); }, 30);
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

function statCard(label, colorCls, current, delta) {
  const deltaHtml = delta !== null
    ? `<span style="font-size:12px;font-weight:600;color:${delta >= 0 ? 'var(--green)' : 'var(--red)'}">
         ${delta >= 0 ? '+' : ''}${fmtNum(delta)}
       </span>`
    : '';
  return `
    <div class="stat-card">
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-value ${colorCls}">${fmtNum(current)}</div>
      <div class="stat-card-sub">${t('stat.kpTotal')} ${deltaHtml}</div>
    </div>`;
}

function renderStatCards(stats) {
  const d = stats.hasDelta;
  document.getElementById('stat-cards').innerHTML = `
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.governors')}</div>
      <div class="stat-card-value text-accent">${stats.total}</div>
      <div class="stat-card-sub">${t('stat.total')}</div>
    </div>
    ${statCard(t('stat.kp'),     'text-purple', stats.totalKp,     d ? stats.deltaKp     : null)}
    ${statCard(t('stat.t5'),     'text-orange', stats.totalT5,     d ? stats.deltaT5     : null)}
    ${statCard(t('stat.t4'),     'text-green',  stats.totalT4,     d ? stats.deltaT4     : null)}
    ${statCard(t('stat.deaths'), 'text-red',    stats.totalDeaths, d ? stats.deltaDeaths : null)}
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.topKp')}</div>
      <div class="stat-card-value name-value text-purple">${stats.topKp?.name ?? '—'}</div>
      <div class="stat-card-sub">${fmtNum(stats.topKp?.kp ?? 0)} KP${d ? ` <span style="color:var(--green);font-size:11px">+${fmtNum(stats.topKp?.dKp ?? 0)}</span>` : ''}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">${t('stat.topT5')}</div>
      <div class="stat-card-value name-value text-orange">${stats.topT5?.name ?? '—'}</div>
      <div class="stat-card-sub">${fmtNum(stats.topT5?.t5kills ?? 0)} T5${d ? ` <span style="color:var(--green);font-size:11px">+${fmtNum(stats.topT5?.dT5kills ?? 0)}</span>` : ''}</div>
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

function updateLangSwitchBtn() {
  const btn = document.getElementById('btn-lang-switch');
  if (btn) btn.textContent = getLang() === 'en' ? 'JP' : 'EN';
}

window.toggleLang = function () {
  switchLang(getLang() === 'en' ? 'ja' : 'en');
};

window.switchLang = function (lang) {
  setLang(lang);
  updateLangSwitchBtn();
  document.querySelectorAll('.lang-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.lang === lang);
  });

  renderUploadScreen();
  renderSnapshotList();

  if (document.getElementById('dashboard').style.display !== 'none') {
    document.getElementById('header-logo').textContent = t('header.logo');
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
// Cloud Save
// ----------------------------------------------------------------

function buildPayload() {
  return {
    name:      kvkName,
    snapshots: snapshots.map(({ label, filename, data }) => ({ label, filename, data })),
    fromIdx:   compareFromIdx,
    toIdx:     compareToIdx,
  };
}

window.cloudSave = async function () {
  if (!getApiKey()) {
    openModal();
    return;
  }
  showLoading('Saving to cloud…');
  try {
    const binId = await saveToCloud(buildPayload(), kvkName);
    addSavedDashboard({ binId, name: kvkName });
    renderSavedDashboards();
    const url = `${location.origin}${location.pathname}?bin=${binId}`;
    openShareModal(url);
    showToast('☁️ Saved!');
  } catch (e) {
    if (e.message === 'NO_KEY') { openModal(); return; }
    showToast('❌ ' + e.message);
  } finally {
    hideLoading();
  }
};

// URL share — embed data if small, otherwise fall back to cloud save
window.shareUrl = async function () {
  const url = encodeAndShare(buildPayload());
  if (url.length <= 8000) {
    openShareModal(url);
    return;
  }
  // URL too long — use cloud save for a short ?bin= link
  await cloudSave();
};

window.copyShareUrl = function () {
  const url = document.getElementById('share-url-input').value;
  navigator.clipboard?.writeText(url).catch(() => {});
  showToast(t('share.copied'));
};

// ----------------------------------------------------------------
// API Key Modal
// ----------------------------------------------------------------

window.openModal = function () {
  const inp = document.getElementById('apikey-input');
  inp.value = getApiKey() ?? '';
  document.getElementById('apikey-status').textContent = getApiKey() ? '✓ Key already saved' : '';
  document.getElementById('apikey-status').style.color = '';
  document.getElementById('modal-backdrop').style.display = 'flex';
  setTimeout(() => inp.focus(), 50);
};

window.closeModal = function () {
  document.getElementById('modal-backdrop').style.display = 'none';
};

window.saveApiKey = async function () {
  const key    = document.getElementById('apikey-input').value.trim();
  const status = document.getElementById('apikey-status');
  if (!key) { status.textContent = 'Please enter a key.'; return; }

  status.style.color = '';
  status.textContent = 'Verifying…';
  setApiKey(key);
  showLoading('Verifying API key…');
  try {
    await saveToCloud({ test: true }, '_test');
    status.style.color = 'var(--green)';
    status.textContent = '✓ Key saved! You can now use ☁️ Save.';
    setTimeout(closeModal, 1500);
  } catch (e) {
    status.style.color = 'var(--red)';
    status.textContent = '❌ Invalid key: ' + e.message;
  } finally {
    hideLoading();
  }
};

// ----------------------------------------------------------------
// Share URL Modal
// ----------------------------------------------------------------

function openShareModal(url) {
  document.getElementById('share-url-input').value = url;
  document.getElementById('share-modal-backdrop').style.display = 'flex';
}

window.closeShareModal = function () {
  document.getElementById('share-modal-backdrop').style.display = 'none';
};

// ----------------------------------------------------------------
// Loading overlay
// ----------------------------------------------------------------

function showLoading(msg = 'Loading…') {
  document.getElementById('loading-msg').textContent = msg;
  document.getElementById('loading-overlay').style.display = 'flex';
}

function hideLoading() {
  document.getElementById('loading-overlay').style.display = 'none';
}

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
