/**
 * Форматирование для аналитики. Суммы с бэкенда — строки (Decimal), сами
 * мы ничего не пересчитываем: Number() только для вывода и длины баров.
 */
export const money = (v) => {
  if (v == null) return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} сом`;
};

export const num = (v, digits = 2) => {
  if (v == null) return '—';
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString('ru-RU', { maximumFractionDigits: digits }) : '—';
};

const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** '2026-09' → 'сен 26', '2026-09-24' → '24 сен' */
export const periodLabel = (p, long = false) => {
  if (!p) return '';
  const [y, m, d] = p.split('-');
  const mon = MONTHS_SHORT[Number(m) - 1] || m;
  if (d) return long ? `${Number(d)} ${mon} ${y}` : `${Number(d)} ${mon}`;
  return long ? `${mon} ${y}` : `${mon} ${y.slice(2)}`;
};

/**
 * Короткая читаемая подпись диапазона для кнопки периода (влезает в 320px):
 * «24 сен 2026», «1–24 сен», «1 июл – 24 сен», «12.08.25 – 24.09.26».
 */
export const rangeLabel = ({ dateFrom, dateTo }) => {
  if (!dateFrom || !dateTo) return '—';
  const [y1, m1, d1] = dateFrom.split('-').map(Number);
  const [y2, m2, d2] = dateTo.split('-').map(Number);
  if (dateFrom === dateTo) return `${d1} ${MONTHS_SHORT[m1 - 1]} ${y1}`;
  if (y1 !== y2) return `${pad(d1)}.${pad(m1)}.${String(y1).slice(2)} – ${pad(d2)}.${pad(m2)}.${String(y2).slice(2)}`;
  if (m1 === m2) return `${d1}–${d2} ${MONTHS_SHORT[m2 - 1]}`;
  return `${d1} ${MONTHS_SHORT[m1 - 1]} – ${d2} ${MONTHS_SHORT[m2 - 1]}`;
};

export const dateRu =(iso) => (iso ? new Date(`${iso.slice(0, 10)}T00:00:00`).toLocaleDateString('ru-RU') : '—');

const pad = (n) => String(n).padStart(2, '0');
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const PRESETS = [
  { id: 'today', label: 'Сегодня' },
  { id: 'week', label: 'Неделя' },
  { id: 'month', label: 'Месяц' },
  { id: 'quarter', label: 'Квартал' },
  { id: 'year', label: 'Год' },
  { id: 'custom', label: 'Свой' },
];

/** Пресет → { dateFrom, dateTo } (неделя — с понедельника, «до сегодня»). */
export const presetRange = (id, today = new Date()) => {
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  let from = t;
  if (id === 'week') {
    const dow = (t.getDay() + 6) % 7;
    from = new Date(t.getFullYear(), t.getMonth(), t.getDate() - dow);
  } else if (id === 'month') {
    from = new Date(t.getFullYear(), t.getMonth(), 1);
  } else if (id === 'quarter') {
    from = new Date(t.getFullYear(), Math.floor(t.getMonth() / 3) * 3, 1);
  } else if (id === 'year') {
    from = new Date(t.getFullYear(), 0, 1);
  }
  return { dateFrom: isoDate(from), dateTo: isoDate(t) };
};

export const LINE_LABELS = { profile: 'Профиль', foam: 'Пенопласт', general: 'Общий' };

// ── Экспорт в Excel ───────────────────────────────────────────────────────
// CSV с «;» и BOM — Excel открывает его двойным кликом с кириллицей и
// колонками без мастера импорта, а новая тяжёлая библиотека (xlsx) не нужна.

const cell = (v) => {
  if (v == null) return '';
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Числа-строки с бэкенда ('1234.5') → '1234,5' — так их понимает русский Excel. */
const xlNum = (v) => (v == null ? '' : String(v).replace('.', ','));

export const downloadCsv = (filename, sections) => {
  const lines = [];
  sections.forEach(({ title, head, rows }) => {
    if (lines.length) lines.push('');
    lines.push(cell(title));
    lines.push(head.map(cell).join(';'));
    rows.forEach((r) => lines.push(r.map(cell).join(';')));
  });
  const blob = new Blob([`﻿${lines.join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const exportDashboard = (data) => {
  const { period } = data;
  const sections = [
    {
      title: `Аналитика ${dateRu(period.date_from)} — ${dateRu(period.date_to)}`,
      head: ['Показатель', 'Значение', 'Прошлый период', 'Изменение, %'],
      rows: data.kpis.filter((k) => !k.locked).map((k) => [k.label, xlNum(k.value), xlNum(k.previous), xlNum(k.delta_pct)]),
    },
    {
      title: 'Динамика',
      head: ['Период', 'Выручка', 'Валовая маржа', 'Чистая прибыль'],
      rows: data.trend.map((t) => [t.period, xlNum(t.revenue), xlNum(t.gross_margin), xlNum(t.net_profit)]),
    },
    {
      title: 'Товары',
      head: ['Товар', 'Линия', 'Кол-во', 'Выручка', 'Себестоимость', 'Маржа', 'Маржа, %'],
      rows: data.top_products.map((p) => [p.name, LINE_LABELS[p.product_line], xlNum(p.quantity), xlNum(p.revenue), xlNum(p.cogs), xlNum(p.margin), xlNum(p.margin_pct)]),
    },
  ];
  if (data.expenses_by_category) {
    sections.push({
      title: 'Расходы по категориям',
      head: ['Категория', 'Сумма'],
      rows: data.expenses_by_category.map((e) => [e.category, xlNum(e.amount)]),
    });
  }
  sections.push(
    {
      title: 'Долги клиентов (на сегодня)',
      head: ['Клиент', 'Линия', 'Долг', 'Покупок', 'Самый старый, дней'],
      rows: data.debts.top_debtors.map((d) => [d.client, LINE_LABELS[d.product_line], xlNum(d.debt), d.sales, d.oldest_days]),
    },
    {
      title: 'Топ клиентов',
      head: ['Клиент', 'Линия', 'Выручка'],
      rows: data.top_clients.map((c) => [c.client, LINE_LABELS[c.product_line], xlNum(c.revenue)]),
    },
    {
      title: 'Кассиры',
      head: ['Кассир', 'Продаж', 'Выручка', 'Средний чек'],
      rows: data.people.cashiers.map((c) => [c.cashier, c.sales_count, xlNum(c.revenue), xlNum(c.avg_check)]),
    },
  );
  downloadCsv(`analytics_${period.date_from}_${period.date_to}.csv`, sections);
};

export const exportEntries = (items, range) => {
  downloadCsv(`rashody_${range.dateFrom}_${range.dateTo}.csv`, [{
    title: `Расходы и доходы ${dateRu(range.dateFrom)} — ${dateRu(range.dateTo)}`,
    head: ['Дата', 'Тип', 'Категория', 'Наименование', 'Линия', 'Сумма', 'Статус', 'Комментарий', 'Создал'],
    rows: items.map((e) => [
      e.date, e.kind === 'income' ? 'Доход' : 'Расход', e.category_name, e.name, LINE_LABELS[e.product_line],
      xlNum(e.amount), e.status === 'accepted' ? 'Принят' : 'Ожидает', e.comment, e.created_by_name,
    ]),
  }]);
};
