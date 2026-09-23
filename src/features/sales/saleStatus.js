/**
 * Бейдж статуса продажи для списка/деталки — общий для SalesList и
 * SaleDetailModal, чтобы не разъезжались. Раньше оба места читали сырое
 * sale.sale_status ('draft' по умолчанию для любой кассовой продажи —
 * SaleSerializer.create никогда не переводит его дальше, даже когда склад
 * уже списан и деньги приняты), из-за чего оплаченный чек кассы всегда
 * показывался «Черновик». Бэк уже считает правильный agregate-статус в
 * sale.status (get_status: 'completed', когда warehouse_stock_applied=True
 * или sale_status в shipped/closed; 'returned'/'partial_return' — по
 * возвратам) — используем его, а не sale_status напрямую.
 *
 * sale.status === 'completed' говорит только «товар и деньги в обороте»,
 * само по себе не показывает оплачен ли чек — для этого сверху накладываем
 * sale.payment_status (unpaid/partially_paid/paid/overpaid/refunded, тоже
 * уже посчитан бэком в payment_status.py), это ровно то, что кассиру нужно
 * видеть с первого взгляда.
 */

const LIFECYCLE_LABEL = {
  draft: 'Черновик',
  confirmed: 'Подтверждена',
  partially_shipped: 'Частично отгружена',
  shipped: 'Отгружена',
  closed: 'Закрыта',
  canceled: 'Отменена',
};

const PAYMENT_LABEL = {
  paid: 'Оплачено',
  partially_paid: 'Частично оплачено',
  unpaid: 'В долг',
  overpaid: 'Переплата',
  refunded: 'Возврат денег',
};

const PAYMENT_MODIFIER = {
  paid: 'success',
  partially_paid: 'warning',
  unpaid: 'danger',
  overpaid: 'info',
  refunded: 'warning',
};

/** Отдельная подпись «Оплата» (для деталки, где статус и оплата — два разных тайла). */
export const getPaymentStatusLabel = (paymentStatus) => PAYMENT_LABEL[paymentStatus] || paymentStatus || '—';

/**
 * withPayment=true — один бейдж на список/карточку (там только один слот
 * под статус, платёжный статус важнее «technically completed»).
 * withPayment=false — для деталки, где рядом есть отдельный тайл «Оплата»:
 * тут дублировать не нужно, «Статус» остаётся нейтральным жизненным циклом.
 */
export const getSaleStatusBadge = (sale, { withPayment = true } = {}) => {
  const status = sale?.status || sale?.sale_status;

  if (status === 'canceled') return { label: 'Отменена', modifier: 'danger' };
  if (status === 'returned') return { label: 'Возврат', modifier: 'warning' };
  if (status === 'partial_return') return { label: 'Частичный возврат', modifier: 'warning' };

  if (status === 'completed') {
    if (!withPayment) return { label: 'Завершена', modifier: 'success' };
    const pay = sale?.payment_status;
    return {
      label: PAYMENT_LABEL[pay] || 'Завершена',
      modifier: PAYMENT_MODIFIER[pay] || 'success',
    };
  }

  // Незавершённый B2B-этап (draft/confirmed/partially_shipped до реального
  // списания склада) — тут sale_status ещё осмысленный лейбл жизненного цикла.
  return {
    label: LIFECYCLE_LABEL[sale?.sale_status] || sale?.sale_status || '—',
    modifier: sale?.sale_status === 'confirmed' ? 'info'
      : sale?.sale_status === 'partially_shipped' ? 'warning'
        : 'muted',
  };
};
