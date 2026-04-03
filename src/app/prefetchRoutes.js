/**
 * Предзагрузка lazy-chunk страницы при hover/focus по меню — первый переход без паузы на сеть.
 */
const loaders = {
  analytics: () => import('../features/analytics/AnalyticsPage'),
  employees: () => import('../features/employees/EmployeesPage'),
  'sports-trainers': () => import('../features/sports-trainers/SportsTrainersPage'),
  clients: () => import('../features/clients/ClientsPage'),
  reports: () => import('../features/clients/ClientsReportsPage'),
  leads: () => import('../features/leads/LeadsPage'),
  warehouse: () => import('../features/warehouse/WarehousePage'),
  sales: () => import('../features/sales/SalesPage'),
  expenses: () => import('../features/expenses/ExpensesPage'),
  salary: () => import('../features/salary/SalaryPage'),
};

export function prefetchRoutePage(pageId) {
  const load = loaders[pageId];
  if (load) {
    load().catch(() => {});
  }
}
