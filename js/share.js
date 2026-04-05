/**
 * share.js — URL-based state sharing
 *
 * Serialises the KvK name + both CSV snapshots into a compressed,
 * URL-safe string appended as ?d=… so anyone with the link sees the
 * same data without a backend.
 *
 * Requires lz-string to be loaded globally as `window.LZString`.
 */

import { t } from './i18n.js';

// ----------------------------------------------------------------
// Public API
// ----------------------------------------------------------------

/**
 * @typedef {Object} SharePayload
 * @property {string}                              name
 * @property {import('./csv-parser.js').Governor[]|null} start
 * @property {import('./csv-parser.js').Governor[]|null} end
 */

/**
 * Encode a payload into a URL and copy it to the clipboard.
 * @param {SharePayload} payload
 * @returns {string} The generated URL
 */
export function encodeAndShare(payload) {
  const compressed = window.LZString.compressToEncodedURIComponent(
    JSON.stringify(payload),
  );
  const url = buildUrl(compressed);
  copyToClipboard(url);
  return url;
}

/**
 * Attempt to decode a ?d= parameter from the current URL.
 * @returns {SharePayload|null}
 */
export function decodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const d = params.get('d');
  if (!d) return null;

  try {
    const raw     = window.LZString.decompressFromEncodedURIComponent(d);
    const payload = JSON.parse(raw);
    if (typeof payload !== 'object' || payload === null) return null;
    if (!Array.isArray(payload.snapshots)) return null;
    return payload;
  } catch {
    console.error('[share] Failed to decode URL payload');
    return null;
  }
}

/**
 * Show the URL input box and populate it.
 * @param {string} url
 */
export function displaySharedUrl(url) {
  const box = document.getElementById('url-box');
  const inp = document.getElementById('url-display');
  if (box) box.classList.add('visible');
  if (inp) inp.value = url;
}

/**
 * Copy the current value in the URL input to the clipboard.
 */
export function copyDisplayedUrl() {
  const inp = document.getElementById('url-display');
  if (inp) copyToClipboard(inp.value);
}

/**
 * Remove the ?d= parameter from the browser history without reloading.
 */
export function clearUrlParam() {
  history.replaceState(null, '', window.location.pathname);
}

// ----------------------------------------------------------------
// Internal helpers
// ----------------------------------------------------------------

function buildUrl(compressed) {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}?d=${compressed}`;
}

function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).catch(fallbackCopy.bind(null, text));
  } else {
    fallbackCopy(text);
  }
}

function fallbackCopy(text) {
  const el = document.createElement('textarea');
  el.value = text;
  el.style.position = 'fixed';
  el.style.opacity  = '0';
  document.body.appendChild(el);
  el.select();
  document.execCommand('copy');
  document.body.removeChild(el);
}
