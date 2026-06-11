/** Расчёт списания кг в форме «Учесть» (preview; источник правды — бэкенд). */

/** Сумма кг по профилям + брак (все заготовки). */
export const calcOtkAccountConsumptionKg = ({ profileLines, profilesById, defectKg = 0, defectBlankId = '' }) => {
  const byBlank = calcOtkAccountConsumptionByBlank({
    profileLines,
    profilesById,
    defectKg,
    defectBlankId,
  });
  let total = 0;
  byBlank.forEach((kg) => { total += kg; });
  return total;
};

/** Списание по blank_id: профили + опциональный брак (кг). */
export const calcOtkAccountConsumptionByBlank = ({
  profileLines,
  profilesById,
  defectKg = 0,
  defectBlankId = '',
}) => {
  const byBlank = new Map();

  for (const ln of profileLines || []) {
    const pid = ln.profileId;
    const pcs = Math.floor(Number(ln.pieces));
    if (!pid || !(pcs > 0)) continue;
    const profile = profilesById.get(String(pid));
    const w = profile?.weightKg;
    const blankId = profile?.blankId;
    if (!blankId || !Number.isFinite(w) || w <= 0) continue;
    const key = String(blankId);
    byBlank.set(key, (byBlank.get(key) || 0) + pcs * w);
  }

  const dkg = Number(defectKg);
  if (Number.isFinite(dkg) && dkg > 0 && defectBlankId) {
    const key = String(defectBlankId);
    byBlank.set(key, (byBlank.get(key) || 0) + dkg);
  }

  return byBlank;
};

export const findOtkBlankOverages = (consumptionByBlank, poolByBlankId) => {
  const overages = [];
  if (!consumptionByBlank) return overages;
  consumptionByBlank.forEach((kg, blankId) => {
    const pool = poolByBlankId?.get(String(blankId));
    const remaining = pool?.remainingKg ?? 0;
    if (kg > remaining + 1e-6) {
      overages.push({
        blankId: String(blankId),
        blankName: pool?.blankName || `Заготовка #${blankId}`,
        consumedKg: kg,
        remainingKg: remaining,
      });
    }
  });
  return overages;
};
