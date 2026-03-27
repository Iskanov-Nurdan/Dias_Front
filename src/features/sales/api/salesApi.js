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
      const ct = (res.headers?.['content-type'] || '').toLowerCase();
      const ext = ct.includes('pdf')
        ? 'pdf'
        : ct.includes('spreadsheet') || ct.includes('excel')
          ? 'xlsx'
          : ct.includes('csv')
            ? 'csv'
            : 'bin';
      const name = blobFilenameFromHeaders(res.headers, `nakladnaya-${saleId}.${ext}`);
      triggerBlobDownload(blob, name);
      return { source: 'server' };
    } catch (e) {
      const st = e?.response?.status;
      if (st === 404 || st === 405) continue;
      throw e;
    }
  }

  // Локальный черновик (если API ещё не готов)
  const s = saleSnapshot || { id: saleId };
  const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Накладная №${saleId}</title>
<style>body{font-family:system-ui,sans-serif;padding:24px;max-width:720px;margin:0 auto}table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:8px;text-align:left}h1{font-size:1.25rem}.muted{color:#666;font-size:0.9rem}</style></head><body>
<h1>Накладная (черновик)</h1>
<p class="muted">Сервер не отдал файл. Сохраните страницу (Ctrl+S) или распечатайте. Данные на момент скачивания.</p>
<table>
<tr><th>ID продажи</th><td>${escapeHtml(String(s.id ?? saleId))}</td></tr>
${s.client_name != null ? `<tr><th>Клиент</th><td>${escapeHtml(String(s.client_name))}</td></tr>` : ''}
${s.product_name != null ? `<tr><th>Продукт</th><td>${escapeHtml(String(s.product_name))}</td></tr>` : ''}
${s.quantity != null ? `<tr><th>Количество (шт)</th><td>${escapeHtml(String(s.quantity))}</td></tr>` : ''}
${s.price != null ? `<tr><th>Цена</th><td>${escapeHtml(String(s.price))}</td></tr>` : ''}
${s.comment ? `<tr><th>Комментарий</th><td>${escapeHtml(String(s.comment))}</td></tr>` : ''}
</table>
</body></html>`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  triggerBlobDownload(blob, `nakladnaya-${saleId}-draft.html`);
  return { source: 'local' };
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
