/**
 * charts.js — Chart.js bar chart rendering for the Development tab
 *
 * Requires Chart.js to be loaded globally as `window.Chart`.
 */

import { t }              from './i18n.js';
import { effectiveValue } from './data.js';
import { fmtNum }         from './table.js';

/** Instances keyed by canvas ID so we can destroy before re-creating. */
const chartInstances = {};

const BAR_COLORS = [
  '#58a6ff', '#bc8cff', '#ffa657', '#3fb950',
  '#f85149', '#ffd700', '#79c0ff', '#d2a8ff',
  '#56d364', '#ff7b72',
];

const CHART_DEFAULTS = {
  type: 'bar',
  options: {
    indexAxis: 'y',
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => ' ' + fmtNum(ctx.parsed.x),
        },
      },
    },
    scales: {
      x: {
        ticks: {
          color: '#8b949e',
          callback: (v) => fmtNum(v),
        },
        grid: { color: '#30363d' },
      },
      y: {
        ticks: { color: '#e6edf3', font: { size: 12 } },
        grid: { display: false },
      },
    },
  },
};

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Build (or rebuild) all four charts.
 * Safe to call multiple times — existing charts are destroyed first.
 * @param {import('./data.js').ProcessedGovernor[]} rows
 */
export function buildCharts(rows) {
  buildChart('chart-kp',     rows, 'kp',      t('chart.kp'));
  buildChart('chart-t5',     rows, 't5kills',  t('chart.t5'));
  buildChart('chart-deaths', rows, 'deaths',   t('chart.deaths'));
  buildChart('chart-power',  rows, 'power',    t('chart.power'));
}

/**
 * Update chart titles after a language switch without rebuilding data.
 */
export function updateChartTitles() {
  setChartTitle('chart-kp',     t('chart.kp'));
  setChartTitle('chart-t5',     t('chart.t5'));
  setChartTitle('chart-deaths', t('chart.deaths'));
  setChartTitle('chart-power',  t('chart.power'));
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function topN(rows, field, n = 10) {
  return rows
    .slice()
    .sort((a, b) => effectiveValue(b, field) - effectiveValue(a, field))
    .slice(0, n);
}

function truncateName(name, max = 14) {
  return name.length > max ? name.slice(0, max) + '…' : name;
}

function buildChart(canvasId, rows, field, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const top    = topN(rows, field);
  const labels = top.map((r) => truncateName(r.name));
  const values = top.map((r) => effectiveValue(r, field));

  if (chartInstances[canvasId]) {
    chartInstances[canvasId].destroy();
  }

  const ctx = canvas.getContext('2d');

  chartInstances[canvasId] = new window.Chart(ctx, {
    ...CHART_DEFAULTS,
    data: {
      labels,
      datasets: [{
        data:            values,
        backgroundColor: BAR_COLORS.slice(0, top.length),
        borderRadius:    6,
        borderSkipped:   false,
      }],
    },
    options: {
      ...CHART_DEFAULTS.options,
      plugins: {
        ...CHART_DEFAULTS.options.plugins,
        title: {
          display: false, // We use our own .chart-title element
        },
      },
    },
  });

  // Update the card title element
  const card = canvas.closest('.chart-card');
  if (card) {
    const titleEl = card.querySelector('.chart-title');
    if (titleEl) titleEl.textContent = title;
  }
}

function setChartTitle(canvasId, title) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;
  const card    = canvas.closest('.chart-card');
  const titleEl = card?.querySelector('.chart-title');
  if (titleEl) titleEl.textContent = title;
}
