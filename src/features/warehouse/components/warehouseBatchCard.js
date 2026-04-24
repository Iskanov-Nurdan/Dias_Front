import {
  formatQuantityDisplay,
  parseLocaleNumber,
  resolveInventoryForm,
  inventoryFormLabel,
  warehouseStockStatusRu,
  resolveWarehousePackStructure,
  formatPacksByPiecesPhrase,
  describeOpenPackageComposition,
  readWarehouseQuality,
  readWarehouseDefectReason,
  warehouseQualityShortLabel,
} from '../../../shared/lib';

const fmt = (v) => {
  if (v == null || v === '') return '—';
  if (typeof v === 'object') return '—';
  return String(v);
};

const shortDate = (d) => {
  if (!d) return '—';
  const s = typeof d === 'string' ? d : String(d);
  return s.length >= 10 ? s.slice(0, 10) : s;
};

/**
 * Пары «подпись — значение» для карточки партии на складе ГП (только бизнес-поля, по-русски).
 * @param {Record<string, unknown>} b
 * @returns {Array<{ label: string, value: string }>}
 */
export function buildWarehouseBatchCardRows(b) {
  if (!b || typeof b !== 'object') return [];

  const qKey = readWarehouseQuality(b);
  const defectReason = readWarehouseDefectReason(b);
  const inv = resolveInventoryForm(b);
  const qtyN = parseLocaleNumber(b.quantity);
  const reservedN = parseLocaleNumber(b.reserved_quantity);
  const availableN = parseLocaleNumber(b.available_quantity);
  const qtyStr = Number.isFinite(qtyN) ? `${formatQuantityDisplay(qtyN)} шт` : '—';
  const reservedStr = Number.isFinite(reservedN) ? `${formatQuantityDisplay(reservedN)} шт` : '—';
  const availableStr = Number.isFinite(availableN) ? `${formatQuantityDisplay(availableN)} шт` : '—';

  const packStructure = resolveWarehousePackStructure(b);
  const openPackPhrase = describeOpenPackageComposition(b);
  const packPhrase = openPackPhrase || (packStructure
    ? formatPacksByPiecesPhrase(packStructure.packagesCount, packStructure.piecesPerPack)
    : null);

  return [
    { label: 'Качество', value: warehouseQualityShortLabel(qKey) },
    ...(defectReason ? [{ label: 'Причина брака', value: defectReason }] : []),
    { label: 'Партия', value: fmt(b.batch) },
    { label: 'Продукт', value: fmt(b.product_name) },
    { label: 'Физический остаток', value: qtyStr },
    { label: 'Зарезервировано', value: reservedStr },
    { label: 'Свободно', value: availableStr },
    ...(packPhrase ? [{ label: 'Состав упаковки', value: packPhrase }] : []),
    { label: 'Форма хранения', value: inventoryFormLabel(inv) },
    { label: 'Статус на складе', value: warehouseStockStatusRu(b.status) },
    { label: 'Линия', value: fmt(b.line_name) },
    { label: 'Дата выпуска', value: shortDate(b.release_date) },
  ];
}
