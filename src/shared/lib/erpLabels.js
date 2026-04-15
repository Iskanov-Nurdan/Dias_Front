/**
 * Единые человекочитаемые подписи для ERP (без сырых значений API в UI).
 */

/** Статус строки склада ГП */
export function warehouseStockStatusRu(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'available') return 'Доступно';
  if (s === 'reserved') return 'Зарезервировано';
  if (s === 'shipped' || s === 'sold') return 'Продано';
  if (!s) return '—';
  return String(status);
}

/** Статус ОТК в истории / карточке */
export function otkResultStatusRu(batch) {
  const s = String(batch?.otk_status ?? batch?.status ?? '').toLowerCase();
  const acc = Number(batch?.otk_accepted ?? batch?.accepted) || 0;
  const def = Number(batch?.otk_defect ?? batch?.rejected ?? batch?.defect) || 0;

  if (!s || s === 'pending' || s === 'awaiting' || s === 'waiting' || s === 'ожидание') {
    return { label: 'Ожидает проверки', tone: 'orange' };
  }
  if (s === 'accepted' || s === 'принято' || s === 'ok') {
    if (def > 0 && acc > 0) return { label: 'Принято с браком', tone: 'amber' };
    if (def > 0 && acc <= 0) return { label: 'Забраковано', tone: 'red' };
    return { label: 'Принято', tone: 'green' };
  }
  if (s === 'rejected' || s === 'defect' || s === 'брак' || s === 'failed') {
    return { label: 'Забраковано', tone: 'red' };
  }
  return { label: 'Ожидает проверки', tone: 'orange' };
}

/** Подпись единицы нормативного выпуска рецепта (API-ключ → русский текст) */
export function recipeOutputUnitKindRu(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'pieces' || k === 'шт' || k === 'штуки') return 'штуки';
  if (k === 'naming' || k === 'наименование') return 'наименования';
  if (k === 'amount' || k === 'количество') return 'количество';
  return kind ? String(kind) : '';
}
