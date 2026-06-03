import { parseLocaleNumber, formatNumberForInput } from '../../../shared/lib';

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

/** Цена продажи за 1 шт = себестоимость + наценка. */
export const resolveProfileUnitSalePrice = (profile) => {
  const cost = readProfileCostPrice(profile);
  if (cost == null) return null;
  const markup = readProfileMarkupAmount(profile) ?? 0;
  return calcSalePrice(cost, markup);
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

export const calcSalePrice = (costPrice, markupAmount) => {
  const cost = Number(costPrice);
  const markup = Number(markupAmount);
  if (!Number.isFinite(cost) || cost < 0) return null;
  if (!Number.isFinite(markup) || markup < 0) return cost;
  return cost + markup;
};
