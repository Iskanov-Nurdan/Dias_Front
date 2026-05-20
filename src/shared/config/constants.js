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
  'client_orders',
  'payments',
  'returns',
  'defects',
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
  chemistry:  'Заготовка',
  recipes:    'Рецепты',
  orders:     'Заказы',
  production: 'Производство',
  otk:        'ОТК',
  warehouse:  'Склад',
  clients:    'Клиенты',
  sales:      'Продажи',
  client_orders: 'Заявки',
  payments:   'Оплаты',
  returns:    'Возвраты',
  defects:    'Брак / переделка',
  shipments:  'Отгрузки',
  my_shift:   'Моя смена',
  shifts:     'Смены',
};

/** Ключи раздела «Касса» (один пункт меню, несколько access_keys на бэке). */
export const ACCESS_CASH_BUNDLE_KEYS = ['clients', 'client_orders', 'sales', 'returns', 'defects'];

/** Бандлы для модалки доступов (id → ключи API). */
export const ACCESS_BUNDLES = {
  cash: {
    label: 'Касса',
    keys: ACCESS_CASH_BUNDLE_KEYS,
    iconKey: 'clients',
  },
};

/**
 * Группы модалки «Доступы к разделам» — только пункты из сайдбара.
 * keys — отдельные access_key; bundles — id из ACCESS_BUNDLES.
 */
export const ACCESS_GROUPS = [
  { id: 'overview', title: 'Общее', keys: ['analytics', 'my_shift'] },
  {
    id: 'production',
    title: 'Производство',
    keys: ['materials', 'chemistry', 'production', 'otk'],
  },
  { id: 'warehouse', title: 'Склад', keys: ['warehouse'] },
  ...(STAGE2_TABS_ENABLED ? [{ id: 'cash', bundles: ['cash'] }] : []),
  { id: 'personnel', title: 'Персонал', keys: ['shifts', 'users'] },
];

/** Все access_key, которые можно выставить в модалке (для «Выбрать всё» и сохранения). */
export function getAccessModalApiKeys(groups = ACCESS_GROUPS) {
  const out = [];
  for (const g of groups) {
    if (g.keys) out.push(...g.keys);
    for (const bundleId of g.bundles || []) {
      const bundle = ACCESS_BUNDLES[bundleId];
      if (bundle?.keys) out.push(...bundle.keys);
    }
  }
  return out;
}
