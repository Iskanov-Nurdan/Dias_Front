import {
  Users, Boxes, Factory, CheckCircle2, Warehouse, UsersRound, ShoppingCart, BarChart3, Clock, PlayCircle,
} from 'lucide-react';

/**
 * Ключи доступа — подмножество settings.ACCESS_KEYS в DIAS_ERP (apps/accounts),
 * ограниченное тем, что реально видно в сайдбаре этого фронта, плюс 'analytics'
 * (пока без своей страницы, но ключ реальный и понадобится с её миграцией) и
 * 'my_shift' (личный приход/уход — не страница, а право на кнопку «Начать/
 * завершить смену» в шапке, см. ShiftClockWidget). Остальные backend-ключи
 * ('lines','chemistry','recipes','orders','shipments','client_orders',
 * 'payments','returns','defects') относятся к ещё не мигрированным сюда
 * страницам — незачем показывать в модалке доступов переключатели для того,
 * чего в этом приложении просто нет.
 */
export const ACCESS_KEYS = [
  'users',
  'materials',
  'production',
  'otk',
  'warehouse',
  'clients',
  'sales',
  'analytics',
  'shifts',
  'my_shift',
];

export const ACCESS_KEY_LABELS = {
  users: 'Сотрудники',
  materials: 'Сырьё',
  production: 'Производство',
  otk: 'ОТК',
  warehouse: 'Склад',
  clients: 'Клиенты',
  sales: 'Касса',
  analytics: 'Аналитика',
  shifts: 'Смены',
  my_shift: 'Начать/завершить смену',
};

export const ACCESS_KEY_ICONS = {
  users: Users,
  materials: Boxes,
  production: Factory,
  otk: CheckCircle2,
  warehouse: Warehouse,
  clients: UsersRound,
  sales: ShoppingCart,
  analytics: BarChart3,
  shifts: Clock,
  my_shift: PlayCircle,
};

/** Группировка для модалки доступов сотрудника — по разделам сайдбара. */
export const ACCESS_KEY_GROUPS = [
  { label: 'Люди', ids: ['users'] },
  { label: 'Сырьё и производство', ids: ['materials', 'production', 'otk'] },
  { label: 'Склад', ids: ['warehouse'] },
  { label: 'Продажи', ids: ['clients', 'sales'] },
  // Ключ 'shifts' на бэкенде также открывает /api/activity/ — общий журнал
  // действий (см. ActivityAdminView.required_access_key), отдельного ключа
  // под «Журнал действий» на бэкенде нет. 'my_shift' — отдельное, более узкое
  // право: просто кнопка «Начать/завершить смену» в шапке для рядового
  // сотрудника, без доступа к разделу «Смены» целиком.
  { label: 'Смены и журнал действий', ids: ['shifts', 'my_shift'] },
  { label: 'Аналитика', ids: ['analytics'] },
];
