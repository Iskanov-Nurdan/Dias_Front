export const PAGE_IDS = [
  'analytics',
  'employees',
  'sports-trainers',
  'clients',
  'leads',
  'warehouse',
  'sales',
  'expenses',
  'salary',
];

export const PAGE_LABELS = {
  analytics: 'Аналитика',
  employees: 'Сотрудники',
  'sports-trainers': 'Виды спорта / Тренеры',
  clients: 'Клиенты',
  leads: 'Лиды',
  warehouse: 'Склад',
  sales: 'Продажи',
  expenses: 'Расходы',
  salary: 'Зарплата',
};

export const PAGE_ROUTES = {
  analytics: '/analytics',
  employees: '/employees',
  'sports-trainers': '/sports-trainers',
  clients: '/clients',
  leads: '/leads',
  warehouse: '/warehouse',
  sales: '/sales',
  expenses: '/expenses',
  salary: '/salary',
};

/** Группы пунктов меню: ключ группы → массив pageId */
export const PAGE_GROUPS = {
  'Аналитика': ['analytics'],
  'Люди': ['employees', 'sports-trainers', 'clients', 'leads'],
  'Склад': ['warehouse'],
  'Финансы': ['sales', 'expenses', 'salary'],
};
