/**
 * Выгрузка отчёта по тренеру в .xlsx.
 *
 * Один лист: файл читается в том же порядке, что и страница — шапка, итоги месяца,
 * таблица учеников. Вкладки книги прятали главное за лишним кликом, а состав колонок
 * повторяет карточку ученика на экране, без полей, которых на экране нет.
 *
 * Периоды приходят массивом, хотя выгружаем один месяц — тот, что выбран в фильтре.
 * На экране рядом показан и следующий месяц (для сравнения «кто продлил»), но в файл
 * он не идёт: выгружают то, что выбрали. Если завтра понадобится диапазон, поменяется
 * только вызов, а не генератор. При одном периоде общий итог не печатается — он
 * дословно повторил бы строку итогов самого месяца.
 */

import { downloadXlsx, XLSX_STYLE } from '../../../shared/lib/xlsx';
import { MONTHS } from '../../../shared/constants/common';
import { summarizeTrainerReport } from './trainerMonthReport';

/** Ровно то, что видно в строке ученика на странице. */
const TABLE_HEADERS = ['Ученик', 'Телефон', 'Тип', 'Занятие', 'Цена, сом', 'Долг, сом', 'Статус'];

const STAT_HEADERS = [
  'Учеников',
  'Оплатили',
  'Не оплатили',
  'Начислено, сом',
  'Получено, сом',
  'Долг, сом',
];

const COLUMNS = [
  { width: 34 },
  { width: 19 },
  { width: 17 },
  { width: 19 },
  { width: 14 },
  { width: 14 },
  { width: 16 },
];

const COLUMN_COUNT = TABLE_HEADERS.length;

const monthTitle = (period) => `${MONTHS[Number(period.month)]} ${period.year}`;

/** Пустые ячейки до конца строки — чтобы заливка баннера шла на всю ширину таблицы. */
const padRow = (cells, style) => {
  const row = [...cells];
  while (row.length < COLUMN_COUNT) row.push({ value: '', style });
  return row;
};

const headerRow = (labels) => padRow(labels.map((h) => ({ value: h, style: XLSX_STYLE.HEADER })), XLSX_STYLE.HEADER);

/** Строка чисел под шапкой статистики: счётчики обычные, деньги — в формате «сом». */
const statValuesRow = (summary) =>
  padRow(
    [
      { value: summary.total, style: XLSX_STYLE.TEXT },
      { value: summary.paid, style: summary.paid > 0 ? XLSX_STYLE.PAID : XLSX_STYLE.TEXT },
      { value: summary.unpaid, style: summary.unpaid > 0 ? XLSX_STYLE.UNPAID : XLSX_STYLE.TEXT },
      { value: summary.priceTotal, style: XLSX_STYLE.MONEY },
      { value: summary.collectedTotal, style: XLSX_STYLE.MONEY },
      { value: summary.debtTotal, style: summary.debtTotal > 0 ? XLSX_STYLE.DEBT : XLSX_STYLE.MONEY },
    ],
    XLSX_STYLE.TEXT,
  );

const clientRow = (row) => [
  { value: row.fio, style: XLSX_STYLE.TEXT },
  { value: row.phone || '—', style: XLSX_STYLE.TEXT },
  { value: row.typeLabel, style: XLSX_STYLE.TEXT },
  { value: row.slotLabel || '—', style: XLSX_STYLE.TEXT },
  { value: row.price, style: XLSX_STYLE.MONEY },
  { value: row.debt, style: row.debt > 0 ? XLSX_STYLE.DEBT : XLSX_STYLE.MONEY },
  { value: row.paid && row.debt === 0 ? 'Оплачено' : 'Не оплачено', style: row.paid && row.debt === 0 ? XLSX_STYLE.PAID : XLSX_STYLE.UNPAID },
];

