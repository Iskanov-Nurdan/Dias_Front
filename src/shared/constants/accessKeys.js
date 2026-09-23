import {
  Users, Boxes, Factory, CheckCircle2, Warehouse, UsersRound, ShoppingCart, BarChart3, Clock, PlayCircle, Undo2,
} from 'lucide-react';

/**
 * Ключи доступа — подмножество settings.ACCESS_KEYS в DIAS_ERP (apps/accounts),
 * ограниченное тем, что реально видно в сайдбаре этого фронта, плюс 'analytics'
 * (пока без своей страницы, но ключ реальный и понадобится с её миграцией),
 * 'my_shift' (личный приход/уход — не страница, а право на кнопку «Начать/
 * завершить смену» в шапке, см. ShiftClockWidget) и 'returns' (не страница —
 * право на кнопку «Возврат» в кассе, см. RegisterModal/ReturnModal;
 * ReturnViewSet.required_access_key на бэке отдельный от 'sales'). Остальные
 * backend-ключи ('lines','chemistry','recipes','orders','shipments',
 * 'client_orders','payments','defects') относятся к ещё не мигрированным
 * сюда страницам — незачем показывать в модалке доступов переключатели для
 * того, чего в этом приложении просто нет.
 */
export const ACCESS_KEYS = [
  'users',
  'materials',
  'production',
  'otk',
  'warehouse',
  'clients',
  'sales',
  'returns',
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
  returns: 'Возвраты в кассе',
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
  returns: Undo2,
  analytics: BarChart3,
  shifts: Clock,
  my_shift: PlayCircle,
};

/** Группировка для модалки доступов сотрудника — по разделам сайдбара. */
export const ACCESS_KEY_GROUPS = [
  { label: 'Люди', ids: ['users'] },
  { label: 'Сырьё и производство', ids: ['materials', 'production', 'otk'] },
  { label: 'Склад', ids: ['warehouse'] },
  { label: 'Продажи', ids: ['clients', 'sales', 'returns'] },
  // Ключ 'shifts' на бэкенде также открывает /api/activity/ — общий журнал
  // действий (см. ActivityAdminView.required_access_key), отдельного ключа
  // под «Журнал действий» на бэкенде нет. 'my_shift' — отдельное, более узкое
  // право: просто кнопка «Начать/завершить смену» в шапке для рядового
  // сотрудника, без доступа к разделу «Смены» целиком.
  { label: 'Смены и журнал действий', ids: ['shifts', 'my_shift'] },
  { label: 'Аналитика', ids: ['analytics'] },
];
