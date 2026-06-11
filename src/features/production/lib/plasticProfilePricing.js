import { parseLocaleNumber, formatNumberForInput } from '../../../shared/lib';

/** Прочие расходы на 1 шт (редактируются в карточке товара). */
export const PROFILE_EXTRA_EXPENSE_FIELDS = [
  { apiKey: 'extra_rubber', label: 'Резинка' },
  { apiKey: 'extra_label', label: 'Этикетка' },
  { apiKey: 'extra_labor', label: 'Рабочая сила' },
  { apiKey: 'extra_electricity', label: 'Свет' },
  { apiKey: 'extra_repair', label: 'Ремонт' },
];

const camelFromSnake = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

export const readProfileBlankId = (profile) => {
  if (!profile) return '';
  const v = profile.blank_id ?? profile.blankId ?? profile.blank?.id;
  return v != null && v !== '' ? String(v) : '';
};

export const readProfileBlankName = (profile) => {
  if (!profile) return '';
  return profile.blank_name ?? profile.blankName ?? profile.blank?.name ?? '';
};

export const readProfileExtraExpense = (profile, apiKey) => {
  if (!profile || !apiKey) return 0;
  const camel = camelFromSnake(apiKey);
  const v = profile[apiKey] ?? profile[camel];
  if (v == null || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : 0;
};

export const readProfileOtherExpensesTotal = (profile) =>
  PROFILE_EXTRA_EXPENSE_FIELDS.reduce(
    (sum, f) => sum + readProfileExtraExpense(profile, f.apiKey),
    0,
  );

export const readProfileCostPrice = (profile) => {
  if (!profile) return null;
  const v = profile.cost_price ?? profile.costPrice ?? profile.unit_cost;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

export const formatProfileCostDisplay = (profile) => {
  const cost = readProfileCostPrice(profile);
  if (cost == null) return '—';
  return `${formatNumberForInput(cost)} сом`;
};

export const readProfileMarkupAmount = (profile) => {
  if (!profile) return null;
  const v = profile.markup_amount ?? profile.markupAmount ?? profile.markup;
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

/** % наценки от себестоимости. */
export const calcMarkupPercentFromAmount = (costPrice, markupAmount) => {
  const cost = Number(costPrice);
  const markup = Number(markupAmount);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(markup) || markup < 0) return null;
  return (markup / cost) * 100;
};

/** Округлённый % для UI (без длинных хвостов). */
export const formatMarkupPercentDisplay = (costPrice, markupAmount) => {
  const pct = calcMarkupPercentFromAmount(costPrice, markupAmount);
  if (pct == null) return '—';
  const rounded = Math.round(pct * 10) / 10;
  const display = Number.isInteger(rounded)
    ? String(rounded)
    : formatNumberForInput(rounded);
  return `${display} %`;
};

/** Итоговая цена за 1 шт = себестоимость + прочие расходы + наценка. */
export const calcProfileSaleUnitPrice = (costPrice, otherExpensesTotal, markupAmount) => {
  const cost = Number(costPrice);
  const extras = Number(otherExpensesTotal);
  const markup = Number(markupAmount);
  if (!Number.isFinite(cost) || cost < 0) return null;
  const ex = Number.isFinite(extras) && extras >= 0 ? extras : 0;
  const mk = Number.isFinite(markup) && markup >= 0 ? markup : 0;
  return cost + ex + mk;
};

/** @deprecated alias */
export const calcSalePrice = (costPrice, markupAmount, otherExpensesTotal = 0) =>
  calcProfileSaleUnitPrice(costPrice, otherExpensesTotal, markupAmount);

export const resolveProfileUnitSalePrice = (profile) => {
  const cost = readProfileCostPrice(profile);
  if (cost == null) return null;
  const markup = readProfileMarkupAmount(profile) ?? 0;
  const extras = readProfileOtherExpensesTotal(profile);
  return calcProfileSaleUnitPrice(cost, extras, markup);
};

export const formatProfileSalePriceDisplay = (profile) => {
  const price = resolveProfileUnitSalePrice(profile);
  if (price == null) return '—';
  return `${formatNumberForInput(price)} сом`;
};

export const buildPlasticProfileExpensePayload = (expenseValues = {}) => {
  const out = {};
  PROFILE_EXTRA_EXPENSE_FIELDS.forEach(({ apiKey }) => {
    const raw = expenseValues[apiKey];
    const n = raw == null || raw === '' ? 0 : parseLocaleNumber(String(raw));
    out[apiKey] = Number.isFinite(n) && n >= 0 ? n : 0;
  });
  return out;
};

export const resolveBatchProfileId = (batch) => {
  if (!batch) return null;
  const id = batch.profile_id ?? batch.profile?.id ?? batch.product_id ?? batch.product?.id;
  return id != null ? String(id) : null;
};

export const resolveBatchUnitSalePrice = (batch, profilesById) => {
  const pid = resolveBatchProfileId(batch);
  if (!pid || !profilesById) return null;
  return resolveProfileUnitSalePrice(profilesById.get(pid));
};

export const calcMarkupAmountFromPercent = (costPrice, percentStr) => {
  const cost = Number(costPrice);
  const pct = parseLocaleNumber(percentStr);
  if (!Number.isFinite(cost) || cost <= 0 || !Number.isFinite(pct) || pct < 0) return null;
  return (cost * pct) / 100;
};