const totalsRow = (summary) =>
  padRow(
    [
      { value: `Итого: ${summary.total} чел.`, style: XLSX_STYLE.TOTAL },
      { value: '', style: XLSX_STYLE.TOTAL },
      { value: '', style: XLSX_STYLE.TOTAL },
      { value: '', style: XLSX_STYLE.TOTAL },
      { value: summary.priceTotal, style: XLSX_STYLE.MONEY_TOTAL },
      { value: summary.debtTotal, style: XLSX_STYLE.MONEY_TOTAL },
      { value: `${summary.paid} / ${summary.unpaid}`, style: XLSX_STYLE.TOTAL },
    ],
    XLSX_STYLE.TOTAL,
  );

/** Секция одного месяца: баннер → итоги → таблица учеников. */
const monthSection = (period, rows, tag) => {
  const summary = summarizeTrainerReport(rows);
  const out = [
    padRow([{ value: tag ? `${monthTitle(period)}  ·  ${tag}` : monthTitle(period), style: XLSX_STYLE.SECTION }], XLSX_STYLE.SECTION),
    headerRow(STAT_HEADERS),
    statValuesRow(summary),
    [],
  ];

  if (!rows.length) {
    out.push(padRow([{ value: `Нет учеников за ${MONTHS[Number(period.month)].toLowerCase()}`, style: XLSX_STYLE.MUTED }], XLSX_STYLE.MUTED));
    out.push([], []);
    return out;
  }

  out.push(headerRow(TABLE_HEADERS));
  rows.forEach((row) => out.push(clientRow(row)));
  out.push(totalsRow(summary));
  out.push([], []);
  return out;
};

/** Кириллица в имени файла местами корёжится, поэтому чистим всё, кроме букв и цифр. */
const slug = (value) =>
  String(value || '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\wа-яА-ЯёЁ-]/g, '')
    .slice(0, 40) || 'trainer';

export const exportTrainerMonthReport = ({ trainerName, periods }) => {
  const name = trainerName || 'Тренер';
  const periodsLabel = periods.map(({ period }) => monthTitle(period)).join(' и ');

  /** Итог по всем периодам — печатается, только если периодов больше одного. */
  const grand = periods.reduce(
    (acc, { rows }) => {
      const s = summarizeTrainerReport(rows);
      return {
        total: acc.total + s.total,
        paid: acc.paid + s.paid,
        unpaid: acc.unpaid + s.unpaid,
        priceTotal: acc.priceTotal + s.priceTotal,
        collectedTotal: acc.collectedTotal + s.collectedTotal,
        debtTotal: acc.debtTotal + s.debtTotal,
      };
    },
    { total: 0, paid: 0, unpaid: 0, priceTotal: 0, collectedTotal: 0, debtTotal: 0 },
  );

  const rows = [
    [{ value: `Отчёт по тренеру: ${name}`, style: XLSX_STYLE.TITLE }],
    [{ value: `${periodsLabel}  ·  сформирован ${new Date().toLocaleString('ru-RU')}`, style: XLSX_STYLE.MUTED }],
    [{ value: 'Долг — цена абонемента со скидкой минус фактически внесённые деньги.', style: XLSX_STYLE.MUTED }],
    [],
    ...periods.flatMap(({ period, rows: monthRows }, i) =>
      monthSection(period, monthRows, periods.length > 1 ? (i > 0 ? 'следующий месяц' : 'выбранный месяц') : '')),
    ...(periods.length > 1
      ? [
        padRow([{ value: `ИТОГО ЗА ${periods.length} МЕС.`, style: XLSX_STYLE.SECTION }], XLSX_STYLE.SECTION),
        headerRow(STAT_HEADERS),
        statValuesRow(grand),
      ]
      : []),
  ];

  downloadXlsx({
    fileName: `Отчёт-${slug(name)}-${periods
      .map(({ period }) => `${period.year}-${String(period.month).padStart(2, '0')}`)
      .join('_')}.xlsx`,
    sheets: [
      {
        name: 'Отчёт',
        columns: COLUMNS,
        freezeRows: 3,
        rows,
      },
    ],
  });
};
