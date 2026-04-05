/**
 * csv-parser.js — File parsing and column normalisation
 *
 * Supports both XLSX and CSV exports from Rise of Kingdoms.
 * XLSX parsing uses SheetJS (loaded globally as window.XLSX).
 * CSV parsing uses PapaParse (loaded globally as window.Papa).
 */

/**
 * Maps known column name variants (lower-cased) to internal field names.
 *
 * The in-game "Kingdom Member Data" export uses these exact headers:
 *   Character ID, Username, Power, Highest Power,
 *   T5 Deaths, T4 Deaths, Total Kill Points, T5 Kills, T4 Kills,
 *   Resources Gathered
 *
 * Additional variants are kept for compatibility with other export formats.
 * @type {Record<string, string>}
 */
const COLUMN_MAP = {
  // Governor identifier
  'character id':  'id',
  'governor id':   'id',
  'id':            'id',

  // Display name
  'username':      'name',
  'governor name': 'name',
  'name':          'name',
  'nickname':      'name',

  // Alliance
  'alliance name': 'alliance',
  'alliance':      'alliance',

  // Power
  'power':         'power',
  'highest power': 'highestPower',

  // Kill Points
  'total kill points': 'kp',
  'kill points':       'kp',
  'kill point':        'kp',
  'killpoints':        'kp',

  // T5 kills
  't5 kills':    't5kills',
  't5kills':     't5kills',
  'tier5 kills': 't5kills',
  'kills tier5': 't5kills',
  't5 kill':     't5kills',

  // T4 kills
  't4 kills':    't4kills',
  't4kills':     't4kills',
  'tier4 kills': 't4kills',
  'kills tier4': 't4kills',
  't4 kill':     't4kills',

  // T3 kills
  't3 kills':    't3kills',
  't3kills':     't3kills',
  'tier3 kills': 't3kills',

  // T2 kills
  't2 kills':    't2kills',
  't2kills':     't2kills',

  // T1 kills
  't1 kills':    't1kills',
  't1kills':     't1kills',

  // Deaths — game exports T4 and T5 deaths separately
  't5 deaths':    't5deaths',
  't5deaths':     't5deaths',
  't4 deaths':    't4deaths',
  't4deaths':     't4deaths',
  't3 deaths':    't3deaths',
  't3deaths':     't3deaths',

  // Legacy / other export formats that use a single "deaths" column
  'deaths':       'deaths',
  'dead':         'deaths',
  'troops lost':  'deaths',
  'troop deaths': 'deaths',

  // Resources
  'resources gathered': 'resources',
  'resource gathered':  'resources',
};

/** String fields — everything else is numeric. */
const STRING_FIELDS = new Set(['id', 'name', 'alliance']);

/**
 * Parse a value to a non-negative integer.
 * Strips commas, currency symbols, and other non-digit characters.
 * @param {unknown} value
 * @returns {number}
 */
function parseNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  const n = parseInt(String(value).replace(/[^0-9]/g, ''), 10);
  return isNaN(n) ? 0 : n;
}

/**
 * Normalise a header string for map lookup.
 * @param {string} header
 * @returns {string}
 */
function normaliseHeader(header) {
  return String(header).toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Build a mapping from raw header string → internal field name.
 * @param {string[]} headers
 * @returns {Record<string, string>}
 */
function buildHeaderMapping(headers) {
  const mapping = {};
  for (const header of headers) {
    const norm = normaliseHeader(header);
    if (COLUMN_MAP[norm]) {
      mapping[header] = COLUMN_MAP[norm];
    }
  }
  return mapping;
}

/**
 * @typedef {Object} Governor
 * @property {string} id
 * @property {string} name
 * @property {string} alliance
 * @property {number} power
 * @property {number} highestPower
 * @property {number} kp
 * @property {number} t5kills
 * @property {number} t4kills
 * @property {number} t3kills
 * @property {number} t2kills
 * @property {number} t1kills
 * @property {number} t5deaths
 * @property {number} t4deaths
 * @property {number} t3deaths
 * @property {number} deaths     — combined total (t4deaths + t5deaths, or direct if only one column)
 * @property {number} resources
 */

/**
 * Normalise a raw row object into a Governor using the header mapping.
 * After mapping, computes the combined `deaths` field.
 * @param {Record<string, unknown>} row
 * @param {Record<string, string>} headerMap
 * @returns {Governor}
 */
function normaliseRow(row, headerMap) {
  /** @type {Governor} */
  const gov = {
    id:           '',
    name:         '',
    alliance:     '',
    power:        0,
    highestPower: 0,
    kp:           0,
    t5kills:      0,
    t4kills:      0,
    t3kills:      0,
    t2kills:      0,
    t1kills:      0,
    t5deaths:     0,
    t4deaths:     0,
    t3deaths:     0,
    deaths:       0,
    resources:    0,
  };

  for (const [rawHeader, field] of Object.entries(headerMap)) {
    const raw = row[rawHeader];
    gov[field] = STRING_FIELDS.has(field)
      ? String(raw ?? '').trim()
      : parseNumber(raw);
  }

  // Combine separate death columns into a single `deaths` total.
  // If the export already has a combined "deaths" column, keep it as-is.
  const combinedDeaths = gov.t5deaths + gov.t4deaths + gov.t3deaths;
  if (combinedDeaths > 0 || gov.deaths === 0) {
    gov.deaths = combinedDeaths;
  }

  return gov;
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Parse an XLSX ArrayBuffer into an array of Governor objects.
 * Requires SheetJS to be loaded globally as `window.XLSX`.
 * @param {ArrayBuffer} buffer
 * @returns {Governor[]}
 */
export function parseXLSX(buffer) {
  const workbook  = window.XLSX.read(buffer, { type: 'array' });
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = window.XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

  if (!rows.length) return [];

  const headers   = Object.keys(rows[0]);
  const headerMap = buildHeaderMapping(headers);

  return rows
    .map((row) => normaliseRow(row, headerMap))
    .filter((g) => g.name !== '' || g.id !== '');
}

/**
 * Parse a CSV string into an array of Governor objects.
 * Requires PapaParse to be loaded globally as `window.Papa`.
 * @param {string} csvText
 * @returns {Governor[]}
 */
export function parseCSV(csvText) {
  const result = window.Papa.parse(csvText, {
    header:         true,
    skipEmptyLines: true,
  });

  if (!result.data.length) return [];

  const headers   = Object.keys(result.data[0]);
  const headerMap = buildHeaderMapping(headers);

  return result.data
    .map((row) => normaliseRow(row, headerMap))
    .filter((g) => g.name !== '' || g.id !== '');
}
