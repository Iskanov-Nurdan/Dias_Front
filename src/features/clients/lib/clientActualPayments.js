/**
 * Частичные фактические оплаты клиента (массив на бэке: actualPayments / actual_payments).
 */

const newLocalKey = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Строка формы: локальный ключ + поля ввода */
export const emptyInstallmentRow = () => ({
  _key: newLocalKey(),
  amount: '',
  date: '',
});

/**
 * @param {object|null|undefined} client
 * @returns {Array<{ _key: string, amount: string, date: string }>}
 */
export function getInitialInstallmentRows(client) {
  if (!client) return [emptyInstallmentRow()];

  const raw = client.actualPayments ?? client.actual_payments;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((p) => ({
      _key: newLocalKey(),
      amount:
        p.amount != null && p.amount !== ''
          ? String(p.amount)
          : '',
      date: (() => {
        const d = p.paymentDate ?? p.payment_date ?? p.actualPaymentDate ?? p.actual_payment_date;
        return d ? String(d).slice(0, 10) : '';
      })(),
    }));
  }

  const apd = client.actualPaymentDate ?? client.actual_payment_date;
  if (apd) {
    return [
      {
        _key: newLocalKey(),
        amount: '',
        date: String(apd).slice(0, 10),
      },
    ];
  }

  return [emptyInstallmentRow()];
}

/**
 * @param {Array<{ amount: string, date: string }>} rows
 * @returns {{ ok: true, payload: Array<{ amount: number, paymentDate: string }> } | { ok: false, message: string }}
 */
export function buildActualPaymentsPayload(rows) {
  const payload = [];
  for (const row of rows) {
    const rawAmt = row.amount;
    const amtStr = rawAmt != null ? String(rawAmt).trim() : '';
    const hasAmt = amtStr !== '' && Number.isFinite(Number(amtStr)) && Number(amtStr) > 0;
    const hasDate = Boolean(row.date && String(row.date).trim());

    if (!hasAmt && !hasDate) continue;

    if (hasAmt && !hasDate) {
      return { ok: false, message: 'У каждой суммы укажите дату оплаты или удалите строку.' };
    }
    if (!hasAmt && hasDate) {
      return { ok: false, message: 'Укажите сумму платежа или очистите дату в строке частичной оплаты.' };
    }

    const amount = Number(amtStr);
    payload.push({
      amount,
      paymentDate: String(row.date).slice(0, 10),
    });
  }
  return { ok: true, payload };
}

/**
 * @param {object|null|undefined} client
 * @returns {Array<{ amount: number|null, date: string|null }>}
 */
export function getClientPaymentsForCard(client) {
  const raw = client?.actualPayments ?? client?.actual_payments;
  if (Array.isArray(raw) && raw.length > 0) {
    return raw.map((p) => {
      const amt = p.amount;
      const n = Number(amt);
      return {
        amount: Number.isFinite(n) && n > 0 ? n : null,
        date: (() => {
          const d = p.paymentDate ?? p.payment_date ?? p.actualPaymentDate ?? p.actual_payment_date;
          return d ? String(d).slice(0, 10) : null;
        })(),
      };
    });
  }
  const apd = client?.actualPaymentDate ?? client?.actual_payment_date;
  if (apd) {
    return [{ amount: null, date: String(apd).slice(0, 10) }];
  }
  return [];
}

/**
 * Значение поля «цена абонемента» при открытии формы — согласовано с цифрой «Цена» в карточке
 * (приоритет price_display / total_price, затем price).
 * При ненулевой скидке, если есть итог с бэка, восстанавливаем базу до скидки из него.
 */
export function getInitialSubscriptionPriceInputValue(client) {
  if (!client) return '';
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const rawBase = client.price;
  const hasDisplay =
    priceDisplay != null && priceDisplay !== '' && Number.isFinite(Number(priceDisplay));
  const finalShown = hasDisplay ? Number(priceDisplay) : null;

  if (discountPct > 0) {
    if (finalShown != null) {
      const factor = 1 - discountPct / 100;
      if (factor > 0) return String(Math.round(finalShown / factor));
    }
    if (rawBase != null && rawBase !== '') return String(rawBase);
    return '';
  }

  if (finalShown != null) return String(Math.round(finalShown));
  if (rawBase != null && rawBase !== '') return String(rawBase);
  return '';
}

/** Итоговая цена строки клиента (как в карточке: priceDisplay или цена со скидкой). */
export function getClientFinalPriceForList(client) {
  if (!client) return 0;
  const priceDisplay = client.priceDisplay ?? client.totalPrice ?? client.price_display ?? client.total_price;
  const priceBase = Number(client.price) || 0;
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  if (priceDisplay != null && priceDisplay !== '' && Number.isFinite(Number(priceDisplay))) {
    return Math.round(Number(priceDisplay));
  }
  const after = discountPct > 0 && priceBase > 0 ? priceBase * (1 - discountPct / 100) : priceBase;
  return Math.round(after);
}

/**
 * Начальное значение поля цены в форме редактирования.
 * При скидке > 0 — та же цифра, что «Цена» в карточке (после скидки); без скидки — договорная сумма.
 */
export function getPriceFieldInitialForForm(client) {
  if (!client) return '';
  const discountPct = Number(client.discount ?? client.discount_percent) || 0;
  if (discountPct > 0) {
    const v = getClientFinalPriceForList(client);
    return v > 0 ? String(v) : '';
  }
  return getInitialSubscriptionPriceInputValue(client);
}

// Сумма внесённых денег и признак «долг закрыт» больше здесь не считаются:
// их отдаёт сервер полями paidAmount / debt / fullyPaid — см. lib/clientMoney.js.
// Держать вторую реализацию тех же формул в браузере значит гарантированно
// разойтись с бэкендом при первой же правке скидок или доплат.
