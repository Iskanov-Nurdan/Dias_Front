/**
 * Кредитный лимит клиента — это лимит ДОЛГА: сколько всего он может быть
 * должен. Общая арифметика для карточки клиента, кассы и экрана оплаты,
 * чтобы везде считалось одинаково (сервер — apps.sales.credit_check —
 * делает ту же проверку и является источником правды).
 *
 * mode: 'hard' — превышение блокирует продажу в долг, 'soft' — только
 * предупреждение.
 */
export const creditInfo = (client, currentDebt, extraDebt = 0) => {
  const debt = Number(currentDebt) || 0;
  const limit = client?.credit_limit != null && client.credit_limit !== '' ? Number(client.credit_limit) : null;
  const mode = client?.credit_limit_mode === 'hard' ? 'hard' : 'soft';
  if (limit == null) {
    return { hasLimit: false, debt, projected: debt + extraDebt, limit: null, mode, available: null, usedPct: 0, level: 'none', over: false, blocked: false };
  }
  const projected = debt + (Number(extraDebt) || 0);
  const available = Math.max(0, limit - projected);
  const usedPct = limit > 0 ? Math.min(100, Math.round((projected / limit) * 100)) : 100;
  const over = projected > limit;
  let level = 'ok';
  if (over) level = 'over';
  else if (usedPct >= 80) level = 'warn';
  return { hasLimit: true, debt, projected, limit, mode, available, usedPct, level, over, blocked: over && mode === 'hard' };
};
