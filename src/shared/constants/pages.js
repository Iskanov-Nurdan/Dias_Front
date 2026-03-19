export const PAGE_IDS = {
  ANALYTICS: 'analytics',
  USERS: 'users',
  LINES: 'lines',
  MATERIALS: 'materials',
  CHEMISTRY: 'chemistry',
  RECIPES: 'recipes',
  ORDERS: 'orders',
  PRODUCTION: 'production',
  OTK: 'otk',
  WAREHOUSE: 'warehouse',
  CLIENTS: 'clients',
  SALES: 'sales',
  SHIPMENTS: 'shipments',
};

export const PAGE_ROUTES = {
  [PAGE_IDS.ANALYTICS]: '/analytics',
  [PAGE_IDS.USERS]: '/users',
  [PAGE_IDS.LINES]: '/lines',
  [PAGE_IDS.MATERIALS]: '/materials',
  [PAGE_IDS.CHEMISTRY]: '/chemistry',
  [PAGE_IDS.RECIPES]: '/recipes',
  [PAGE_IDS.ORDERS]: '/orders',
  [PAGE_IDS.PRODUCTION]: '/production',
  [PAGE_IDS.OTK]: '/otk',
  [PAGE_IDS.WAREHOUSE]: '/warehouse',
  [PAGE_IDS.CLIENTS]: '/clients',
  [PAGE_IDS.SALES]: '/sales',
  [PAGE_IDS.SHIPMENTS]: '/shipments',
};

export const PAGE_LABELS = {
  [PAGE_IDS.ANALYTICS]: 'Аналитика',
  [PAGE_IDS.USERS]: 'Сотрудники',
  [PAGE_IDS.LINES]: 'Линии',
  [PAGE_IDS.MATERIALS]: 'Сырьё',
  [PAGE_IDS.CHEMISTRY]: 'Химия',
  [PAGE_IDS.RECIPES]: 'Рецепты',
  [PAGE_IDS.ORDERS]: 'Заказы',
  [PAGE_IDS.PRODUCTION]: 'Производство',
  [PAGE_IDS.OTK]: 'ОТК',
  [PAGE_IDS.WAREHOUSE]: 'Склад ГП',
  [PAGE_IDS.CLIENTS]: 'Клиенты',
  [PAGE_IDS.SALES]: 'Продажи',
  [PAGE_IDS.SHIPMENTS]: 'Отгрузки',
};

export const PAGE_GROUPS = {
  main: [PAGE_IDS.ANALYTICS, PAGE_IDS.ORDERS, PAGE_IDS.PRODUCTION, PAGE_IDS.OTK, PAGE_IDS.WAREHOUSE],
  setup: [PAGE_IDS.LINES, PAGE_IDS.MATERIALS, PAGE_IDS.CHEMISTRY, PAGE_IDS.RECIPES],
  admin: [PAGE_IDS.USERS],
  commerce: [PAGE_IDS.CLIENTS, PAGE_IDS.SALES, PAGE_IDS.SHIPMENTS],
};

export const PAGE_ICONS = {
  [PAGE_IDS.ANALYTICS]: 'BarChart2',
  [PAGE_IDS.USERS]: 'Users',
  [PAGE_IDS.LINES]: 'Factory',
  [PAGE_IDS.MATERIALS]: 'Package',
  [PAGE_IDS.CHEMISTRY]: 'Flask',
  [PAGE_IDS.RECIPES]: 'BookOpen',
  [PAGE_IDS.ORDERS]: 'ClipboardList',
  [PAGE_IDS.PRODUCTION]: 'Cog',
  [PAGE_IDS.OTK]: 'ShieldCheck',
  [PAGE_IDS.WAREHOUSE]: 'Warehouse',
  [PAGE_IDS.CLIENTS]: 'Building2',
  [PAGE_IDS.SALES]: 'TrendingUp',
  [PAGE_IDS.SHIPMENTS]: 'Truck',
};
