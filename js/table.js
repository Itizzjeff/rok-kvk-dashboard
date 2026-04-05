/**
 * table.js — Table rendering, sorting, and filtering
 */

import { t } from './i18n.js';
import { effectiveValue } from './data.js';

/** @type {import('./data.js').ProcessedGovernor[]} */
let allRows = [];

/** @type {Record<string, number>} */
let maxValues = {};

let sortCol = 'kp';
let sortDir = 'desc';

const SORT_COLS = ['name', 'kp', 't5kills', 't4kills', 'deaths', 'power', 'kd'];

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Initialise the table with processed data and max values.
 * @param {import('./data.js').ProcessedGovernor[]} rows
 * @param {Record<string, number>} maxVals
 */
export function initTable(rows, maxVals) {
  allRows    = rows;
  maxValues  = maxVals;
  sortCol    = 'kp';
  sortDir    = 'desc';
  renderHeaders();
  applyFilters();
}

/** Re-render the table using current filter/sort state (called after lang switch). */
export function refreshTable() {
  renderHeaders();
  applyFilters();
}

/**
 * Sort by a column.  Toggles direction if already active.
 * @param {string} col
 */
export function sortBy(col) {
  if (sortCol === col) {
    sortDir = sortDir === 'desc' ? 'asc' : 'desc';
  } else {
    sortCol = col;
    sortDir = 'desc';
  }
  renderHeaders();
  applyFilters();
}

/** Quick-sort pill shortcut. */
export function setSortCol(col) {
  sortCol = col;
  sortDir = 'desc';
  renderHeaders();
  applyFilters();
  syncSortPills();
}

/** Run filters and re-render the tbody. */
export function applyFilters() {
  const search   = document.getElementById('search-input')?.value.toLowerCase() ?? '';
  const alliance = document.getElementById('alliance-filter')?.value ?? '';

  const filtered = allRows.filter((r) => {
    if (search && !r.name.toLowerCase().includes(search) && !r.alliance.toLowerCase().includes(search)) return false;
    if (alliance && r.alliance !== alliance) return false;
    return true;
  });

  const sorted = sortRows(filtered);

  document.getElementById('filter-count').textContent =
    t('filter.count', { f: sorted.length, t: allRows.length });

  renderBody(sorted);
  syncSortPills();
}

/**
 * Populate the alliance <select> with unique alliance values.
 * @param {import('./data.js').ProcessedGovernor[]} rows
 */
export function buildAllianceFilter(rows) {
  const alliances = [...new Set(rows.map((r) => r.alliance).filter(Boolean))].sort();
  const sel = document.getElementById('alliance-filter');
  if (!sel) return;
  sel.innerHTML =
    `<option value="">${t('filter.allAlliances')}</option>` +
    alliances.map((a) => `<option value="${escHtml(a)}">${escHtml(a)}</option>`).join('');
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function sortRows(rows) {
  return rows.slice().sort((a, b) => {
    let av, bv;
    if (sortCol === 'name') {
      av = a.name;
      bv = b.name;
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    }
    if (sortCol === 'kd') {
      av = a.kd;
      bv = b.kd;
    } else {
      av = effectiveValue(a, sortCol);
      bv = effectiveValue(b, sortCol);
    }
    return sortDir === 'asc' ? av - bv : bv - av;
  });
}

function renderHeaders() {
  const colDefs = [
    { id: null,       label: t('th.rank'),   cls: '' },
    { id: 'name',     label: t('th.gov'),    cls: 'sortable' },
    { id: 'kp',       label: t('th.kp'),     cls: 'sortable' },
    { id: 't5kills',  label: t('th.t5'),     cls: 'sortable' },
    { id: 't4kills',  label: t('th.t4'),     cls: 'sortable' },
    { id: 'deaths',   label: t('th.deaths'), cls: 'sortable' },
    { id: 'power',    label: t('th.power'),  cls: 'sortable' },
    { id: 'kd',       label: t('th.kd'),     cls: 'sortable' },
  ];

  const thead = document.querySelector('#main-table thead tr');
  if (!thead) return;

  thead.innerHTML = colDefs.map(({ id, label, cls }) => {
    let sortCls = '';
    if (id && id === sortCol) sortCls = sortDir === 'asc' ? ' sort-asc' : ' sort-desc';
    const onclick = id ? ` onclick="window.__table.sortBy('${id}')"` : '';
    return `<th class="${cls}${sortCls}"${onclick}>${label}</th>`;
  }).join('');
}

function renderBody(rows) {
  const tbody = document.getElementById('table-body');
  if (!tbody) return;

  tbody.innerHTML = rows.map((gov, idx) => buildRow(gov, idx + 1)).join('');
}

function buildRow(gov, rank) {
  return `<tr>
    <td>${rankBadge(rank)}</td>
    <td>
      <div class="gov-name">${escHtml(gov.name)}</div>
      <div class="gov-alliance">${escHtml(gov.alliance)}</div>
    </td>
    ${barCell(gov, 'kp',      'var(--purple)')}
    ${barCell(gov, 't5kills', 'var(--orange)')}
    ${barCell(gov, 't4kills', 'var(--green)')}
    ${barCell(gov, 'deaths',  'var(--red)')}
    ${barCell(gov, 'power',   'var(--accent)')}
    <td>${kdBadge(gov.kd)}</td>
  </tr>`;
}

function barCell(gov, field, color) {
  const value   = effectiveValue(gov, field);
  const max     = maxValues[field] ?? 1;
  const pct     = Math.max(0, Math.min(100, (value / max) * 100));
  const deltaEl = buildDelta(gov, field);

  return `<td class="bar-cell">
    <div class="bar-wrap">
      <span class="bar-val">${fmtNum(value)}${deltaEl}</span>
      <div class="bar">
        <div class="bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div>
      </div>
    </div>
  </td>`;
}

/**
 * Build the delta badge for a field (only shown in delta mode where the
 * raw end value differs from the delta).
 */
function buildDelta(gov, field) {
  if (!gov.hasDelta) return '';
  const dField = 'd' + field.charAt(0).toUpperCase() + field.slice(1);
  const delta = gov[dField] ?? 0;
  if (delta === gov[field]) return ''; // delta === raw means no start data was matched
  const cls = delta >= 0 ? 'delta-pos' : 'delta-neg';
  const sign = delta >= 0 ? '+' : '';
  return `<span class="delta ${cls}">${sign}${fmtNum(delta)}</span>`;
}

function rankBadge(rank) {
  if (rank === 1) return `<span class="rank-badge rank-1">1</span>`;
  if (rank === 2) return `<span class="rank-badge rank-2">2</span>`;
  if (rank === 3) return `<span class="rank-badge rank-3">3</span>`;
  return `<span class="rank-badge rank-n">${rank}</span>`;
}

function kdBadge(kd) {
  const str = kd >= 99 ? '∞' : kd.toFixed(2);
  const cls = kd >= 2 ? 'kd-great' : kd >= 1 ? 'kd-ok' : 'kd-bad';
  return `<span class="kd-badge ${cls}">${str}</span>`;
}

function syncSortPills() {
  document.querySelectorAll('.sort-pill').forEach((pill) => {
    pill.classList.toggle('active', pill.dataset.col === sortCol);
  });
}

/** Format a large integer to compact notation (1.2M, 345K, etc.) */
export function fmtNum(n) {
  n = parseInt(n) || 0;
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(1) + 'B';
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + 'K';
  return String(n);
}

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
