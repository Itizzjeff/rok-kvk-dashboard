/**
 * main.js — Application entry point and screen orchestration
 */

import { t, setLang, getLang, initLang } from './i18n.js';
import { parseCSV, parseXLSX }             from './csv-parser.js';
import { processData, computeStats, computeMaxValues, generateDemoData } from './data.js';
import { initTable, refreshTable, applyFilters, buildAllianceFilter, sortBy, setSortCol } from './table.js';
import { buildCharts, updateChartTitles }  from './charts.js';
import { encodeAndShare, decodeFromUrl, displaySharedUrl, copyDisplayedUrl, clearUrlParam } from './share.js';

// ----------------------------------------------------------------
// State
// ----------------------------------------------------------------

/** @type {import('./csv-parser.js').Governor[]|null} */
let startData = null;

/** @type {import('./csv-parser.js').Governor[]|null} */
let endData = null;

/** @type {import('./data.js').ProcessedGovernor[]} */
let processed = [];

let kvkName      = '';
let chartsBuilt  = false;
let activeTab    = 'rankings';

// ----------------------------------------------------------------
// Initialisation
// ----------------------------------------------------------------

document.addEventListener('DOMContentLoaded', () => {
  initLang();
  renderUploadScreen();
  setupFileDropZones();
  setupLangToggle();

  // Expose table helpers to inline onclick handlers in dynamic HTML
  window.__table = { sortBy, setSortCol, applyFilters };

  // Try to restore from a shared URL
  const payload = decodeFromUrl();
  if (payload) {
    kvkName   = payload.name;
    startData = payload.start;
    endData   = payload.end;
    document.getElementById('kvk-name-input').value = kvkName;
    if (startData) markLoaded('start', startData.length);
    if (endData)   markLoaded('end',   endData.length);
    showDashboard();
  }
});

// ----------------------------------------------------------------
// Upload screen
// ----------------------------------------------------------------

function renderUploadScreen() {
  document.getElementById('upload-title').textContent    = t('upload.title');
  document.getElementById('upload-subtitle').textContent = t('upload.subtitle');
  document.getElementById('kvk-name-label').textContent  = t('upload.kvkLabel');
  document.getElementById('kvk-name-input').placeholder  = t('upload.kvkPlaceholder');
  document.getElementById('upload-start-label').textContent = t('upload.startLabel');
  document.getElementById('upload-start-hint').textContent  = t('upload.startHint');
  document.getElementById('upload-end-label').textContent   = t('upload.endLabel');
  document.getElementById('upload-end-hint').textContent    = t('upload.endHint');
  document.getElementById('btn-show').textContent   = t('upload.btnShow');
  document.getElementById('btn-demo').textContent   = t('upload.btnDemo');
  document.getElementById('upload-sep').textContent = t('upload.or');
  document.getElementById('url-box-label').textContent = t('upload.urlLabel');
  document.getElementById('btn-copy-url').textContent  = t('share.copy');
  updateShowButton();
}

function setupFileDropZones() {
  setupZone('drop-start', 'file-start', 'start');
  setupZone('drop-end',   'file-end',   'end');
}

function setupZone(zoneId, inputId, slot) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);

  zone.addEventListener('dragover', (e) => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) loadFile(file, slot);
  });

  input.addEventListener('change', (e) => {
    if (e.target.files[0]) loadFile(e.target.files[0], slot);
  });
}

function loadFile(file, slot) {
  const isXlsx = file.name.toLowerCase().endsWith('.xlsx');
  const reader  = new FileReader();

  reader.onload = (e) => {
    const data = isXlsx
      ? parseXLSX(e.target.result)
      : parseCSV(e.target.result);

    if (slot === 'start') startData = data;
    else                  endData   = data;

    markLoaded(slot, data.length);
    updateShowButton();
  };

  if (isXlsx) reader.readAsArrayBuffer(file);
  else         reader.readAsText(file);
}

function markLoaded(slot, count) {
  const statusId = slot === 'start' ? 'status-start' : 'status-end';
  const zoneId   = slot === 'start' ? 'drop-start'   : 'drop-end';
  document.getElementById(statusId).textContent = t('upload.loaded', { n: count });
  document.getElementById(zoneId).classList.add('loaded');
}

