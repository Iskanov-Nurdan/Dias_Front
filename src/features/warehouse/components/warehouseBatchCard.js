import {
  formatQuantityDisplay,
  parseLocaleNumber,
  resolveInventoryForm,
  inventoryFormLabel,
  warehouseStockStatusRu,
  resolveWarehousePackStructure,
  formatPacksByPiecesPhrase,
  describeOpenPackageComposition,
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

  const inv = resolveInventoryForm(b);
  const qty = b.quantity ?? b.available_quantity;
  const qtyN = parseLocaleNumber(qty);
  const qtyStr = Number.isFinite(qtyN) ? `${formatQuantityDisplay(qtyN)} шт` : fmt(qty);

  const otkAcc = b.otk_accepted;
  const otkDef = b.otk_defect;
  const otkReason = b.otk_defect_reason;
  const otkComment = b.otk_comment;
  const otkInspector = b.otk_inspector_name ?? b.otk_inspector ?? b.inspector_name;
  const otkAt = b.otk_checked_at;

  const source =
    b.source_batch_label
    ?? b.source_production_batch
    ?? b.production_batch_ref
    ?? b.production_batch_id
    ?? b.source_batch_id;

  const packStructure = resolveWarehousePackStructure(b);
  const openPackPhrase = describeOpenPackageComposition(b);
  const packPhrase =
    openPackPhrase
    || (packStructure
      ? formatPacksByPiecesPhrase(packStructure.packagesCount, packStructure.piecesPerPack)
      : null);

  return [
    { label: 'Номер партии / лот', value: fmt(b.batch ?? b.lot ?? (b.id != null ? String(b.id) : '')) },
    { label: 'Продукт', value: fmt(b.product_name ?? b.product?.name ?? b.product) },
    { label: 'Количество на складе', value: qtyStr },
    ...(packPhrase ? [{ label: 'Состав упаковки', value: packPhrase }] : []),
    { label: 'Форма хранения', value: inventoryFormLabel(inv) },
    { label: 'Статус на складе', value: warehouseStockStatusRu(b.status) },
    { label: 'Линия', value: fmt(b.line_name ?? b.line?.name ?? b.production_line) },
    {
      label: 'Параметры одной штуки (смена)',
      value: (() => {
        const h = b.unit_meters ?? b.shift_height ?? b.height;
        const w = b.shift_width ?? b.width;
        const a = b.shift_angle_deg ?? b.angle_deg;
        if ((h == null || h === '') && (w == null || w === '') && (a == null || a === '')) return '—';
        return `${h ?? '—'} × ${w ?? '—'} × ${a != null && a !== '' ? `${a}°` : '—'}`;
      })(),
    },
    { label: 'Дата выпуска / прихода', value: shortDate(b.release_date ?? b.produced_at ?? b.created_at) },
    { label: 'ОТК: принято, шт', value: fmt(otkAcc) },
    { label: 'ОТК: брак, шт', value: fmt(otkDef) },
    { label: 'ОТК: причина брака', value: fmt(otkReason) },
    { label: 'ОТК: комментарий', value: fmt(otkComment) },
    { label: 'ОТК: кто проверил', value: fmt(otkInspector) },
    { label: 'ОТК: дата проверки', value: shortDate(otkAt) },
    { label: 'Источник (выпуск)', value: fmt(source) },
  ];
}
