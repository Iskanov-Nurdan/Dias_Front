/**
 * Способ оплаты (договор с бэкендом: строки receipt | cash | mixed).
 * 'mixed' — часть суммы оплачена чеком, часть наличными; конкретные суммы
 * идут отдельными полями paymentKindReceiptAmount / paymentKindCashAmount
 * (см. ClientFormModal) — бэкенд хранит их как есть, без схемы.
 */
export const CLIENT_PHOTO_KIND_OPTIONS = [
  { value: 'receipt', label: 'Чек' },
  { value: 'cash', label: 'Наличные' },
  { value: 'mixed', label: 'Смешанный' },
];

export const getClientPhotoKindLabel = (kind) =>
  CLIENT_PHOTO_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind ?? '—';