function updateShowButton() {
  const hasData = !!(startData || endData);
  document.getElementById('btn-show').disabled = !hasData;
}

// ----------------------------------------------------------------
// Dashboard
// ----------------------------------------------------------------

window.showDashboard = function () {
  kvkName   = document.getElementById('kvk-name-input').value.trim() || 'KvK Dashboard';
  processed = processData(startData, endData);

  const hasDelta = !!(startData && endData);
  const stats    = computeStats(processed);
  const maxVals  = computeMaxValues(processed);

  // Switch screens
  document.getElementById('upload-screen').style.display = 'none';
  document.getElementById('dashboard').style.display     = 'block';

  // Banner
  document.getElementById('kvk-bar-name').textContent = kvkName;
  document.getElementById('kvk-bar-tag').textContent  = t(hasDelta ? 'banner.tagDelta' : 'banner.tagSnapshot');
  document.getElementById('kvk-bar-meta').textContent = hasDelta
    ? t('banner.metaDelta', { s: startData.length, e: endData.length })
    : t('banner.metaSnap',  { n: processed.length });
  document.getElementById('header-sub').textContent = t('header.sub');

  // Stat cards
  renderStatCards(stats);

  // Table
  buildAllianceFilter(processed);
  initTable(processed, maxVals);

  // Charts (built lazily on first tab switch)
  chartsBuilt = false;
  activeTab   = 'rankings';
  switchTab('rankings', document.querySelector('.tab'));
};

window.resetAll = function () {
  startData  = null;
  endData    = null;
  processed  = [];
  chartsBuilt = false;
  activeTab   = 'rankings';

  document.getElementById('status-start').textContent = '';
  document.getElementById('status-end').textContent   = '';
  document.getElementById('drop-start').classList.remove('loaded');
  document.getElementById('drop-end').classList.remove('loaded');
  document.getElementById('file-start').value = '';
  document.getElementById('file-end').value   = '';
  document.getElementById('url-box').classList.remove('visible');
  document.getElementById('upload-screen').style.display = 'block';
  document.getElementById('dashboard').style.display     = 'none';
  clearUrlParam();
};

window.loadDemo = function () {
  const demo = generateDemoData();
  startData  = demo.startData;
  endData    = demo.endData;
  document.getElementById('kvk-name-input').value = getLang() === 'ja'
    ? 'KvK シーズン5 — デモ'
    : 'KvK Season 5 — Demo';
  markLoaded('start', startData.length);
  markLoaded('end',   endData.length);
  showDashboard();
};

// ----------------------------------------------------------------
// Stat cards
// ----------------------------------------------------------------

function renderStatCards(stats) {
  const { fmtNum } = window.__fmtNum
    ? { fmtNum: window.__fmtNum }
    : { fmtNum: (n) => {
        n = parseInt(n) || 0;
        if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
        if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
        if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
        return String(n);
      }};

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

  // Update toggle button states
  document.querySelectorAll('.lang-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.lang === lang);
  });

  // Re-render static text on both screens
  renderUploadScreen();

  // If dashboard is visible, update its text too
  if (document.getElementById('dashboard').style.display !== 'none') {
    document.getElementById('header-logo').textContent = t('header.logo');
    document.getElementById('header-sub').textContent  = t('header.sub');
    document.getElementById('btn-share').textContent   = t('header.share');
    document.getElementById('btn-back').textContent    = t('header.back');
    document.getElementById('kvk-bar-tag').textContent = t(
      startData && endData ? 'banner.tagDelta' : 'banner.tagSnapshot',
    );

    const stats = computeStats(processed);
    renderStatCards(stats);

    document.querySelectorAll('.tab').forEach((el) => {
      if (el.getAttribute('onclick')?.includes("'rankings'")) el.textContent = t('tab.rankings');
      if (el.getAttribute('onclick')?.includes("'charts'"))   el.textContent = t('tab.charts');
    });

    refreshTable();
    buildAllianceFilter(processed);

    if (chartsBuilt) updateChartTitles();
  }
};

// ----------------------------------------------------------------
// Share
// ----------------------------------------------------------------

window.shareKvK = function () {
  const url = encodeAndShare({ name: kvkName, start: startData, end: endData });
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
