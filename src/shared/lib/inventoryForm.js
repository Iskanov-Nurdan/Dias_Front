import { parseLocaleNumber } from './numbers';

/**
 * Форма учёта партии на складе ГП (согласовано с ТЗ для бэкенда).
 * @typedef {'unpacked' | 'packed' | 'open_package'} InventoryForm
 */

/**
 * Определяет форму учёта по полям записи склада (см. docs/BACKEND_WAREHOUSE_OTK_SALES.md).
 * @param {Record<string, unknown>|null|undefined} batch
 * @returns {InventoryForm}
 */
export function resolveInventoryForm(batch) {
  if (!batch || typeof batch !== 'object') return 'unpacked';

  const inv = batch.inventory_form;
  if (inv != null && inv !== '') {
    const s = String(inv).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (['not_packed', 'notpacked'].includes(s)) return 'unpacked';
    if (['packed', 'упакован', 'упаковано', 'sealed', 'pack'].includes(s)) return 'packed';
    if (
      ['open_package', 'opened', 'open', 'открыт', 'открытая_упаковка', 'открытаяупаковка'].includes(s)
    ) {
      return 'open_package';
    }
    if (['unpacked', 'не_упакован', 'неупакован', 'loose', 'bulk', 'распакован'].includes(s)) {
      return 'unpacked';
    }
  }

  const raw = batch.packaging_state ?? batch.stock_form ?? batch.sk_g_packaging;
  if (raw != null && raw !== '') {
    const s = String(raw).toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
    if (['not_packed', 'notpacked'].includes(s)) return 'unpacked';
    if (['packed', 'упакован', 'упаковано', 'sealed', 'pack'].includes(s)) return 'packed';
    if (
      ['open_package', 'opened', 'open', 'открыт', 'открытая_упаковка', 'открытаяупаковка'].includes(s)
    ) {
      return 'open_package';
    }
    if (['unpacked', 'не_упакован', 'неупакован', 'loose', 'bulk', 'распакован'].includes(s)) {
      return 'unpacked';
    }
  }

  const ps = String(batch.packaging_status ?? batch.pack_status ?? '')
    .toLowerCase()
    .replace(/-/g, '_');
  if (ps === 'not_packed' || ps === 'notpacked') return 'unpacked';
  if (ps === 'packed' || ps === 'sealed') return 'packed';
  if (ps === 'opened' || ps === 'open_package' || ps === 'open') return 'open_package';

  const openFlag =
    batch.open_package === true ||
    batch.package_opened === true ||
    batch.is_open_package === true ||
    Number(batch.open_packages_count) > 0;
  if (openFlag) return 'open_package';

  const pp = parseLocaleNumber(batch.pieces_per_package ?? batch.pieces_in_package ?? batch.pieces_per_pack);
  const pm = parseLocaleNumber(batch.package_total_meters ?? batch.package_meters ?? batch.pack_total_meters);
  if ((Number.isFinite(pp) && pp > 0) || (Number.isFinite(pm) && pm > 0)) return 'packed';

  return 'unpacked';
}

export function inventoryFormLabel(form) {
  switch (form) {
    case 'packed':
      return 'Упаковано';
    case 'open_package':
      return 'Открытая упаковка';
    default:
      return 'Не упаковано';
  }
}

/** CSS-модификатор для бейджа (warehouse / sales). */
export function inventoryFormBadgeModifier(form) {
  if (form === 'packed') return 'inv-packed';
  if (form === 'open_package') return 'inv-open';
  return 'inv-unpacked';
}
