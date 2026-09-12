/**
 * Способ оплаты (договор с бэкендом: строки receipt | cash | mixed).
 * 'mixed' — часть суммы оплачена чеком, часть наличными; конкретные суммы
 * идут отдельными полями paymentKindReceiptAmount / paymentKindCashAmount
 * (см. ClientFormModal) — бэкенд хранит их как есть, без схемы.
 *
 * Раньше файл назывался clientPhotos.js, а константа — CLIENT_PHOTO_KIND_OPTIONS:
 * названия остались от вложений-фото, которых в форме давно нет, и сбивали с толку.
 */
export const PAYMENT_KIND_OPTIONS = [
  { value: 'receipt', label: 'Чек' },
  { value: 'cash', label: 'Наличные' },
  { value: 'mixed', label: 'Смешанный' },
];

export const getPaymentKindLabel = (kind) =>
  PAYMENT_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind ?? '—';
