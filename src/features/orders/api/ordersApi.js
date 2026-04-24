import { apiClient } from '../../../shared/api';

const blobFilenameFromHeaders = (headers, fallback) => {
  const cd = headers?.['content-disposition'] || headers?.['Content-Disposition'];
  if (!cd || typeof cd !== 'string') return fallback;
  const utf = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
  if (utf) {
    try { return decodeURIComponent(utf[1].trim()); } catch { return fallback; }
  }
  const plain = /filename="([^"]+)"/i.exec(cd) || /filename=([^;\n]+)/i.exec(cd);
  if (plain) return plain[1].trim().replace(/^["']|["']$/g, '');
  return fallback;
};

const triggerBlobDownload = (blob, filename) => {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
};

function skipBomAndAsciiWhitespaceStart(u) {
  let i = 0;
  if (u.length >= 3 && u[0] === 0xef && u[1] === 0xbb && u[2] === 0xbf) i = 3;
  while (i < u.length && (u[i] === 9 || u[i] === 10 || u[i] === 13 || u[i] === 32)) i += 1;
  return i;
}

async function sniffDownloadBlob(blob) {
  if (!(blob instanceof Blob) || blob.size === 0) return { kind: 'empty' };
  const headLen = Math.min(blob.size, 16384);
  const u = new Uint8Array(await blob.slice(0, headLen).arrayBuffer());
  const start = skipBomAndAsciiWhitespaceStart(u);
  if (
    start + 4 <= u.length &&
    u[start] === 0x25 &&
    u[start + 1] === 0x50 &&
    u[start + 2] === 0x44 &&
    u[start + 3] === 0x46
  ) {
    return { kind: 'pdf' };
  }
  if (start < u.length && (u[start] === 0x7b || u[start] === 0x5b)) {
    const fullText = await blob.text();
    try {
      const j = JSON.parse(fullText);
      const detail =
        typeof j?.detail === 'string'
          ? j.detail
          : Array.isArray(j?.detail)
            ? j.detail.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))).join('; ')
            : null;
      const err = typeof j?.error === 'string' ? j.error : null;
      if (detail || err) return { kind: 'json_error', message: detail || err || 'Ошибка API' };
    } catch {
      /* не JSON */
    }
    return { kind: 'json_file' };
  }
  if (start < u.length && u[start] === 0x3c) {
    return { kind: 'html' };
  }
  if (
    start + 4 <= u.length &&
    u[start] === 0x50 &&
    u[start + 1] === 0x4b &&
    (u[start + 2] === 0x03 || u[start + 2] === 0x05 || u[start + 2] === 0x07) &&
    (u[start + 3] === 0x04 || u[start + 3] === 0x06 || u[start + 3] === 0x08)
  ) {
    return { kind: 'xlsx' };
  }
  return { kind: 'unknown' };
}

export const getOrders = (params) => apiClient.get('orders/', { params });
export const getOrder = (id) => apiClient.get(`orders/${id}/`);
export const getOrderSelectSources = () => apiClient.get('orders/select-sources/');
export const createOrder = (payload) => apiClient.post('orders/', payload);
export const updateOrder = (id, payload) => apiClient.patch(`orders/${id}/`, payload);
export const patchOrderStatus = (id, status) => apiClient.patch(`orders/${id}/status/`, { status });
export const cancelOrder = (id) => apiClient.patch(`orders/${id}/cancel/`);
export const getOrderReservations = (id) => apiClient.get(`orders/${id}/reservations/`);

export const downloadOrderWaybill = async (orderId) => {
  const res = await apiClient.get(`orders/${orderId}/waybill/`, {
    responseType: 'blob',
    headers: { Accept: 'text/html,*/*' },
  });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.size === 0) throw new Error('Пустой ответ по накладной заявки');

  const sniff = await sniffDownloadBlob(blob);
  if (sniff.kind === 'json_error') {
    throw new Error(sniff.message || 'Ошибка при формировании накладной');
  }

  const ct = (res.headers?.['content-type'] || '').toLowerCase();
  if (sniff.kind !== 'html' && !ct.includes('text/html')) {
    throw new Error('Неверный формат накладной заявки');
  }

  const filename = blobFilenameFromHeaders(res.headers, `order-waybill-${orderId}.html`);
  triggerBlobDownload(blob, filename);
};
