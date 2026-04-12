/**
 * Нормализация объекта заморозки из API (camelCase / snake_case).
 * @param {object|null|undefined} raw
 * @returns {object|null}
 */
export const normalizeClientFreeze = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const days = Number(raw.days ?? raw.freeze_days);
  if (!Number.isFinite(days) || days < 1) return null;

  const createdByRaw = raw.createdBy ?? raw.created_by;
  let createdBy = null;
  if (typeof createdByRaw === 'string' && createdByRaw.trim()) {
    createdBy = { fio: createdByRaw.trim() };
  } else if (createdByRaw && typeof createdByRaw === 'object') {
    const fio = createdByRaw.fio ?? createdByRaw.name ?? createdByRaw.username ?? '';
    createdBy = { id: createdByRaw.id, fio: fio || '—' };
  }

  const dateBefore = raw.dateStartBefore ?? raw.date_start_before ?? raw.subscriptionStartBefore ?? null;
  const dateAfter = raw.dateStartAfter ?? raw.date_start_after ?? raw.subscriptionStartAfter ?? null;

  return {
    id: raw.id,
    status: raw.status ?? 'active',
    days,
    reason: String(raw.reason ?? '').trim() || null,
    dateStartBefore: dateBefore,
    dateStartAfter: dateAfter,
    createdAt: raw.createdAt ?? raw.created_at ?? null,
    createdBy,
  };
};

/**
 * Достаёт заморозку из объекта клиента (разные имена полей с бэка).
 */
export const getFreezeFromClient = (client) => {
  if (!client || typeof client !== 'object') return null;
  const nested = client.freeze ?? client.subscriptionFreeze ?? client.subscription_freeze;
  return normalizeClientFreeze(nested);
};

export const formatFreezeDateLabel = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU');
};

export const formatFreezeDateTimeLabel = (value) => {
  if (value == null || value === '') return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', { dateStyle: 'short', timeStyle: 'short' });
};

const STATUS_LABELS = {
  active: 'Активна',
  inactive: 'Неактивна',
  cancelled: 'Отменена',
  ended: 'Завершена',
};

export const freezeStatusLabel = (status) => {
  if (status == null || status === '') return '—';
  const key = String(status).toLowerCase();
  return STATUS_LABELS[key] ?? status;
};
