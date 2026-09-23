// Форматирование записи журнала действий (apps.activity). Бэкенд уже
// присылает готовые для показа значения там, где может: `field_labels`
// (raw-имя поля → русская подпись) на каждой записи и `old_display`/
// `new_display` на каждом изменении (для choices/FK/дат — см. отчёт по
// apps.activity.audit_service.build_field_changes). Здесь — только то,
// что бэкенд посчитать не может: как показать значение, если готового
// _display нет (обычный текст/число/bool/дата без транформа).

import { FRONTEND_FIELD_LABELS } from './auditFieldLabels';

/**
 * Подпись поля: сначала личный словарь записи (field_labels от бэкенда),
 * затем фронтенд-словарь по entity_type (auditFieldLabels.js — модели,
 * которые бэкенд ещё не перевёл), и только потом — как есть.
 */
export const formatChangeLabel = (fieldLabels, change, entityType) => {
  const key = change.field;
  return fieldLabels?.[key]
    ?? FRONTEND_FIELD_LABELS[entityType]?.[key]
    ?? (change.path && change.path !== key ? change.path : key);
};

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}/;

/** Значение изменения: готовый _display, если бэкенд его посчитал, иначе разумный дефолт. */
export const formatChangeValue = (raw, display) => {
  if (display != null && display !== '') return display;
  if (raw === null || raw === undefined || raw === '') return '—';
  if (typeof raw === 'boolean') return raw ? 'Да' : 'Нет';
  if (typeof raw === 'string' && ISO_DATE_RE.test(raw)) {
    const d = new Date(raw);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    }
  }
  if (Array.isArray(raw)) {
    return raw.length ? raw.map((v) => (v !== null && typeof v === 'object' ? JSON.stringify(v) : String(v))).join(', ') : '—';
  }
  if (typeof raw === 'object') return JSON.stringify(raw);
  return String(raw);
};
