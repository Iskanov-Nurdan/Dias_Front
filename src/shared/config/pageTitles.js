import { ACCESS_LABELS } from './constants';

/** Заголовок шапки для путей без пункта в сайдбаре. */
const ROUTE_TITLES = {
  '/prepare-blanks': 'Цех',
  '/prepare-blanks/view': 'Заготовка',
  '/otk': 'ОТК',
  '/production': 'Производство',
  '/materials': 'Сырьё',
  '/chemistry': 'Заготовка',
  '/warehouse': 'Склад',
  '/cash': 'Касса',
  '/cash/clients': 'Клиенты',
  '/cash/sales': 'Продажи',
};

export function getPageTitle(pathname, navLabel) {
  if (navLabel) return navLabel;
  const path = pathname || '';
  if (ROUTE_TITLES[path]) return ROUTE_TITLES[path];
  for (const [prefix, title] of Object.entries(ROUTE_TITLES)) {
    if (path.startsWith(`${prefix}/`) || path === prefix) return title;
  }
  const seg = path.split('/').filter(Boolean)[0];
  if (seg && ACCESS_LABELS[seg]) return ACCESS_LABELS[seg];
  return 'DIAS LINE';
}

/** Pages that render their own large in-page heading — the shared header
 * bar should not also show a title for these (avoids the double "Сотрудники"
 * heading). Add a path here whenever a page adopts its own hero title. */
const OWN_TITLE_PATHS = ['/materials', '/production', '/otk', '/warehouse'];

export function pageHasOwnTitle(pathname) {
  const path = pathname || '';
  return OWN_TITLE_PATHS.some((p) => path === p || path.startsWith(`${p}/`));
}
