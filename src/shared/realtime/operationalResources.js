/** Имена resource для WS — должны совпадать с бэком (docs/WEBSOCKET_API.md). */

/** Фактический каталог с бэка (apps/realtime). `chemistry*` — префикс. */
export const OPERATIONAL_RESOURCES_ALL = [
  'shift',
  'shift_note',
  'shift_complaint',
  'activity',
  'raw_material',
  'incoming',
  'material_balance',
  'material_writeoff',
  'material_movement',
  'workshop_blank',
  'prepared_blank',
  'blank_production_run',
  'workshop_run',
  'plastic_profile',
  'order',
  'orders',
  'production_batch',
  'batch',
  'recipe_run',
  'warehouse_batch',
  'warehouse_package',
  'sale',
  'payment',
  'return',
  'client',
  'recipe',
  'recipes',
  'line',
  'line_history',
  'defect_record',
  'rework_request',
  'chemistry*',
  'foam_raw_lot',
  'foam_density_grade',
  'foam_production_run',
  'foam_gp_stock',
  'foam_sale',
];

export const WS_FOAM_MATERIALS = ['foam_raw_lot', 'foam_density_grade', 'foam_production_run'];
export const WS_FOAM_PRODUCTION = ['foam_raw_lot', 'foam_density_grade', 'foam_production_run', 'foam_gp_stock'];
export const WS_FOAM_WAREHOUSE = ['foam_gp_stock'];
export const WS_FOAM_SALES = ['foam_gp_stock', 'foam_sale'];

export const WS_SHIFT = ['shift', 'shift_note', 'shift_complaint', 'activity'];

export const WS_MATERIALS = [
  'raw_material',
  'incoming',
  'material_balance',
  'material_writeoff',
  'material_movement',
];

export const WS_WORKSHOP = [
  'workshop_blank',
  'prepared_blank',
  'blank_production_run',
  'workshop_run',
  'plastic_profile',
  'raw_material',
  'recipe_run',
  'chemistry*',
];

export const WS_PRODUCTION = [
  'order',
  'orders',
  'production_batch',
  'batch',
  ...WS_WORKSHOP,
];

export const WS_OTK = ['otk', 'workshop', 'blank_production_run', 'workshop_run', 'workshop_blank', 'prepared_blank'];

export const WS_WAREHOUSE = [
  'warehouse_batch',
  'blank_production_run',
  'workshop_run',
  'otk',
  'sale',
  'return',
  'defect_record',
];

export const WS_CASH = ['sale', 'payment', 'return', 'order', 'client'];

export const WS_SHIFTS_REPORT = ['shift', 'shift_complaint', 'activity'];
