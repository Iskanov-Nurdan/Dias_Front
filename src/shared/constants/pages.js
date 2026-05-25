export const PAGE_IDS = {
  ANALYTICS: 'analytics',
  USERS: 'users',
  MATERIALS: 'materials',
  CHEMISTRY: 'chemistry',
  OTK: 'otk',
  WAREHOUSE: 'warehouse',
  CLIENTS: 'clients',
  SALES: 'sales',
  ORDERS: 'orders',
  PAYMENTS: 'payments',
  PRODUCTION: 'production',
  SHIFTS: 'shifts',
  MY_SHIFT: 'my_shift',
};

export const PAGE_ROUTES = {
  [PAGE_IDS.ANALYTICS]: '/analytics',
  [PAGE_IDS.USERS]: '/users',
  [PAGE_IDS.MATERIALS]: '/materials',
  [PAGE_IDS.CHEMISTRY]: '/chemistry',
  [PAGE_IDS.OTK]: '/otk',
  [PAGE_IDS.WAREHOUSE]: '/warehouse',
  [PAGE_IDS.CLIENTS]: '/cash/clients',
  [PAGE_IDS.SALES]: '/cash/sales',
  [PAGE_IDS.ORDERS]: '/cash/orders',
  [PAGE_IDS.PAYMENTS]: '/payments',
  [PAGE_IDS.PRODUCTION]: '/production',
  [PAGE_IDS.SHIFTS]: '/shifts',
  [PAGE_IDS.MY_SHIFT]: '/my-shift',
};

export const PAGE_LABELS = {
  [PAGE_IDS.ANALYTICS]: 'Аналитика',
  [PAGE_IDS.USERS]: 'Сотрудники',
  [PAGE_IDS.MATERIALS]: 'Сырьё',
  [PAGE_IDS.CHEMISTRY]: 'Заготовка',
  [PAGE_IDS.OTK]: 'ОТК',
  [PAGE_IDS.WAREHOUSE]: 'Склад',
  [PAGE_IDS.CLIENTS]: 'Клиенты',
  [PAGE_IDS.SALES]: 'Продажи',
  [PAGE_IDS.ORDERS]: 'Заявки',
  [PAGE_IDS.PAYMENTS]: 'Оплаты',
  [PAGE_IDS.PRODUCTION]: 'Производство',
  [PAGE_IDS.SHIFTS]: 'Смены',
  [PAGE_IDS.MY_SHIFT]: 'Моя смена',
};

export const PAGE_GROUPS = {
  norms: [PAGE_IDS.MATERIALS],
  production: [PAGE_IDS.CHEMISTRY, PAGE_IDS.PRODUCTION, PAGE_IDS.OTK],
  finished: [PAGE_IDS.WAREHOUSE],
  main: [PAGE_IDS.ANALYTICS, PAGE_IDS.OTK, PAGE_IDS.WAREHOUSE],
  setup: [PAGE_IDS.MATERIALS, PAGE_IDS.CHEMISTRY],
  admin: [PAGE_IDS.USERS],
  commerce: [PAGE_IDS.CLIENTS, PAGE_IDS.ORDERS, PAGE_IDS.SALES, PAGE_IDS.PAYMENTS],
};

export const PAGE_ICONS = {
  [PAGE_IDS.ANALYTICS]: 'BarChart2',
  [PAGE_IDS.USERS]: 'Users',
  [PAGE_IDS.MATERIALS]: 'Package',
  [PAGE_IDS.CHEMISTRY]: 'Flask',
  [PAGE_IDS.OTK]: 'ShieldCheck',
  [PAGE_IDS.WAREHOUSE]: 'Warehouse',
  [PAGE_IDS.CLIENTS]: 'Building2',
  [PAGE_IDS.SALES]: 'TrendingUp',
  [PAGE_IDS.ORDERS]: 'ClipboardList',
  [PAGE_IDS.PAYMENTS]: 'TrendingUp',
  [PAGE_IDS.PRODUCTION]: 'Factory',
  [PAGE_IDS.SHIFTS]: 'CalendarCheck',
  [PAGE_IDS.MY_SHIFT]: 'Clock',
};
