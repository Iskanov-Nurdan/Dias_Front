/**
 * Вес одной штуки (кг) из объекта plastic-profile (список или detail).
 * Имена полей под разные версии бэка.
 */
export function readPlasticProfileWeightKg(p) {
  if (!p || typeof p !== 'object') return null;
  const keysKg = [
    'weight_kg_per_piece',
    'weightKgPerPiece',
    'piece_weight_kg',
    'pieceWeightKg',
    'weight_per_piece_kg',
    'weight_per_piece',
    'unit_weight_kg',
    'mass_kg_per_piece',
    'single_piece_weight_kg',
    'nominal_weight_kg',
    'piece_mass_kg',
    'weight_kg',
  ];
  for (const k of keysKg) {
    const v = p[k];
    if (v == null || v === '') continue;
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  const keysG = ['piece_weight_g', 'weight_g_per_piece', 'pieceWeightGrams', 'weight_grams_per_piece'];
  for (const k of keysG) {
    const v = p[k];
    if (v == null || v === '') continue;
    const g = Number(v);
    if (Number.isFinite(g) && g > 0) return g / 1000;
  }
  if (p.profile && typeof p.profile === 'object') {
    const nested = readPlasticProfileWeightKg(p.profile);
    if (nested != null) return nested;
  }
  return null;
}
