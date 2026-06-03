/** Расчёт списания кг в форме «Учесть» (preview; источник правды — бэкенд). */

/** Сумма кг по профилям + брак. */
export const calcOtkAccountConsumptionKg = ({ profileLines, profilesById, defect }) => {
  let total = 0;

  for (const ln of profileLines || []) {
    const pid = ln.profileId;
    const pcs = Math.floor(Number(ln.pieces));
    if (!pid || !(pcs > 0)) continue;
    const profile = profilesById.get(String(pid));
    const w = profile?.weightKg;
    if (!Number.isFinite(w) || w <= 0) continue;
    total += pcs * w;
  }

  if (defect && Number(defect.value) > 0) {
    if (defect.unit === 'kg') {
      total += Number(defect.value);
    } else if (defect.unit === 'pieces' && defect.profileId) {
      const profile = profilesById.get(String(defect.profileId));
      const w = profile?.weightKg;
      if (Number.isFinite(w) && w > 0) {
        total += Math.floor(Number(defect.value)) * w;
      }
    }
  }

  return total;
};
