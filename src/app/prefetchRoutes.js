/**
 * Предзагрузка lazy-chunk страницы при hover/focus по меню — первый переход без паузы на сеть.
 */
const loaders = {
  employees: () => import('../features/employees/EmployeesPage'),
  materials: () => import('../features/materials/MaterialsPage'),
  workshop: () => import('../features/workshop/WorkshopPage'),
  'workshop-floor': () => import('../features/workshop/WorkshopFloorPage'),
  production: () => import('../features/production/ProductionPage'),
  otk: () => import('../features/otk/OTKPage'),
  warehouse: () => import('../features/warehouse/WarehousePage'),
  clients: () => import('../features/clients/ClientsPage'),
  sales: () => import('../features/sales/SalesPage'),
  'activity-log': () => import('../features/activity/ActivityLogPage'),
  shifts: () => import('../features/shifts/ShiftsPage'),
  analytics: () => import('../features/analytics/AnalyticsPage'),
};

export function prefetchRoutePage(pageId) {
  const load = loaders[pageId];
  if (load) {
    load().catch(() => {});
  }
}
