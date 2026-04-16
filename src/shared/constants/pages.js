export const PAGE_IDS = {
  ANALYTICS: 'analytics',
  USERS: 'users',
  LINES: 'lines',
  MATERIALS: 'materials',
  CHEMISTRY: 'chemistry',
  RECIPES: 'recipes',
  OTK: 'otk',
  WAREHOUSE: 'warehouse',
  CLIENTS: 'clients',
  SALES: 'sales',
};

export const PAGE_ROUTES = {
  [PAGE_IDS.ANALYTICS]: '/analytics',
  [PAGE_IDS.USERS]: '/users',
  [PAGE_IDS.LINES]: '/lines',
  [PAGE_IDS.MATERIALS]: '/materials',
  [PAGE_IDS.CHEMISTRY]: '/chemistry',
  [PAGE_IDS.RECIPES]: '/recipes',
  [PAGE_IDS.OTK]: '/otk',
  [PAGE_IDS.WAREHOUSE]: '/warehouse',
  [PAGE_IDS.CLIENTS]: '/clients',
  [PAGE_IDS.SALES]: '/sales',
};

export const PAGE_LABELS = {
  [PAGE_IDS.ANALYTICS]: 'Отчёты и аналитика',
  [PAGE_IDS.USERS]: 'Сотрудники',
  [PAGE_IDS.LINES]: 'Линии и смены на линиях',
  [PAGE_IDS.MATERIALS]: 'Сырьё и остатки',
  [PAGE_IDS.CHEMISTRY]: 'Химия (полуфабрикат)',
  [PAGE_IDS.RECIPES]: 'Рецептуры',
  [PAGE_IDS.OTK]: 'ОТК',
  [PAGE_IDS.WAREHOUSE]: 'Склад готовой продукции',
  [PAGE_IDS.CLIENTS]: 'Клиенты',
  [PAGE_IDS.SALES]: 'Продажи',
};

/** Группы для вспомогательных подборок (виджеты, ссылки) */
export const PAGE_GROUPS = {
  norms: [PAGE_IDS.RECIPES, PAGE_IDS.MATERIALS],
  production: [PAGE_IDS.LINES, PAGE_IDS.CHEMISTRY, PAGE_IDS.OTK],
  finished: [PAGE_IDS.WAREHOUSE],
  main: [PAGE_IDS.ANALYTICS, PAGE_IDS.OTK, PAGE_IDS.WAREHOUSE],
  setup: [PAGE_IDS.LINES, PAGE_IDS.MATERIALS, PAGE_IDS.CHEMISTRY, PAGE_IDS.RECIPES],
  admin: [PAGE_IDS.USERS],
  commerce: [PAGE_IDS.CLIENTS, PAGE_IDS.SALES],
};

export const PAGE_ICONS = {
  [PAGE_IDS.ANALYTICS]: 'BarChart2',
  [PAGE_IDS.USERS]: 'Users',
  [PAGE_IDS.LINES]: 'Factory',
  [PAGE_IDS.MATERIALS]: 'Package',
  [PAGE_IDS.CHEMISTRY]: 'Flask',
  [PAGE_IDS.RECIPES]: 'BookOpen',
  [PAGE_IDS.OTK]: 'ShieldCheck',
  [PAGE_IDS.WAREHOUSE]: 'Warehouse',
  [PAGE_IDS.CLIENTS]: 'Building2',
  [PAGE_IDS.SALES]: 'TrendingUp',
};
