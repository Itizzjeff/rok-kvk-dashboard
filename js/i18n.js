/**
 * i18n.js — Internationalisation (English / Japanese)
 *
 * Usage:
 *   import { t, setLang, getLang } from './i18n.js';
 *   t('upload.title')  // → "RoK KvK Dashboard"
 */

const TRANSLATIONS = {
  en: {
    // Header
    'header.logo':    '⚔️ KvK Dashboard',
    'header.sub':     'Rise of Kingdoms',
    'header.share':   '🔗 Share',
    'header.back':    '← Back',

    // Upload screen
    'upload.title':      '⚔️ RoK KvK Dashboard',
    'upload.subtitle':   'Upload two CSV exports (KvK start & end) to track performance delta — or just one for a snapshot view.',
    'upload.kvkLabel':   'KvK Name / Season',
    'upload.kvkPlaceholder': 'e.g. KvK Season 5 — March 2026',
    'upload.startLabel': 'KvK Start',
    'upload.startHint':  'CSV export — beginning of KvK',
    'upload.endLabel':   'KvK End',
    'upload.endHint':    'CSV export — end of KvK',
    'upload.btnShow':    'Show Dashboard →',
    'upload.btnDemo':    'Load Demo',
    'upload.or':         'or',
    'upload.loaded':     '✓ {n} governors loaded',
    'upload.urlLabel':   '🔗 Load shared URL',

    // KvK banner
    'banner.tagDelta':    'DELTA',
    'banner.tagSnapshot': 'SNAPSHOT',
    'banner.metaDelta':   '{s} governors (start) → {e} governors (end)',
    'banner.metaSnap':    '{n} governors — snapshot',

    // Stat cards
    'stat.governors': 'Governors',
    'stat.total':     'Total',
    'stat.kp':        'Kill Points',
    'stat.kpTotal':   'Kingdom total',
    'stat.t5':        'T5 Kills',
    'stat.t4':        'T4 Kills',
    'stat.deaths':    'Deaths',
    'stat.topKp':     'Top Kill Points',
    'stat.topT5':     'Top T5 Kills',

    // Tabs
    'tab.rankings': '🏆 Rankings',
    'tab.charts':   '📈 Development',

    // Filters & table
    'filter.search':       '🔍 Search governor…',
    'filter.allAlliances': 'All alliances',
    'filter.count':        '{f} / {t} governors',

    // Sort pills
    'sort.kp':     'Kill Points',
    'sort.t5':     'T5 Kills',
    'sort.t4':     'T4 Kills',
    'sort.deaths': 'Deaths',
    'sort.power':  'Power',

    // Table headers
    'th.rank':    '#',
    'th.gov':     'Governor',
    'th.kp':      'Kill Points',
    'th.t5':      'T5 Kills',
    'th.t4':      'T4 Kills',
    'th.deaths':  'Deaths',
    'th.power':   'Power',
    'th.kd':      'K/D',

    // Chart titles
    'chart.kp':     'Top 10 — Kill Points',
    'chart.t5':     'Top 10 — T5 Kills',
    'chart.deaths': 'Top 10 — Deaths',
    'chart.power':  'Top 10 — Power Gain',

    // URL share
    'share.copied': '✓ URL copied!',
    'share.copy':   'Copy',
  },

  ja: {
    // Header
    'header.logo':    '⚔️ KvK ダッシュボード',
    'header.sub':     'ライズ・オブ・キングダム',
    'header.share':   '🔗 シェア',
    'header.back':    '← 戻る',

    // Upload screen
    'upload.title':      '⚔️ RoK KvK ダッシュボード',
    'upload.subtitle':   'KvK開始・終了時のCSVを2つアップロードして差分を確認、または1つだけでスナップショット表示できます。',
    'upload.kvkLabel':   'KvK名 / シーズン',
    'upload.kvkPlaceholder': '例: KvKシーズン5 — 2026年3月',
    'upload.startLabel': 'KvK 開始',
    'upload.startHint':  'CSVエクスポート — KvK開始時',
    'upload.endLabel':   'KvK 終了',
    'upload.endHint':    'CSVエクスポート — KvK終了時',
    'upload.btnShow':    'ダッシュボードを表示 →',
    'upload.btnDemo':    'デモを読み込む',
    'upload.or':         'または',
    'upload.loaded':     '✓ {n}人のガバナーを読み込みました',
    'upload.urlLabel':   '🔗 共有URLから読み込む',

    // KvK banner
    'banner.tagDelta':    'DELTA',
    'banner.tagSnapshot': 'SNAPSHOT',
    'banner.metaDelta':   '開始: {s}人 → 終了: {e}人のガバナー',
    'banner.metaSnap':    '{n}人のガバナー — スナップショット',

    // Stat cards
    'stat.governors': 'ガバナー',
    'stat.total':     '合計',
    'stat.kp':        'キルポイント',
    'stat.kpTotal':   'キングダム合計',
    'stat.t5':        'T5 キル',
    'stat.t4':        'T4 キル',
    'stat.deaths':    '死亡数',
    'stat.topKp':     'トップ KP',
    'stat.topT5':     'トップ T5キル',

    // Tabs
    'tab.rankings': '🏆 ランキング',
    'tab.charts':   '📈 推移グラフ',

    // Filters & table
    'filter.search':       '🔍 ガバナーを検索…',
    'filter.allAlliances': '全アライアンス',
    'filter.count':        '{f} / {t} 人',

    // Sort pills
    'sort.kp':     'キルポイント',
    'sort.t5':     'T5 キル',
    'sort.t4':     'T4 キル',
    'sort.deaths': '死亡数',
    'sort.power':  '戦力',

    // Table headers
    'th.rank':    '#',
    'th.gov':     'ガバナー',
    'th.kp':      'キルポイント',
    'th.t5':      'T5 キル',
    'th.t4':      'T4 キル',
    'th.deaths':  '死亡数',
    'th.power':   '戦力',
    'th.kd':      'K/D',

    // Chart titles
    'chart.kp':     'TOP 10 — キルポイント',
    'chart.t5':     'TOP 10 — T5 キル',
    'chart.deaths': 'TOP 10 — 死亡数',
    'chart.power':  'TOP 10 — 戦力増加',

    // URL share
    'share.copied': '✓ URLをコピーしました！',
    'share.copy':   'コピー',
  },
};

let currentLang = 'en';

/**
 * Translate a key, with optional variable interpolation.
 * @param {string} key
 * @param {Record<string, string|number>} [vars]
 * @returns {string}
 */
export function t(key, vars = {}) {
  const dict = TRANSLATIONS[currentLang] ?? TRANSLATIONS.en;
  let str = dict[key] ?? TRANSLATIONS.en[key] ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replaceAll(`{${k}}`, v);
  }
  return str;
}

/** @param {'en'|'ja'} lang */
export function setLang(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  document.documentElement.lang = lang;
  localStorage.setItem('rok-lang', lang);
}

/** @returns {'en'|'ja'} */
export function getLang() {
  return currentLang;
}

/** Restore previously saved language preference. */
export function initLang() {
  const saved = localStorage.getItem('rok-lang');
  if (saved && TRANSLATIONS[saved]) currentLang = saved;
  document.documentElement.lang = currentLang;
}
