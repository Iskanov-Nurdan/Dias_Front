export const OUTPUT_LABEL = { cube: 'Куб', granule: 'Гранулят', sheet: 'Лист' };

/**
 * Общая подпись позиции склада ГП Foam. Код марки один не говорит ничего
 * о разнице между марками ("Дияр" vs "Максат") — рядом всегда показываем
 * диапазон плотности (grade_density_range с бэка, apps.foam
 * FoamGpStockSerializer.get_grade_density_range), если он есть.
 */
export const stockLabel = (s) => {
  const parts = [OUTPUT_LABEL[s.output_format] || s.output_format];
  if (s.grade_code) {
    parts.push(s.grade_density_range ? `${s.grade_code} (${s.grade_density_range})` : s.grade_code);
  }
  if (s.thickness_cm) parts.push(`${s.thickness_cm} см`);
  return parts.join(' · ');
};
