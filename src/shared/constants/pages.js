import {
  BarChart3, Users, Trophy, UsersRound, ClipboardList, Receipt, Wallet, Inbox, Link2, Clock, Table2, History,
  UserCheck,
} from 'lucide-react';

export const PAGE_IDS = [
  'analytics',
  'reports',
  'activity-log',
  'clients',
  'sports-trainers',
  'leads',
  'employees',
  'expenses',
  'salary',
  'shifts',
  'taplink',
  'spreadsheet',
  // Кабинет тренера — отдельная страница, а не часть 'clients': у тренера
  // нет доступа к чужим клиентам и остальным разделам CRM.
  'trainer-report',
];

export const PAGE_ICONS = {
  analytics: BarChart3,
  employees: Users,
  'sports-trainers': Trophy,
  clients: UsersRound,
  reports: ClipboardList,
  'activity-log': History,
  leads: Inbox,
  expenses: Receipt,
  salary: Wallet,
  shifts: Clock,
  taplink: Link2,
  spreadsheet: Table2,
  'trainer-report': UserCheck,
};

export const PAGE_LABELS = {
  analytics: 'Аналитика',
  employees: 'Сотрудники',
  'sports-trainers': 'Спорт и тренеры',
  clients: 'Клиенты',
  reports: 'Отчёты',
  'activity-log': 'Журнал действий',
  leads: 'Лиды',
  expenses: 'Расходы',
  salary: 'Зарплата',
  shifts: 'Смены',
  taplink: 'Taplink страница',
  spreadsheet: 'Таблицы',
  'trainer-report': 'Мой отчёт',
};

export const PAGE_ROUTES = {
  analytics: '/analytics',
  employees: '/employees',
  'sports-trainers': '/sports-trainers',
  clients: '/clients',
  reports: '/reports',
  'activity-log': '/activity-log',
  leads: '/leads',
  expenses: '/expenses',
  salary: '/salary',
  shifts: '/shifts',
  taplink: '/taplink-editor',
  spreadsheet: '/spreadsheet',
  'trainer-report': '/my-report',
};

/** Группы пунктов меню: ключ группы → массив pageId */
export const PAGE_GROUPS = {
  'Аналитика': ['analytics', 'reports', 'activity-log'],
  'Люди': ['clients', 'sports-trainers', 'leads', 'employees'],
  'Финансы': ['expenses', 'salary'],
  'Смены': ['shifts'],
  'Сайт': ['taplink'],
  'Таблицы': ['spreadsheet'],
  'Кабинет': ['trainer-report'],
};
