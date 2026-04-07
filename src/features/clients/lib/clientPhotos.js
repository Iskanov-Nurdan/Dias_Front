/** Типы вложений для сверки чеков / наличных (договор с бэкендом: строки receipt | cash). */
export const CLIENT_PHOTO_KIND_OPTIONS = [
  { value: 'receipt', label: 'Чек' },
  { value: 'cash', label: 'Наличные' },
];

export const getClientPhotoKindLabel = (kind) =>
  CLIENT_PHOTO_KIND_OPTIONS.find((o) => o.value === kind)?.label ?? kind ?? '—';
