import { PAGE_LABELS } from '../../shared/constants/pages';

// Реальные значения action (apps.activity.models.UserActivity.ACTION_CHOICES) —
// 'restore' зарезервирован на бэкенде, но сегодня ни одна точка кода его не
// пишет; оставлен в списке фильтра на будущее, без вреда — просто никогда
// не будет строк с этим значением, пока бэкенд не начнёт их писать.
export const ACTION_TYPES = {
  create: { label: 'Создал', cls: 'ui-pill--success' },
  update: { label: 'Изменил', cls: 'ui-pill--info' },
  delete: { label: 'Удалил', cls: 'ui-pill--danger' },
  restore: { label: 'Восстановил', cls: 'ui-pill--success' },
};

/**
 * Фильтр «Раздел» — ровно пункты сайдбара, с теми же названиями (берём из
 * PAGE_LABELS, а не переписываем руками). Бэкенд пишет в UserActivity.section
 * свои строки, не всегда совпадающие с сайдбаром, поэтому каждый пункт
 * сайдбара — это группа строк бэкенда (значение фильтра уходит на сервер
 * списком через запятую). Отдельного «Цех»: у бэкенда для заготовки и цеха
 * одна строка «Цех заготовки», разделить их нельзя — она отнесена к
 * «Заготовке». Записи разделов, которых нет в сайдбаре (Пенопласт, Заявки,
 * Брак и т.п.), в журнале остаются, просто не имеют своего пункта фильтра.
 */
export const SECTION_GROUPS = [
  { label: PAGE_LABELS.employees, values: ['Пользователи'] },
  { label: PAGE_LABELS.materials, values: ['Материалы', 'Химия'] },
  { label: PAGE_LABELS.workshop, values: ['Цех заготовки'] },
  { label: PAGE_LABELS.production, values: ['Производство'] },
  { label: PAGE_LABELS.otk, values: ['ОТК'] },
  { label: PAGE_LABELS.warehouse, values: ['Склад'] },
  { label: PAGE_LABELS.clients, values: ['Клиенты', 'Цены клиентов'] },
  { label: PAGE_LABELS.sales, values: ['Продажи', 'Прайсы', 'Оплаты', 'Возвраты'] },
  { label: PAGE_LABELS.shifts, values: ['Смены'] },
];

export const SECTION_FILTER_OPTIONS = SECTION_GROUPS.map((g) => ({ value: g.values.join(','), label: g.label }));

const SECTION_LABEL_BY_VALUE = Object.fromEntries(
  SECTION_GROUPS.flatMap((g) => g.values.map((v) => [v, g.label])),
);

/** Название раздела как в сайдбаре; для строк без пункта сайдбара — как есть. */
export const sectionLabel = (raw) => SECTION_LABEL_BY_VALUE[raw] || raw;
