/**
 * cloud.js — JSONBin.io cloud save/load
 *
 * Gives each saved dashboard a short ID (~24 chars) so the share URL
 * stays clean: ?bin=663c7f3aad19ca34f85c3c21
 *
 * Free tier at jsonbin.io: 10 000 requests/month, unlimited bins.
 * The API key is stored only in the user's own localStorage — it is
 * never sent to any server other than api.jsonbin.io.
 */

const BASE_URL    = 'https://api.jsonbin.io/v3/b';
const KEY_STORAGE = 'rok-jsonbin-key';

/**
 * Remove zero/null numeric fields from every governor row in every snapshot.
 * Strings (name, alliance) are always kept. This can cut payload size by 60-80%
 * when most stats are 0 (e.g. a base scan before KvK starts).
 */
function minifyPayload(payload) {
  if (!Array.isArray(payload?.snapshots)) return payload;
  return {
    ...payload,
    snapshots: payload.snapshots.map((snap) => ({
      ...snap,
      data: snap.data.map((gov) => {
        const out = {};
        for (const [k, v] of Object.entries(gov)) {
          if (typeof v === 'number' && v === 0) continue;
          if (v === null || v === undefined) continue;
          out[k] = v;
        }
        return out;
      }),
    })),
  };
}

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * Save a dashboard payload to JSONBin (always creates a new bin).
 * @param {object} payload
 * @param {string} name — used as the bin name
 * @returns {Promise<string>} bin ID
 * @throws if no API key is set or the request fails
 */
export async function saveToCloud(payload, name = 'KvK Dashboard') {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error('NO_KEY');

  // Strip zero-value numeric fields, then compress with base64-safe lz-string.
  const slim       = minifyPayload(payload);
  const compressed = LZString.compressToBase64(JSON.stringify(slim));
  const envelope   = { v: 1, c: compressed };

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'X-Master-Key':   apiKey,
      'X-Bin-Name':     name.slice(0, 128),
      'X-Bin-Private':  'false',
    },
    body: JSON.stringify(envelope),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message ?? `HTTP ${res.status}`);
  }

  const data = await res.json();
  return data.metadata.id;
}

/**
 * Load a dashboard payload from JSONBin by ID.
 * @param {string} binId
 * @returns {Promise<object>}
 */
export async function loadFromCloud(binId) {
  const res = await fetch(`${BASE_URL}/${binId}/latest`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  const record = data.record;
  // Handle compressed envelope (v:1) written by saveToCloud
  if (record?.v === 1 && record?.c) {
    return JSON.parse(LZString.decompressFromBase64(record.c));
  }
  return record;
}

/** @returns {string|null} */
export function getApiKey() {
  return localStorage.getItem(KEY_STORAGE);
}

/** @param {string} key */
export function setApiKey(key) {
  localStorage.setItem(KEY_STORAGE, key.trim());
}

export function clearApiKey() {
  localStorage.removeItem(KEY_STORAGE);
}

// ----------------------------------------------------------------
// Saved dashboards list (stored in localStorage)
// ----------------------------------------------------------------

const SAVED_KEY = 'rok-saved-dashboards';

/** @returns {{ binId: string, name: string, savedAt: string }[]} */
export function getSavedDashboards() {
  try {
    return JSON.parse(localStorage.getItem(SAVED_KEY) ?? '[]');
  } catch { return []; }
}

/** @param {{ binId: string, name: string }} entry */
export function addSavedDashboard(entry) {
  const list = getSavedDashboards().filter(d => d.binId !== entry.binId);
  list.unshift({ ...entry, savedAt: new Date().toISOString() });
  localStorage.setItem(SAVED_KEY, JSON.stringify(list.slice(0, 20)));
}

/** @param {string} binId */
export function removeSavedDashboard(binId) {
  const list = getSavedDashboards().filter(d => d.binId !== binId);
  localStorage.setItem(SAVED_KEY, JSON.stringify(list));
}
