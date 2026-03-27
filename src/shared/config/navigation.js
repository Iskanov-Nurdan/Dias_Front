import { STAGE2_TABS_ENABLED } from './constants';

/** Маршруты по ключу доступа (совпадает с access_keys бэкенда). */
export const ACCESS_ROUTE_MAP = {
  my_shift: '/my-shift',
  recipes: '/recipes',
  materials: '/materials',
  lines: '/lines',
  chemistry: '/chemistry',
  otk: '/otk',
  warehouse: '/warehouse',
  analytics: '/analytics',
  shifts: '/shifts',
  users: '/users',
  clients: '/clients',
  sales: '/sales',
};

/** Первый экран после входа. */
export const HOME_ACCESS_PRIORITY = [
  'my_shift',
  'lines',
  'recipes',
  'materials',
  'chemistry',
  'otk',
  'warehouse',
  'analytics',
  'shifts',
  'sales',
  'clients',
  'users',
];

export function isCommerceAccess(accessKey) {
  return accessKey === 'clients' || accessKey === 'sales';
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
 * Структура бокового меню: группы отражают производственный цикл (ERP).
 */
export function getNavSections() {
  const sections = [
    {
      label: 'Смена',
      links: [{ path: '/my-shift', accessKey: 'my_shift' }],
    },
    {
      label: 'Нормативы и сырьё',
      links: [
        { path: '/recipes', accessKey: 'recipes' },
        { path: '/materials', accessKey: 'materials' },
      ],
    },
    {
      label: 'Производство',
      links: [
        { path: '/lines', accessKey: 'lines' },
        { path: '/chemistry', accessKey: 'chemistry' },
        { path: '/otk', accessKey: 'otk' },
      ],
    },
    {
      label: 'Готовая продукция',
      links: [{ path: '/warehouse', accessKey: 'warehouse' }],
    },
  ];

  if (STAGE2_TABS_ENABLED) {
    sections.push({
      label: 'Сбыт',
      links: [
        { path: '/clients', accessKey: 'clients' },
        { path: '/sales', accessKey: 'sales' },
      ],
    });
  }

  sections.push(
    {
      label: 'Отчёты',
      links: [
        { path: '/analytics', accessKey: 'analytics' },
        { path: '/shifts', accessKey: 'shifts' },
      ],
    },
    {
      label: 'Администрирование',
      links: [{ path: '/users', accessKey: 'users' }],
    },
  );

  return sections;
}
