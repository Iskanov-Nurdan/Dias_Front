import { ACCESS_LABELS } from './constants';

/** Заголовок шапки для путей без пункта в сайдбаре. */
const ROUTE_TITLES = {
  '/payments': 'Оплаты',
  '/prepare-blanks': 'Цех',
  '/prepare-blanks/view': 'Заготовка',
  '/otk': 'ОТК',
  '/production': 'Производство',
  '/materials': 'Сырьё',
  '/chemistry': 'Заготовка',
  '/warehouse': 'Склад',
  '/cash': 'Касса',
  '/cash/clients': 'Клиенты',
  '/cash/orders': 'Заявки',
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
