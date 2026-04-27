import { STAGE2_TABS_ENABLED } from './constants';

/** Маршруты по ключу доступа (совпадает с access_keys бэкенда). */
export const ACCESS_ROUTE_MAP = {
  my_shift: '/my-shift',
  recipes: '/directories',
  materials: '/materials',
  lines: '/lines',
  chemistry: '/chemistry',
  production: '/production',
  otk: '/otk',
  warehouse: '/warehouse',
  analytics: '/analytics',
  shifts: '/shifts',
  users: '/users',
  clients: '/cash',
  sales: '/cash',
  client_orders: '/cash',
  payments: '/payments',
  returns: '/cash',
  defects: '/cash',
};

/** Первый экран после входа. */
export const HOME_ACCESS_PRIORITY = [
  'my_shift',
  'materials',
  'chemistry',
  'recipes',
  'lines',
  'production',
  'otk',
  'warehouse',
  'analytics',
  'shifts',
  'client_orders',
  'sales',
  'payments',
  'returns',
  'defects',
  'clients',
  'users',
];

export function isCommerceAccess(accessKey) {
  return ['clients', 'sales', 'client_orders', 'payments', 'returns', 'defects'].includes(accessKey);
}

export function isAccessRoutable(accessKey) {
  if (isCommerceAccess(accessKey) && !STAGE2_TABS_ENABLED) return false;
  return Boolean(ACCESS_ROUTE_MAP[accessKey]);
}

/** Путь домашней страницы для пользователя или null. */
export function getDefaultHomePath(accesses) {
  if (!Array.isArray(accesses) || accesses.length === 0) return null;
  for (const key of HOME_ACCESS_PRIORITY) {
    if (!accesses.includes(key)) continue;
    if (!isAccessRoutable(key)) continue;
    return ACCESS_ROUTE_MAP[key];
  }
  return null;
}

/**
 * Группы ссылок для сайдбара (порядок = порядок пунктов; заголовки секций в UI не показываются).
 */
export function getNavSections() {
  const sections = [
    {
      links: [{ path: '/analytics', accessKey: 'analytics' }],
    },
    {
      links: [{ path: '/my-shift', accessKey: 'my_shift' }],
    },
    {
      links: [
        { path: '/materials', accessKey: 'materials' },
        { path: '/chemistry', accessKey: 'chemistry' },
        { path: '/directories', accessKey: 'recipes', label: 'Справочники' },
      ],
    },
    {
      links: [
        { path: '/lines', accessKey: 'lines' },
        { path: '/production', accessKey: 'production' },
        { path: '/otk', accessKey: 'otk' },
      ],
    },
    {
      links: [{ path: '/warehouse', accessKey: 'warehouse' }],
    },
  ];

  if (STAGE2_TABS_ENABLED) {
    sections.push({
      links: [
        {
          path: '/cash',
          accessKey: 'clients',
          accessAnyKeys: ['clients', 'client_orders', 'sales', 'returns', 'defects'],
          label: 'Касса',
          iconKey: 'clients',
        },
      ],
    });
  }

  sections.push(
    {
      links: [{ path: '/shifts', accessKey: 'shifts' }],
    },
    {
      links: [{ path: '/users', accessKey: 'users' }],
    },
  );

  return sections;
}
