/** Имена resource для WS — должны совпадать с бэком (docs/WEBSOCKET_BACKEND_PROMPT.md). */

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
];

export const WS_PRODUCTION = ['order', 'production_batch', 'orders', 'workshop_blank', ...WS_WORKSHOP];

export const WS_OTK = ['blank_production_run', 'workshop_run', 'workshop_blank'];

export const WS_WAREHOUSE = [
  'warehouse_package',
  'warehouse_batch',
  'blank_production_run',
  'workshop_run',
  'sale',
  'return',
  'defect_record',
  'rework_request',
];

export const WS_CASH = ['sale', 'payment', 'return', 'order', 'client'];

export const WS_SHIFTS_REPORT = ['shift', 'shift_complaint', 'activity'];
