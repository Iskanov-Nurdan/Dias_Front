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
  analytics:  'Аналитика',
  users:      'Сотрудники',
  lines:      'Линии',
  materials:  'Сырьё',
  chemistry:  'Химия',
  recipes:    'Рецепты',
  orders:     'Заказы',
  production: 'Производство',
  otk:        'ОТК',
  warehouse:  'Склад',
  clients:    'Клиенты',
  sales:      'Продажи',
  shipments:  'Отгрузки',
  my_shift:   'Моя смена',
  shifts:     'Смены',
};

/** Группы для UI модалки доступов (все ключи из ACCESS_KEYS по одному разу). */
export const ACCESS_GROUPS = [
  {
    id: 'production',
    title: 'Производство',
    keys: ['lines', 'materials', 'chemistry', 'recipes', 'orders', 'production', 'otk'],
  },
  { id: 'warehouse', title: 'Склад', keys: ['warehouse'] },
  { id: 'sales', title: 'Продажи', keys: ['clients', 'sales', 'shipments'] },
  { id: 'personnel', title: 'Персонал', keys: ['users', 'shifts', 'my_shift'] },
  { id: 'analytics', title: 'Аналитика', keys: ['analytics'] },
];
