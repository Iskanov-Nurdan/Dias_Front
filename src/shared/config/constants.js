/**
 * Этап 2: Клиенты и Продажи.
 * При false разделы сбыта скрыты из меню и недоступны для редиректа после входа.
 */
export const STAGE2_TABS_ENABLED = true;

/** Доступы для ролей (access_keys по документации) */
/** Синхронизировано с config.settings.ACCESS_KEYS бэка (см. docs/DIAS_BACKEND_CONTRACT.md). */
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
  'clients',
  'sales',
  'shipments',
  'analytics',
  'shifts',
  'my_shift',
];

export const ACCESS_LABELS = {
  analytics:  'Отчёты и аналитика',
  users:      'Сотрудники',
  lines:      'Линии и смены на линиях',
  materials:  'Сырьё и остатки',
  chemistry:  'Замесы по рецепту',
  recipes:    'Рецептуры',
  orders:     'Заказы',
  production: 'Производство',
  otk:        'ОТК',
  warehouse:  'Склад готовой продукции',
  clients:    'Клиенты',
  sales:      'Продажи',
  shipments:  'Отгрузки',
  my_shift:   'Моя смена',
  shifts:     'Журнал смен',
};
