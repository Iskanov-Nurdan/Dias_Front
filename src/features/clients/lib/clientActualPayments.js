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
