import {
  BarChart3, Users, Trophy, UsersRound, ClipboardList, Package, ShoppingCart, Receipt, Wallet, Inbox, Link2,
} from 'lucide-react';

export const PAGE_IDS = [
  'analytics',
  'reports',
  'clients',
  'sports-trainers',
  'leads',
  'employees',
  'warehouse',
  'sales',
  'expenses',
  'salary',
  'taplink',
];

export const PAGE_ICONS = {
  analytics: BarChart3,
  employees: Users,
  'sports-trainers': Trophy,
  clients: UsersRound,
  reports: ClipboardList,
  leads: Inbox,
  warehouse: Package,
  sales: ShoppingCart,
  expenses: Receipt,
  salary: Wallet,
  taplink: Link2,
};

export const PAGE_LABELS = {
  analytics: 'Аналитика',
  employees: 'Сотрудники',
  'sports-trainers': 'Спорт и тренеры',
  clients: 'Клиенты',
  reports: 'Отчёты',
  leads: 'Лиды',
  warehouse: 'Склад',
  sales: 'Продажи',
  expenses: 'Расходы',
  salary: 'Зарплата',
  taplink: 'Taplink страница',
};

export const PAGE_ROUTES = {
  analytics: '/analytics',
  employees: '/employees',
  'sports-trainers': '/sports-trainers',
  clients: '/clients',
  reports: '/reports',
  leads: '/leads',
  warehouse: '/warehouse',
  sales: '/sales',
  expenses: '/expenses',
  salary: '/salary',
  taplink: '/taplink-editor',
};

/** Группы пунктов меню: ключ группы → массив pageId */
export const PAGE_GROUPS = {
  'Аналитика': ['analytics', 'reports'],
  'Люди': ['clients', 'sports-trainers', 'leads', 'employees'],
  'Склад': ['warehouse'],
  'Финансы': ['sales', 'expenses', 'salary'],
  'Сайт': ['taplink'],
};
