/**
 * Whitelist API paths for X-Audit-Shift-Id (см. DIas_ERP docs/FRONTEND_SHIFT_AUDIT_PROMPT.md).
 * Пути относительно baseURL apiClient (без /api/).
 */

const MUTATION_METHODS = new Set(['post', 'put', 'patch', 'delete']);

/** Длинные префиксы первыми, чтобы warehouse/batches не матчился как batches/. */
const AUDIT_SHIFT_PATH_PREFIXES = [
  'raw-materials/',
  'incoming/',
  'materials/',
  'chemistry/',
  'workshop/',
  'warehouse/',
  'production/',
  'batches/',
  'clients/',
  'orders/',
  'sales/',
  'payments/',
  'shifts/',
];

const AUDIT_SHIFT_EXACT_PATHS = new Set(['raw-materials', 'incoming']);

/**
 * @param {string} url — axios config.url
 * @param {string} [baseURL]
 * @returns {string}
 */
export function getApiRelativePath(url, baseURL) {
  const raw = String(url || '').split('?')[0];
  if (raw.startsWith('http://') || raw.startsWith('https://')) {
    try {
      const p = new URL(raw).pathname;
      const idx = p.indexOf('/api/');
      return idx >= 0 ? p.slice(idx + 5).replace(/^\//, '') : p.replace(/^\//, '');
    } catch {
      return raw.replace(/^\//, '');
    }
  }
  if (baseURL && (baseURL.startsWith('http://') || baseURL.startsWith('https://'))) {
    try {
      const p = new URL(raw, baseURL.endsWith('/') ? baseURL : `${baseURL}/`).pathname;
      const idx = p.indexOf('/api/');
      return idx >= 0 ? p.slice(idx + 5).replace(/^\//, '') : p.replace(/^\//, '');
    } catch {
      /* fall through */
    }
  }
  return raw.replace(/^\//, '');
}

function pathMatchesPrefix(relPath, prefix) {
  if (prefix.endsWith('/')) {
    return relPath.startsWith(prefix) || relPath === prefix.slice(0, -1);
  }
  return relPath === prefix || relPath.startsWith(`${prefix}/`);
}

/**
 * @param {string} url
 * @param {string} [method]
 * @param {string} [baseURL]
 */
export function isAuditShiftMutation(url, method, baseURL) {
  const m = (method || 'get').toLowerCase();
  if (!MUTATION_METHODS.has(m)) return false;

  const rel = getApiRelativePath(url, baseURL);
  if (!rel) return false;

  if (AUDIT_SHIFT_EXACT_PATHS.has(rel)) return true;

  return AUDIT_SHIFT_PATH_PREFIXES.some((p) => pathMatchesPrefix(rel, p));
}
