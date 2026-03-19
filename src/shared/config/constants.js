/**
 * Этап 2: Клиенты, Продажи, Отгрузки.
 * Скрыты, пока бизнес-логика не утверждена.
 */
export const STAGE2_TABS_ENABLED = true;

/** Доступы для ролей (access_keys по документации) */
export const ACCESS_KEYS = [
  'users',
  'lines',
  'materials',
  'chemistry',
  'recipes',
  'orders',
  'production',
  'otk',
  'warehouse',
  'analytics',
  'clients',
  'sales',
  'shipments',
  'my_shift',
  'shifts',
];

export const ACCESS_LABELS = {
  analytics:  'Аналитика',
  users:      'Сотрудники',
  lines:      'Линии',
  materials:  'Сырьё',
  chemistry:  'Химия',
  recipes:    'Рецепты',
  orders:     'Заказы',
  production: 'Производство',
  otk:        'ОТК',
  warehouse:  'Готовая продукция',
  clients:    'Клиенты',
  sales:      'Продажи',
  shipments:  'Отгрузки',
  my_shift:   'Моя смена',
  shifts:     'Отчёт смен',
};
