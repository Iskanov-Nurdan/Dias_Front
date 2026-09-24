import {
  Users, UsersRound, Clock, History, Package, FlaskConical, Warehouse, Factory,
  ClipboardCheck, Archive, ShoppingCart, BarChart3,
} from 'lucide-react';

// Порядок = порядок в сайдбаре и в «Ещё» на мобиле, и первый доступный
// раздел открывается после входа. Логика: сводка → производственный цикл
// (сырьё → заготовка → цех → производство → ОТК → склад) → продажи
// (клиенты → касса) → люди и контроль (сотрудники → смены → журнал).
export const PAGE_IDS = [
  // Аналитика (apps/analytics, /api/analytics/dashboard/) — ключ 'analytics';
  // финансовые цифры внутри дополнительно гейтятся ключом 'analytics_finance'.
  'analytics',
  'materials',
  'workshop',
  'workshop-floor',
  'production',
  'otk',
  'warehouse',
  // 'clients' здесь — apps/sales.Client (CRM-карточка с кредитным лимитом),
  // а не старая клубная подписка Rahman Ata.
  'clients',
  'sales',
  'employees',
  'shifts',
  'activity-log',
];

export const PAGE_ICONS = {
  employees: Users,
  materials: Package,
  workshop: FlaskConical,
  'workshop-floor': Warehouse,
  production: Factory,
  otk: ClipboardCheck,
  warehouse: Archive,
  sales: ShoppingCart,
  clients: UsersRound,
  'activity-log': History,
  shifts: Clock,
  analytics: BarChart3,
};

export const PAGE_LABELS = {
  employees: 'Сотрудники',
  materials: 'Сырьё',
  workshop: 'Заготовка',
  'workshop-floor': 'Цех',
  production: 'Производство',
  otk: 'ОТК',
  warehouse: 'Склад',
  sales: 'Касса',
  clients: 'Клиенты',
  'activity-log': 'Журнал действий',
  shifts: 'Смены',
  analytics: 'Аналитика',
};

export const PAGE_ROUTES = {
  employees: '/employees',
  materials: '/materials',
  workshop: '/workshop',
  'workshop-floor': '/workshop-floor',
  production: '/production',
  otk: '/otk',
  warehouse: '/warehouse',
  sales: '/sales',
  clients: '/clients',
  'activity-log': '/activity-log',
  shifts: '/shifts',
  analytics: '/analytics',
};

/**
 * pageId → access-key DIAS_ERP (см. shared/constants/accessKeys.js).
 * Заполняется по одной странице за раз по мере миграции — то, чего здесь нет,
 * останется недоступным (hasAccess вернёт false), пока страницу не перевели
 * на реальный бэкенд.
 */
export const PAGE_ID_ACCESS_KEY_MAP = {
  employees: 'users',
  materials: 'materials',
  // apps/workshop (заготовка/цех/партии) в DIAS_ERP гейтится ключом 'materials',
  // отдельного 'workshop' в ACCESS_KEYS нет — так решили на бэкенде.
  workshop: 'materials',
  'workshop-floor': 'materials',
  // /workshop/blank-production-runs/ на бэкенде сегодня вообще без
  // required_access_key (доступен любому авторизованному) — но для видимости
  // пункта меню используем содержательный ключ домена, а не оставляем дыру.
  production: 'production',
  // Реальные эндпоинты ОТК (apps/workshop otk_*) все гейтятся ключом
  // 'materials' на бэкенде, а не 'otk' — 'otk' используется только у
  // мёртвой ветки apps/otk, которую фронт (старый и новый) не использует.
  otk: 'materials',
  warehouse: 'warehouse',
  // apps/sales — ключи 'clients'/'sales' совпадают с pageId 1:1, отображаем
  // их явно (а не полагаемся молча на fallback accessKey ?? pageId в hasAccess).
  clients: 'clients',
  sales: 'sales',
  // /api/activity/ (журнал действий для админа) на бэкенде гейтится ключом
  // 'shifts' (см. ActivityAdminView.required_access_key), не отдельным
  // 'activity-log' — такого ключа в ACCESS_KEYS вообще нет. Без этой строки
  // hasAccess('activity-log') всегда возвращал false (fallback на
  // несуществующий accessKey 'activity-log'), и пункт меню не показывался
  // никому, включая тех, у кого реально есть доступ к сменам.
  'activity-log': 'shifts',
  analytics: 'analytics',
};

/**
 * Группы пунктов меню (между группами — разделитель): ключ группы → массив
 * pageId. Порядок групп — тот же, что PAGE_IDS.
 */
/**
 * Приоритет разделов для нижней таб-бар навигации на мобиле (≤768px):
 * первые доступные пользователю 4 попадают отдельными вкладками, остальные —
 * в шторку «Ещё». Порядок отражает то, с чем работают чаще всего в цеху —
 * производственный цикл (Производство → Склад) и продажи (Клиенты → Касса).
 * Если у пользователя доступно ≤4 разделов вообще — приоритет не нужен,
 * MainLayout покажет все как отдельные вкладки без «Ещё».
 */
export const MOBILE_NAV_PRIMARY_IDS = ['production', 'warehouse', 'clients', 'sales'];

export const PAGE_GROUPS = {
  'Аналитика': ['analytics'],
  'Сырьё и химия': ['materials', 'workshop', 'workshop-floor'],
  'Производство': ['production', 'otk'],
  'Склад': ['warehouse'],
  'Продажи': ['clients', 'sales'],
  'Люди и контроль': ['employees', 'shifts', 'activity-log'],
};
