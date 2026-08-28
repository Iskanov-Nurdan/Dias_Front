import { STAGE2_TABS_ENABLED } from './constants';

/** Маршруты по ключу доступа (совпадает с access_keys бэкенда). */
export const ACCESS_ROUTE_MAP = {
  my_shift: '/my-shift',
  materials: '/materials',
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
};

/** Первый экран после входа. */
export const HOME_ACCESS_PRIORITY = [
  'my_shift',
  'materials',
  'chemistry',
  'production',
  'otk',
  'warehouse',
  'analytics',
  'shifts',
  'sales',
  'clients',
  'users',
];

export function isCommerceAccess(accessKey) {
  return ['clients', 'sales'].includes(accessKey);
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
      title: 'Обзор',
      links: [
        { path: '/my-shift', accessKey: 'my_shift' },
        { path: '/analytics', accessKey: 'analytics' },
      ],
    },
    {
      title: 'Сырьё и химия',
      links: [
        { path: '/materials', accessKey: 'materials' },
        { path: '/chemistry', accessKey: 'chemistry' },
        {
          path: '/prepare-blanks',
          accessKey: 'chemistry',
          label: 'Цех',
          iconKey: 'chemistry',
        },
      ],
    },
    {
      title: 'Производство',
      links: [
        { path: '/production', accessKey: 'production' },
        { path: '/otk', accessKey: 'otk' },
      ],
    },
    {
      title: 'Склад',
      links: [{ path: '/warehouse', accessKey: 'warehouse' }],
    },
  ];

  if (STAGE2_TABS_ENABLED) {
    sections.push({
      title: 'Продажи',
      links: [
        {
          path: '/cash',
          accessKey: 'clients',
          accessAnyKeys: ['clients', 'sales'],
          label: 'Касса',
          iconKey: 'clients',
        },
      ],
    });
  }

  sections.push({
    title: 'Персонал',
    links: [
      { path: '/shifts', accessKey: 'shifts' },
      { path: '/users', accessKey: 'users' },
    ],
  });

  return sections;
}
