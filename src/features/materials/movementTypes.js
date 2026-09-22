/**
 * movement_type, как их реально отдаёт GET /api/materials/movements/
 * (apps/materials/views.py, REASON_TO_MOVEMENT) — не гадаем, а держим ровно
 * то множество значений, которое подтверждено в бэкенде.
 */
export const MOVEMENT_TYPE_LABELS = {
  incoming: 'Приход',
  writeoff_chemistry: 'Списание (химия)',
  writeoff_production: 'Списание (производство)',
  writeoff_workshop: 'Списание на производство (цех)',
  writeoff_other: 'Списание',
};

export const movementTypeLabel = (type) => MOVEMENT_TYPE_LABELS[type] || type;
