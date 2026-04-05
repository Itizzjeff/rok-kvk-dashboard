/**
 * csv-parser.js — CSV parsing and column normalisation
 *
 * Accepts the raw text of a Rise of Kingdoms "Kingdom Member Data"
 * CSV export and returns a normalised array of Governor objects.
 */

/**
 * Maps known column name variants (lower-cased) to internal field names.
 * Add additional variants here if your game locale uses different headers.
 * @type {Record<string, string>}
 */
const COLUMN_MAP = {
  // Governor identifier
  'governor id':  'id',
  'id':           'id',

  // Display name
  'governor name': 'name',
  'name':          'name',
  'nickname':      'name',

  // Alliance
  'alliance name': 'alliance',
  'alliance':      'alliance',

  // Power
  'power': 'power',

  // Kill Points
  'kill points':  'kp',
  'kill point':   'kp',
  'killpoints':   'kp',

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

  // T3 kills (tracked but not displayed prominently)
  't3 kills':    't3kills',
  't3kills':     't3kills',
  'tier3 kills': 't3kills',

  // T2 kills
  't2 kills':    't2kills',
  't2kills':     't2kills',

  // T1 kills
  't1 kills':    't1kills',
  't1kills':     't1kills',

  // Deaths / troops lost
  'deaths':       'deaths',
  'dead':         'deaths',
  'troops lost':  'deaths',
  'troop deaths': 'deaths',

  // Resources Gathered (informational)
  'resources gathered': 'resources',
  'resource gathered':  'resources',
};

/**
 * Parse a number string that may contain commas or other formatting.
 * @param {unknown} value
 * @returns {number}
 */
function parseNumber(value) {
  if (value === undefined || value === null || value === '') return 0;
  return parseInt(String(value).replace(/[^0-9]/g, ''), 10) || 0;
}

/**
 * Normalise a CSV header string for lookup.
 * @param {string} header
 * @returns {string}
 */
function normaliseHeader(header) {
  return header.toLowerCase().trim().replace(/\s+/g, ' ');
}

/**
 * Build a mapping from raw CSV header → internal field name
 * for a given set of headers.
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
 * @property {number} kp
 * @property {number} t5kills
 * @property {number} t4kills
 * @property {number} t3kills
 * @property {number} t2kills
 * @property {number} t1kills
 * @property {number} deaths
 * @property {number} resources
 */

/**
 * Parse a CSV string into an array of normalised Governor objects.
 * Requires PapaParse to be loaded globally.
 * @param {string} csvText
 * @returns {Governor[]}
 */
export function parseCSV(csvText) {
  const result = window.Papa.parse(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (!result.data.length) return [];

  const headers = Object.keys(result.data[0]);
  const headerMap = buildHeaderMapping(headers);

  return result.data
    .map((row) => {
      /** @type {Governor} */
      const gov = {
        id:        '',
        name:      '',
        alliance:  '',
        power:     0,
        kp:        0,
        t5kills:   0,
        t4kills:   0,
        t3kills:   0,
        t2kills:   0,
        t1kills:   0,
        deaths:    0,
        resources: 0,
      };

      for (const [rawHeader, field] of Object.entries(headerMap)) {
        const rawValue = row[rawHeader];
        if (field === 'id' || field === 'name' || field === 'alliance') {
          gov[field] = String(rawValue ?? '').trim();
        } else {
          gov[field] = parseNumber(rawValue);
        }
      }

      return gov;
    })
    .filter((g) => g.name !== '' || g.id !== '');
}
