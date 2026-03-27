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

/** Статус производственного запуска / замеса (если бэк отдаёт поле status) */
export function productionRunStatusRu(status) {
  const s = String(status || '').toLowerCase();
  if (s === 'draft' || s === 'черновик') return 'Черновик';
  if (s === 'in_progress' || s === 'running' || s === 'в_работе' || s === 'в работе') return 'В работе';
  if (s === 'done' || s === 'completed' || s === 'завершено' || s === 'finished') return 'Завершено';
  if (s === 'cancelled' || s === 'canceled' || s === 'отменено') return 'Отменено';
  if (!s) return '—';
  return String(status);
}

/**
 * Подпись для списка замесов: сначала статус запуска (если бэк прислал),
 * иначе — по связанной партии ОТК (часто в списке нет run.status, но есть production_batch).
 */
export function recipeRunListStatusRu(run) {
  const fromRun = productionRunStatusRu(run?.status ?? run?.run_status);
  if (fromRun !== '—') return fromRun;
  const pb = run?.production_batch;
  if (pb != null && typeof pb === 'object') {
    return otkResultStatusRu(pb).label;
  }
  const flatOtk = run?.production_batch_otk_status ?? run?.otk_status;
  if (flatOtk != null && String(flatOtk).trim() !== '') {
    return otkResultStatusRu({ otk_status: flatOtk, ...run }).label;
  }
  return '—';
}

/** Подпись единицы нормативного выпуска рецепта (API-ключ → русский текст) */
export function recipeOutputUnitKindRu(kind) {
  const k = String(kind || '').toLowerCase();
  if (k === 'pieces' || k === 'шт' || k === 'штуки') return 'штуки';
  if (k === 'naming' || k === 'наименование') return 'наименования';
  if (k === 'amount' || k === 'количество') return 'количество';
  return kind ? String(kind) : '';
}
