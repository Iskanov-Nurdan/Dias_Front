import { apiClient } from '../../../shared/api';

const blobFilenameFromHeaders = (headers, fallback) => {
  const cd = headers?.['content-disposition'] || headers?.['Content-Disposition'];
  if (!cd || typeof cd !== 'string') return fallback;
  const utf = /filename\*=UTF-8''([^;\n]+)/i.exec(cd);
  if (utf) {
    try {
      return decodeURIComponent(utf[1].trim());
    } catch {
      return fallback;
    }
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

/**
 * Что реально пришло в теле (PDF / JSON-ошибка / HTML-страница ошибки / прочее).
 * «.bin» бывает, когда Content-Type octet-stream, а внутри JSON — такие ответы не считаем накладной.
 */
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
      /* не JSON — не накладная */
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

/**
 * Скачать накладную с бэкенда (первый ответивший 200 URL).
 * Если эндпоинтов нет — генерируется локальный HTML для печати/сохранения.
 */
export async function downloadSaleWaybill(saleId, saleSnapshot = null) {
  const urls = [
    `sales/${saleId}/nakladnaya/`,
    `sales/${saleId}/waybill/`,
    `sales/${saleId}/invoice/`,
  ];
  for (const url of urls) {
    try {
      const res = await apiClient.get(url, {
        responseType: 'blob',
        headers: { Accept: 'application/pdf,application/octet-stream,*/*' },
      });
      const blob = res.data;
      if (!(blob instanceof Blob) || blob.size === 0) {
        continue;
      }

      const sniff = await sniffDownloadBlob(blob);
      if (
        sniff.kind === 'empty' ||
        sniff.kind === 'json_error' ||
        sniff.kind === 'html' ||
        sniff.kind === 'json_file'
      ) {
        continue;
      }

      const ct = (res.headers?.['content-type'] || '').toLowerCase();
      let ext = ct.includes('pdf')
        ? 'pdf'
        : ct.includes('spreadsheet') || ct.includes('excel')
          ? 'xlsx'
          : ct.includes('csv')
            ? 'csv'
            : 'bin';

      const isPdfBody = sniff.kind === 'pdf';
      const isXlsxBody = sniff.kind === 'xlsx';
      if (isPdfBody) ext = 'pdf';
      else if (isXlsxBody) ext = 'xlsx';

      const trustPdfHeader = ct.includes('pdf') && sniff.kind !== 'json_error' && sniff.kind !== 'html';
      if (!isPdfBody && !isXlsxBody && !trustPdfHeader && (ext === 'bin' || ext === 'csv')) {
        if (ext === 'bin') continue;
      }

      if (ext === 'bin' && !isPdfBody && !isXlsxBody) continue;

      let name = blobFilenameFromHeaders(res.headers, `nakladnaya-${saleId}.${ext}`);
      if (ext === 'pdf') {
        name = name.replace(/\.(bin|dat)$/i, '.pdf');
        if (!/\.pdf$/i.test(name)) name = `nakladnaya-${saleId}.pdf`;
      }

      const downloadBlob =
        isPdfBody && !ct.includes('pdf')
          ? new Blob([await blob.arrayBuffer()], { type: 'application/pdf' })
          : blob;
      triggerBlobDownload(downloadBlob, name);
      return { source: 'server' };
    } catch (e) {
      const st = e?.response?.status;
      if (st === 404 || st === 405) continue;
      throw e;
    }
  }

  // Локальный черновик (если API ещё не готов)
  const s = saleSnapshot || { id: saleId };
  const dateRow =
    s.date_display ??
    (() => {
      const raw = s.sale_date || s.date || s.created_at;
      return raw != null && String(raw).trim() !== '' ? String(raw).slice(0, 10) : '—';
    })();
  const clientRow =
    s.client_display ?? s.client_name ?? (typeof s.client === 'string' ? s.client : s.client?.name) ?? '—';
  const batchRow =
    s.batch_display ??
    s.product_name ??
    (typeof s.product === 'string' ? s.product : s.product?.name) ??
    '—';
  const qtyRow =
    s.quantity_display ??
    (s.quantity != null && String(s.quantity).trim() !== '' ? `${s.quantity} шт` : '—');
  const revenueRow =
    s.revenue_display ??
    (s.revenue != null
      ? `${s.revenue} сом`
      : s.price != null
        ? `${s.price} сом`
        : s.total != null
          ? `${s.total} сом`
          : '—');
  const costRow = s.cost_display ?? (s.cost_total != null ? `${s.cost_total} сом` : s.cost != null ? `${s.cost} сом` : '—');
  const profitRow = s.profit_display ?? (s.profit != null ? `${s.profit} сом` : '—');
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Накладная №${saleId}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{font-size:1.25rem}.muted{color:#666;font-size:0.9rem}</style></head><body>
<h1>Накладная (черновик)</h1>
<p class="muted">Сервер не отдал файл. Сохраните страницу (Ctrl+S) или распечатайте. Данные на момент скачивания.</p>
<table>
<tr><th>Продажа</th><td>№${escapeHtml(String(s.id ?? saleId))}</td></tr>
<tr><th>Дата</th><td>${escapeHtml(String(dateRow))}</td></tr>
<tr><th>Клиент</th><td>${escapeHtml(String(clientRow))}</td></tr>
<tr><th>Партия</th><td>${escapeHtml(String(batchRow))}</td></tr>
<tr><th>Количество</th><td>${escapeHtml(String(qtyRow))}</td></tr>
<tr><th>Выручка</th><td>${escapeHtml(String(revenueRow))}</td></tr>
<tr><th>Себестоимость</th><td>${escapeHtml(String(costRow))}</td></tr>
<tr><th>Прибыль</th><td>${escapeHtml(String(profitRow))}</td></tr>
${s.comment ? `<tr><th>Комментарий</th><td>${escapeHtml(String(s.comment))}</td></tr>` : ''}
</table>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, `nakladnaya-${saleId}-draft.html`);
  return { source: 'local' };
}

export async function downloadSaleReceipt(saleId) {
  const res = await apiClient.get(`sales/${saleId}/receipt/`, {
    responseType: 'blob',
    headers: { Accept: 'text/html,application/pdf,application/octet-stream,*/*' },
  });
  const blob = res.data;
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error('Пустой ответ для квитанции');
  }
  const sniff = await sniffDownloadBlob(blob);
  if (sniff.kind === 'json_error') {
    throw new Error(sniff.message || 'Ошибка при формировании квитанции');
  }
  const ct = (res.headers?.['content-type'] || '').toLowerCase();
  let ext = ct.includes('pdf') ? 'pdf' : 'html';
  if (sniff.kind === 'pdf') ext = 'pdf';
  else if (sniff.kind === 'html') ext = 'html';
  let name = blobFilenameFromHeaders(res.headers, `receipt-${saleId}.${ext}`);
  if (sniff.kind === 'pdf' && !/\.pdf$/i.test(name)) {
    name = name.replace(/\.(html|htm|bin)$/i, '.pdf');
    if (!/\.pdf$/i.test(name)) name = `receipt-${saleId}.pdf`;
  }
  const downloadBlob =
    sniff.kind === 'pdf' && !ct.includes('pdf')
      ? new Blob([await blob.arrayBuffer()], { type: 'application/pdf' })
      : blob;
  triggerBlobDownload(downloadBlob, name);
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
