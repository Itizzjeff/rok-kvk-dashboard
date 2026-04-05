/**
 * data.js — Data processing: delta calculation and derived stats
 */

/**
 * @typedef {import('./csv-parser.js').Governor} Governor
 *
 * @typedef {Object} ProcessedGovernor
 * @property {string}  id
 * @property {string}  name
 * @property {string}  alliance
 * @property {number}  power
 * @property {number}  kp
 * @property {number}  t5kills
 * @property {number}  t4kills
 * @property {number}  t3kills
 * @property {number}  t2kills
 * @property {number}  t1kills
 * @property {number}  deaths
 * @property {number}  resources
 * @property {number}  dPower     — delta (end − start), equals raw value for snapshots
 * @property {number}  dKp
 * @property {number}  dT5kills
 * @property {number}  dT4kills
 * @property {number}  dDeaths
 * @property {boolean} hasDelta   — true when a start snapshot was matched
 * @property {number}  kd         — (T4+T5 kills) / deaths; 99 when deaths = 0
 */

/**
 * Build a lookup map keyed by governor ID (falls back to name).
 * @param {Governor[]} rows
 * @returns {Map<string, Governor>}
 */
function buildLookup(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.id || row.name;
    if (key) map.set(key, row);
  }
  return map;
}

/**
 * Compute K/D ratio.
 * Returns 99 when deaths = 0 but kills exist (displayed as ∞).
 * @param {number} t4kills
 * @param {number} t5kills
 * @param {number} deaths
 * @returns {number}
 */
function calcKD(t4kills, t5kills, deaths) {
  const kills = t4kills + t5kills;
  if (deaths === 0) return kills > 0 ? 99 : 0;
  return kills / deaths;
}

/**
 * Process governor data.
 * When both start and end snapshots are provided, delta fields reflect
 * the change during KvK. When only one snapshot is provided, delta
 * fields equal the raw values of that snapshot.
 *
 * @param {Governor[]|null} startData
 * @param {Governor[]|null} endData
 * @returns {ProcessedGovernor[]}
 */
export function processData(startData, endData) {
  const base = endData ?? startData ?? [];
  const startLookup = startData ? buildLookup(startData) : null;

  return base.map((gov) => {
    const key = gov.id || gov.name;
    const prev = startLookup?.get(key) ?? null;

    const delta = (field) => (prev ? gov[field] - prev[field] : gov[field]);

    return {
      ...gov,
      dPower:   delta('power'),
      dKp:      delta('kp'),
      dT5kills: delta('t5kills'),
      dT4kills: delta('t4kills'),
      dDeaths:  delta('deaths'),
      hasDelta: prev !== null,
      kd:       calcKD(gov.t4kills, gov.t5kills, gov.deaths),
    };
  });
}

/**
 * Compute aggregate stats across all processed governors.
 * @param {ProcessedGovernor[]} rows
 * @returns {Object}
 */
export function computeStats(rows) {
  const sum = (field) => rows.reduce((acc, r) => acc + r[field], 0);

  const topBy = (field) =>
    rows.length ? rows.slice().sort((a, b) => b[field] - a[field])[0] : null;

  return {
    total:      rows.length,
    totalKp:    sum('dKp'),
    totalT5:    sum('dT5kills'),
    totalT4:    sum('dT4kills'),
    totalDeaths: sum('dDeaths'),
    topKp:      topBy('dKp'),
    topT5:      topBy('dT5kills'),
  };
}

/**
 * Compute the per-column maximum values (used to scale progress bars).
 * @param {ProcessedGovernor[]} rows
 * @returns {Record<string, number>}
 */
export function computeMaxValues(rows) {
  const fields = ['kp', 't5kills', 't4kills', 'deaths', 'power'];
  const maxValues = {};
  for (const f of fields) {
    const dField = 'd' + f.charAt(0).toUpperCase() + f.slice(1);
    const values = rows.map((r) => (r.hasDelta ? r[dField] ?? 0 : r[f] ?? 0));
    maxValues[f] = Math.max(1, ...values);
  }
  return maxValues;
}

/**
 * Get the effective display value for a field (delta when available).
 * @param {ProcessedGovernor} gov
 * @param {string} field  e.g. 'kp'
 * @returns {number}
 */
export function effectiveValue(gov, field) {
  const dField = 'd' + field.charAt(0).toUpperCase() + field.slice(1);
  return gov.hasDelta ? (gov[dField] ?? 0) : (gov[field] ?? 0);
}

/**
 * Generate demo data for two snapshots (start ~70 %, end 100 %).
 * @returns {{ startData: Governor[], endData: Governor[] }}
 */
export function generateDemoData() {
  const alliances = ['[ACE]', '[WAR]', '[RKS]', '[GOD]', '[ZEN]'];
  const names = [
    'LordKaiser', 'Dragonfire', 'NightRaven', 'SteelFist', 'IronDuke',
    'PhoenixRise', 'ThunderBolt', 'ShadowBlade', 'CrimsonKnight', 'VoidWalker',
    'StarlightX', 'ArcaneWolf', 'FrostBite', 'BlazeMaster', 'SilverStrike',
    'GoldRush', 'DawnBreaker', 'MoonLight', 'SunFury', 'TerrorMark',
  ];

  const rnd = (min, max) =>
    Math.floor(Math.random() * (max - min + 1)) + min;

  const makeSnapshot = (scale) =>
    names.map((name, i) => ({
      id:        String(1000 + i),
      name,
      alliance:  alliances[i % alliances.length],
      power:     Math.floor(rnd(50, 200) * 1e6 * scale),
      kp:        Math.floor(rnd(200, 800) * 1e6 * scale),
      t5kills:   Math.floor(rnd(50, 300) * 1e3 * scale),
      t4kills:   Math.floor(rnd(100, 600) * 1e3 * scale),
      t3kills:   0,
      t2kills:   0,
      t1kills:   0,
      deaths:    Math.floor(rnd(80, 400) * 1e3 * scale),
      resources: 0,
    }));

  return {
    startData: makeSnapshot(0.7),
    endData:   makeSnapshot(1.0),
  };
}
